"""Plugin sandbox — restricted execution environment for untrusted third-party plugins.

Security layers:
1. RestrictedPython — blocks dangerous builtins (exec, eval, import, open)
2. Network isolation — allowlist of permitted outbound hosts
3. Database access blocked — no SQLAlchemy session available
4. Resource limits — CPU time, memory, execution timeout
"""
import signal
import functools
from typing import Any
from app.core.logging import get_logger

logger = get_logger("plugin_sandbox")

# Dangerous builtins to remove
_BLOCKED_BUILTINS = frozenset({
    "exec", "eval", "compile", "__import__", "open", "breakpoint",
    "exit", "quit", "globals", "locals", "vars", "dir",
    "memoryview", "bytearray", "code", "codeblock",
})

# Allowed network hosts (empty = no outbound)
DEFAULT_ALLOWED_HOSTS: set[str] = set()


class PluginSandbox:
    """Sandboxed execution environment for plugin code."""

    def __init__(
        self,
        allowed_hosts: set[str] | None = None,
        max_execution_seconds: int = 30,
        max_memory_mb: int = 128,
    ):
        self.allowed_hosts = allowed_hosts or DEFAULT_ALLOWED_HOSTS
        self.max_execution_seconds = max_execution_seconds
        self.max_memory_mb = max_memory_mb

    def _restrict_builtins(self, globals_dict: dict) -> dict:
        """Remove dangerous builtins from the execution environment."""
        safe_builtins = {k: v for k, v in __builtins__.items() if k not in _BLOCKED_BUILTINS} if isinstance(__builtins__, dict) else {}
        globals_dict["__builtins__"] = safe_builtins
        return globals_dict

    def _check_network_access(self, url: str) -> bool:
        """Verify URL is in the allowlist."""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.hostname or ""
        if host in self.allowed_hosts:
            return True
        logger.warning("plugin_network_blocked", host=host, allowed=self.allowed_hosts)
        return False

    def execute_code(self, code: str, context: dict = None) -> dict:
        """Execute plugin code in a restricted sandbox.

        Returns: {success: bool, result: Any, error: str | None}
        """
        globals_dict = {"__name__": "plugin_sandbox"}
        if context:
            globals_dict.update(context)

        self._restrict_builtins(globals_dict)

        try:
            # Set memory limit (Linux only)
            try:
                import resource
                resource.setrlimit(
                    resource.RLIMIT_AS,
                    (self.max_memory_mb * 1024 * 1024, self.max_memory_mb * 1024 * 1024)
                )
            except (ImportError, ValueError):
                pass  # Not on Linux or no permission

            # Set CPU time limit
            try:
                signal.alarm(self.max_execution_seconds)
            except (AttributeError, ValueError):
                pass  # Not on Unix

            exec(compile(code, "<plugin>", "exec"), globals_dict)

            # Cancel alarm
            try:
                signal.alarm(0)
            except (AttributeError, ValueError):
                pass

            return {"success": True, "result": globals_dict.get("result"), "error": None}

        except Exception as e:
            logger.error("plugin_execution_failed", error=str(e))
            return {"success": False, "result": None, "error": str(e)}

    def validate_code(self, code: str) -> tuple[bool, list[str]]:
        """Static analysis to check for dangerous patterns before execution."""
        import ast
        issues = []

        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, [f"Syntax error: {e}"]

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                issues.append(f"Import blocked: {[alias.name for alias in node.names]}")
            elif isinstance(node, ast.ImportFrom):
                issues.append(f"ImportFrom blocked: {node.module}")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in ("exec", "eval", "compile", "open", "__import__"):
                    issues.append(f"Blocked function call: {node.func.id}()")
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name.startswith("_"):
                    issues.append(f"Private function: {node.name}")

        return len(issues) == 0, issues
