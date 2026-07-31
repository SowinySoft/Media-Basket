"""OpenTelemetry tracing setup for Media Basket."""
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def setup_tracing(app_name: str = "media-basket") -> trace.Tracer:
    """Initialize OpenTelemetry tracing and return a tracer."""
    resource = Resource.create({SERVICE_NAME: app_name})
    provider = TracerProvider(resource=resource)

    # Console exporter for dev; swap for OTLP exporter in production
    exporter = ConsoleSpanExporter()
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)
    return trace.get_tracer(app_name)


def instrument_fastapi(app):
    """Instrument a FastAPI app with OpenTelemetry."""
    FastAPIInstrumentor.instrument_app(app)
