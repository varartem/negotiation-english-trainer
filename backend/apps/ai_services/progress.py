from __future__ import annotations

import json
import queue
import threading
from collections.abc import Callable
from typing import Any

from django.db import close_old_connections
from django.http import StreamingHttpResponse


ProgressCallback = Callable[[int, str, str], None]
ProgressWorker = Callable[[ProgressCallback], dict[str, Any]]


def stream_progress_response(worker: ProgressWorker) -> StreamingHttpResponse:
    events: queue.Queue[dict[str, Any]] = queue.Queue()

    def emit(progress: int, stage: str, detail: str = "") -> None:
        events.put(
            {
                "type": "progress",
                "progress": max(0, min(100, progress)),
                "stage": stage,
                "detail": detail,
            }
        )

    def run_worker() -> None:
        close_old_connections()
        try:
            payload = worker(emit)
            events.put({"type": "done", "progress": 100, "stage": "done", "payload": payload})
        except Exception as exc:  # noqa: BLE001 - streamed errors must cross the response boundary.
            events.put({"type": "error", "progress": 100, "stage": "error", "message": str(exc)})
        finally:
            close_old_connections()

    threading.Thread(target=run_worker, daemon=True).start()

    def event_stream():
        while True:
            event = events.get()
            yield json.dumps(event, ensure_ascii=False) + "\n"
            if event["type"] in {"done", "error"}:
                break

    response = StreamingHttpResponse(event_stream(), content_type="application/x-ndjson")
    response["Cache-Control"] = "no-cache"
    return response
