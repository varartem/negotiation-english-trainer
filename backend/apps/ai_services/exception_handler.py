from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .errors import AIServiceError


def ai_exception_handler(exc, context):
    if isinstance(exc, AIServiceError):
        return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return exception_handler(exc, context)
