"""
A cap on request-body size, enforced before a handler reads anything.

Neither uvicorn nor FastAPI limits a body, so every endpoint here accepted one
of any size: a 20 MiB `trigger_metric` was taken by /dispatch-operational-alert,
kept twice in a process-global list and served back to every caller of /alerts,
and /upload-operational-csv read a whole body into memory before comparing it
with its own 5 MB limit. A body over the cap is refused with 413 — on its
declared Content-Length before a byte is read, or as soon as a streamed body
crosses the cap.
"""

from __future__ import annotations

import json


class _BodyTooLarge(Exception):
    pass


async def _send_413(send, max_bytes: int) -> None:
    body = json.dumps({
        "detail": f"Request body exceeds the {max_bytes // (1024 * 1024)} MB limit.",
    }).encode()
    await send({
        "type": "http.response.start",
        "status": 413,
        "headers": [(b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode())],
    })
    await send({"type": "http.response.body", "body": body})


class BodySizeLimit:
    """Pure ASGI middleware: refuse request bodies larger than `max_bytes`."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = None
                if declared is not None and declared > self.max_bytes:
                    await _send_413(send, self.max_bytes)
                    return

        received = 0
        started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not started:
                await _send_413(send, self.max_bytes)
