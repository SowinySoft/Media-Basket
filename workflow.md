# MediaBasket Workflow Automation

## Overview

MediaBasket workflows automate content moderation, publishing, and notification pipelines across all connected social media platforms. Workflows are **event-driven pipelines** that execute a sequence of steps (conditions, actions, delays, branches) when triggered by content events, schedules, webhooks, or manual invocation.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   TRIGGER   │────▶│  CONDITION  │────▶│   ACTION    │────▶│   OUTPUT    │
│             │     │  (evaluate) │     │  (execute)  │     │  (result)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
   content.new          sentiment           notify               success
   content.flagged      spam_score          flag_content         failed
   schedule             toxicity > 0.7      send_webhook         skipped
   webhook              likes > 100         log
   manual               approved == true    update_status
```

---

## Architecture

### Database Tables

| Table | Purpose |
|-------|---------|
| `workflows` | Workflow definitions — name, trigger config, step pipeline, run metadata |
| `workflow_executions` | Execution log — per-run status, step results, timestamps |

### Backend Components

| Component | Path | Purpose |
|-----------|------|---------|
| `WorkflowEngine` | `app/core/workflow_engine.py` | Executes trigger → condition → action pipelines |
| `workflows` routes | `app/routes/workflows.py` | CRUD API, execute, history, templates |
| `Workflow` model | `app/models/models.py:413` | ORM model with JSONB steps |
| `WorkflowExecution` model | `app/models/models.py:431` | Per-run execution log |
| Migration `011` | `alembic/versions/011_workflows.py` | Creates tables + RLS |

### Frontend

| Component | Path | Purpose |
|-----------|------|---------|
| Workflow page | `app/workflows/page.tsx` | Visual workflow builder + template gallery |
| API client | `lib/api.ts` → `api.workflows.*` | Typed API functions |

---

## Triggers

Triggers define **when** a workflow runs.

| Trigger Type | Config | Fires When |
|-------------|--------|------------|
| `content.new` | `{connector_type?: string}` | New content ingested via any/specific connector |
| `content.flagged` | `{reason?: string}` | Content is flagged by moderation or ML |
| `schedule` | `{cron: "0 9 * * *"}` | Cron schedule (evaluated by scheduler) |
| `webhook` | `{secret?: string}` | External webhook POST received |
| `manual` | `{}` | User clicks "Execute" in the UI or calls API |

---

## Step Types

Each workflow contains an ordered list of steps. Four step types are supported:

### 1. Condition

Evaluates a boolean expression against the current data context.

```json
{
  "type": "condition",
  "config": {
    "field": "sentiment",
    "operator": "equals",
    "value": "negative"
  }
}
```

**Operators:** `equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `in`, `exists`, `not_exists`

If the condition fails, execution **stops** (workflow status = `skipped`).

### 2. Action

Executes a side effect.

```json
{
  "type": "action",
  "config": {
    "action_type": "notify",
    "title": "Toxic content detected",
    "body": "Content auto-flagged"
  }
}
```

**Action Types:**

| action_type | Config Fields | Description |
|------------|---------------|-------------|
| `notify` | `title`, `body`, `notification_type`, `metadata` | Create an in-app notification |
| `flag_content` | `reasons: string[]` | Flag content in ContentMetadata |
| `update_status` | `new_status: string` | Update content/publishing status |
| `send_webhook` | `url: string` | POST trigger data to external URL |
| `log` | `message: string` | Write to workflow log |

### 3. Delay

Pauses execution for a specified duration.

```json
{
  "type": "delay",
  "config": { "seconds": 3600 }
}
```

### 4. Branch

Routes execution based on a field value.

```json
{
  "type": "branch",
  "config": {
    "field": "sentiment",
    "branches": {
      "positive": "share_workflow",
      "negative": "flag_workflow",
      "default": "review_workflow"
    }
  }
}
```

---

## Step Pipeline

Steps execute sequentially. The data context flows through each step:

```
trigger_data
    │
    ▼
[Step 1: condition] ──pass──▶ data unchanged
    │
    fail → workflow SKIPS
    │
    ▼
[Step 2: action] ──▶ data += { action_output: result }
    │
    ▼
[Step 3: condition] ──pass──▶ ...
    │
    ▼
[Step N: ...]
    │
    ▼
workflow SUCCESS
```

---

## Workflow Templates

Six pre-built templates are included:

| Template | Trigger | Steps | Purpose |
|----------|---------|-------|---------|
| Auto-Flag Toxic | content.new | 2 | Flag content with toxicity > 0.7 |
| Negative Sentiment Alert | content.new | 1 | Notify on negative sentiment |
| High Engagement Auto-Share | content.new | 2 | Auto-schedule high-engagement posts |
| Spam Content Filter | content.new | 2 | Quarantine spam (score > 0.8) |
| Daily Digest Notification | schedule | 1 | Daily summary at 9 AM |
| Cross-Platform Publisher | manual | 2 | Publish approved content via webhook |

---

## API Endpoints

All endpoints are under `/api/v1/orgs/{org_id}/workflows`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all workflows |
| `POST` | `/` | Create a workflow |
| `GET` | `/{id}` | Get workflow details |
| `PUT` | `/{id}` | Update a workflow |
| `DELETE` | `/{id}` | Delete a workflow |
| `POST` | `/{id}/toggle` | Enable/disable workflow |
| `POST` | `/{id}/execute` | Manually execute with trigger data |
| `GET` | `/{id}/executions` | List execution history |
| `GET` | `/templates/list` | List available templates |

### Execute Request

```json
POST /api/v1/orgs/{org_id}/workflows/{id}/execute
{
  "trigger_data": {
    "content_item_id": "...",
    "sentiment": "negative",
    "toxicity_score": 0.85,
    "connector_type": "twitter"
  }
}
```

### Execute Response

```json
{
  "status": "success",
  "execution_id": "...",
  "steps": [
    {"step": 1, "type": "condition", "status": "success", "passed": true},
    {"step": 2, "type": "action", "status": "success", "output": {"flagged": true}},
    {"step": 3, "type": "action", "status": "success", "output": {"notification_sent": true}}
  ]
}
```

---

## Execution States

| State | Meaning |
|-------|---------|
| `running` | Workflow is currently executing |
| `success` | All steps completed successfully |
| `failed` | A step threw an exception |
| `skipped` | A condition step returned false |

---

## Security

- All workflow endpoints require JWT authentication
- Create/update/delete require `owner` or `admin` role
- RLS enforced — org isolation via `app.current_tenant`
- Execute requires authentication but any role can trigger manual runs

---

## Integration Points

Workflows integrate with other MediaBasket systems:

| System | Integration |
|--------|-------------|
| **Content Pipeline** | Trigger on `content.new` after ingestion |
| **ML Pipeline** | Access `sentiment`, `spam_score`, `toxicity_score` in conditions |
| **Notifications** | `notify` action creates in-app notifications |
| **Moderation** | `flag_content` action updates ContentMetadata |
| **Scheduler** | `schedule` trigger type with cron expressions |
| **Webhooks** | `send_webhook` action POSTs to external URLs |
| **WebSocket** | Execution results broadcast to connected clients |

---

## File Reference

```
backend/
  app/
    core/
      workflow_engine.py          # Engine: execute pipelines
    models/
      models.py:413               # Workflow + WorkflowExecution models
    routes/
      workflows.py                # API routes
  alembic/
    versions/
      011_workflows.py            # Migration

frontend/
  src/
    app/
      workflows/
        page.tsx                  # Visual workflow builder
    lib/
      api.ts                      # api.workflows.* client
```
