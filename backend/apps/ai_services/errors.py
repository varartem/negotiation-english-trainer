from __future__ import annotations


class AIServiceError(RuntimeError):
    """Base error raised by local AI providers."""


class AIProviderConfigurationError(AIServiceError):
    """Raised when an unknown or incomplete AI provider is configured."""
