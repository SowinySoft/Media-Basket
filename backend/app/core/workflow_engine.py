"""Workflow engine — executes trigger → condition → action pipelines."""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.logging import get_logger

logger = get_logger("workflow_engine")


class WorkflowEngine:
    """Execute workflows: evaluate triggers, run conditions, execute actions."""

    def __init__(self, db: AsyncSession, org_id: str):
        self.db = db
        self.org_id = org_id

    async def execute_workflow(self, workflow_id: str, trigger_data: dict) -> dict:
        """Run a full workflow: evaluate conditions → execute actions."""
        from app.models.models import Workflow, WorkflowExecution

        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id, Workflow.org_id == self.org_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            return {"error": "Workflow not found"}

        if not workflow.enabled:
            return {"error": "Workflow is disabled"}

        # Create execution record
        execution = WorkflowExecution(
            org_id=self.org_id,
            workflow_id=workflow_id,
            trigger_data=trigger_data,
            status="running",
        )
        self.db.add(execution)
        await self.db.flush()
        await self.db.refresh(execution)

        step_results = []
        current_data = trigger_data

        for i, step in enumerate(workflow.steps):
            step_type = step.get("type")
            step_config = step.get("config", {})
            step_result = {"step": i + 1, "type": step_type, "status": "success"}

            try:
                if step_type == "condition":
                    passed = await self._evaluate_condition(step_config, current_data)
                    step_result["passed"] = passed
                    if not passed:
                        step_result["status"] = "skipped"
                        execution.status = "skipped"
                        execution.step_results = step_results + [step_result]
                        execution.completed_at = datetime.now(timezone.utc)
                        await self.db.flush()
                        return {"status": "skipped", "step": i + 1, "reason": "condition_failed"}

                elif step_type == "action":
                    output = await self._execute_action(step_config, current_data)
                    step_result["output"] = output
                    if output:
                        current_data = {**current_data, "action_output": output}

                elif step_type == "delay":
                    step_result["delay_seconds"] = step_config.get("seconds", 0)

                elif step_type == "branch":
                    branch_key = step_config.get("field", "status")
                    branches = step_config.get("branches", {})
                    value = current_data.get(branch_key, "")
                    step_result["branch"] = branches.get(value, branches.get("default", ""))

                step_results.append(step_result)

            except Exception as exc:
                step_result["status"] = "failed"
                step_result["error"] = str(exc)
                step_results.append(step_result)
                execution.status = "failed"
                execution.step_results = step_results
                execution.error = f"Step {i + 1} failed: {str(exc)}"
                execution.completed_at = datetime.now(timezone.utc)
                await self.db.flush()
                logger.error("workflow_step_failed", workflow_id=workflow_id, step=i + 1, error=str(exc))
                return {"status": "failed", "step": i + 1, "error": str(exc)}

        execution.status = "success"
        execution.step_results = step_results
        execution.completed_at = datetime.now(timezone.utc)
        workflow.last_run_at = datetime.now(timezone.utc)
        workflow.last_run_status = "success"
        workflow.run_count += 1
        await self.db.flush()

        return {"status": "success", "steps": step_results, "execution_id": str(execution.id)}

    async def _evaluate_condition(self, config: dict, data: dict) -> bool:
        """Evaluate a condition step."""
        field = config.get("field", "")
        operator = config.get("operator", "equals")
        value = config.get("value", "")
        actual = data.get(field, "")

        if operator == "equals":
            return str(actual).lower() == str(value).lower()
        elif operator == "not_equals":
            return str(actual).lower() != str(value).lower()
        elif operator == "contains":
            return str(value).lower() in str(actual).lower()
        elif operator == "greater_than":
            return float(actual) > float(value)
        elif operator == "less_than":
            return float(actual) < float(value)
        elif operator == "in":
            values = [v.strip().lower() for v in str(value).split(",")]
            return str(actual).lower() in values
        elif operator == "exists":
            return actual is not None and actual != ""
        elif operator == "not_exists":
            return actual is None or actual == ""
        return False

    async def _execute_action(self, config: dict, data: dict) -> dict:
        """Execute an action step."""
        action_type = config.get("action_type", "")

        if action_type == "notify":
            from app.routes.inbox import create_notification
            await create_notification(
                self.db, self.org_id,
                config.get("notification_type", "workflow.action"),
                config.get("title", "Workflow Action"),
                body=config.get("body", ""),
                metadata=config.get("metadata", {}),
            )
            return {"notification_sent": True}

        elif action_type == "flag_content":
            from app.models.models import ContentMetadata
            content_id = data.get("content_item_id") or data.get("id")
            if content_id:
                result = await self.db.execute(
                    select(ContentMetadata).where(ContentMetadata.content_item_id == content_id)
                )
                meta = result.scalar_one_or_none()
                if meta:
                    meta.flagged = True
                    meta.flag_reasons = config.get("reasons", ["workflow_flagged"])
            return {"flagged": True}

        elif action_type == "update_status":
            return {"status_updated": config.get("new_status", "")}

        elif action_type == "send_webhook":
            import httpx
            url = config.get("url", "")
            if url:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, json=data, timeout=10)
                    return {"webhook_status": resp.status_code}
            return {"webhook_skipped": True}

        elif action_type == "log":
            logger.info("workflow_log", org_id=self.org_id, message=config.get("message", ""))
            return {"logged": True}

        return {"action_type": action_type, "executed": True}
