"""Plugin manifest validation — Gap 28."""
from pydantic import BaseModel, field_validator
from typing import Any


class PluginManifestSchema(BaseModel):
    """Validates a plugin manifest JSON against the required schema."""
    name: str
    display_name: str
    version: str
    description: str = ""
    tier: str = "lightweight"
    entry_point: str
    capabilities: dict[str, Any] = {}
    auth: dict[str, Any] = {}

    @field_validator("name")
    @classmethod
    def name_must_be_valid(cls, v: str) -> str:
        if not v.isidentifier() and "-" not in v and "." not in v:
            raise ValueError(f"Invalid plugin name: {v}")
        return v

    @field_validator("version")
    @classmethod
    def version_must_be_semver(cls, v: str) -> str:
        parts = v.split(".")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            raise ValueError(f"Version must be semver (e.g. 1.0.0), got: {v}")
        return v

    @field_validator("tier")
    @classmethod
    def tier_must_be_valid(cls, v: str) -> str:
        if v not in ("full", "lightweight"):
            raise ValueError(f"Tier must be 'full' or 'lightweight', got: {v}")
        return v

    @field_validator("entry_point")
    @classmethod
    def entry_point_must_be_module_path(cls, v: str) -> str:
        if not v or "." not in v:
            raise ValueError(f"Entry point must be a Python module path (e.g. my_plugin.main), got: {v}")
        return v


def validate_plugin_manifest(manifest: dict) -> tuple[bool, str | list[str]]:
    """Validate a plugin manifest. Returns (is_valid, errors_or_empty)."""
    try:
        PluginManifestSchema(**manifest)
        return True, []
    except Exception as e:
        errors = []
        if hasattr(e, "errors"):
            for err in e.errors():
                loc = " → ".join(str(l) for l in err.get("loc", []))
                errors.append(f"{loc}: {err.get('msg', str(e))}")
        else:
            errors.append(str(e))
        return False, errors
