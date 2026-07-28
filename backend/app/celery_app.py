from celery import Celery
from app.core.config import get_settings

settings = get_settings()

if settings.REDIS_URL:
    celery_app = Celery(
        "media_basket",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
        include=["app.tasks"],
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        beat_schedule={},
        task_remote_shutdown=True,
        worker_cancel_long_running_tasks_on_connection_loss=True,
    )
else:
    celery_app = None

import json
from uuid import UUID
from datetime import datetime


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


original_dumps = json.dumps


def patched_dumps(*args, **kwargs):
    kwargs.setdefault("cls", UUIDEncoder)
    return original_dumps(*args, **kwargs)


json.dumps = patched_dumps
