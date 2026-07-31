"""Dynamic plugin loader using importlib for loading third-party connectors."""
import importlib
import importlib.util
import os
import sys
from typing import Type
from app.connectors.base import ConnectorPlugin, ConnectorManifest
from app.core.logging import get_logger

logger = get_logger("plugin_loader")

# In-memory cache of loaded plugin classes
_loaded_plugins: dict[str, Type[ConnectorPlugin]] = {}


def load_plugin_from_path(entry_point: str, plugin_name: str) -> Type[ConnectorPlugin] | None:
    """Load a plugin class from a Python module path.

    entry_point format: "my_package.connector:MyConnector"
    or just module path: "my_package.connector" (looks for Connector attribute)
    """
    cache_key = f"{plugin_name}:{entry_point}"
    if cache_key in _loaded_plugins:
        return _loaded_plugins[cache_key]

    try:
        if ":" in entry_point:
            module_path, class_name = entry_point.rsplit(":", 1)
        else:
            module_path = entry_point
            class_name = "Connector"

        # Handle file-based plugins (e.g., ./connector.py)
        if module_path.startswith("./") or module_path.startswith(".\\"):
            file_path = os.path.abspath(module_path)
            if not os.path.exists(file_path):
                logger.error("plugin_file_not_found", path=file_path, plugin=plugin_name)
                return None

            spec = importlib.util.spec_from_file_location(
                f"media_basket_plugin_{plugin_name}", file_path
            )
            if not spec or not spec.loader:
                logger.error("plugin_spec_failed", path=file_path, plugin=plugin_name)
                return None

            module = importlib.util.module_from_spec(spec)
            sys.modules[module.__name__] = module
            spec.loader.exec_module(module)
        else:
            module = importlib.import_module(module_path)

        connector_class = getattr(module, class_name, None)
        if not connector_class:
            logger.error("plugin_class_not_found", module=module_path, class_name=class_name, plugin=plugin_name)
            return None

        if not issubclass(connector_class, ConnectorPlugin):
            logger.error("plugin_not_connector_plugin", plugin=plugin_name)
            return None

        _loaded_plugins[cache_key] = connector_class
        logger.info("plugin_loaded", plugin=plugin_name, module=module_path, class_name=class_name)
        return connector_class

    except Exception as e:
        logger.error("plugin_load_failed", plugin=plugin_name, error=str(e))
        return None


def instantiate_plugin(connector_class: Type[ConnectorPlugin]) -> ConnectorPlugin:
    """Create an instance of a plugin connector."""
    return connector_class()


def unload_plugin(plugin_name: str, entry_point: str) -> bool:
    """Remove a plugin from the cache."""
    cache_key = f"{plugin_name}:{entry_point}"
    if cache_key in _loaded_plugins:
        del _loaded_plugins[cache_key]
        logger.info("plugin_unloaded", plugin=plugin_name)
        return True
    return False


def get_loaded_plugins() -> dict[str, Type[ConnectorPlugin]]:
    """Return all currently loaded plugin classes."""
    return dict(_loaded_plugins)
