"""Prometheus metrics for Media Basket."""
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response

# --- HTTP Metrics ---
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# --- Ingestion Metrics ---
ingestion_jobs_total = Counter(
    "ingestion_jobs_total",
    "Total ingestion jobs",
    ["connector_type", "status"],
)

ingestion_job_duration_seconds = Histogram(
    "ingestion_job_duration_seconds",
    "Ingestion job duration in seconds",
    ["connector_type"],
    buckets=[1, 5, 10, 30, 60, 120, 300],
)

# --- Vault Metrics ---
vault_access_total = Counter(
    "vault_access_total",
    "Total vault access operations",
    ["action", "org_id"],
)

# --- WebSocket Metrics ---
ws_connections_active = Gauge(
    "ws_connections_active",
    "Active WebSocket connections",
    ["org_id"],
)

# --- Service Metrics ---
services_connected = Gauge(
    "services_connected",
    "Number of connected services",
    ["connector_type"],
)

# --- Credential Metrics ---
credential_expiry_seconds = Gauge(
    "credential_expiry_seconds",
    "Seconds until credential expiry (per service)",
    ["service_id", "connector_type"],
)

# --- Plugin Metrics ---
plugin_load_total = Counter(
    "plugin_load_total",
    "Total plugin load attempts",
    ["plugin_name", "status"],
)

# --- Rate Limiting Metrics ---
rate_limit_remaining = Gauge(
    "rate_limit_remaining",
    "Remaining requests in current rate limit window",
    ["client_id", "path"],
)

rate_limit_total = Counter(
    "rate_limit_total",
    "Total rate limit rejections",
    ["client_id", "path"],
)

# --- Moderation Metrics ---
moderation_actions_total = Counter(
    "moderation_actions_total",
    "Total moderation actions",
    ["action", "connector_type"],
)

# --- Data Retention Metrics ---
data_retention_deleted_total = Counter(
    "data_retention_deleted_total",
    "Total items deleted by data retention policy",
    ["table_name"],
)


def metrics_endpoint() -> Response:
    """Return Prometheus metrics as a response."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
