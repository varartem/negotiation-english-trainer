from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings

from .errors import AIProviderConfigurationError
from .mlx_provider import MlxLLMProvider, MlxSTTProvider, MlxTTSProvider
from .mock import MockLLMProvider, MockSTTProvider, MockTTSProvider


def _provider_name(name: str | None, default: str) -> str:
    return (name or default).strip().lower()


def _llm_provider(name: str):
    if name == "mlx":
        return MlxLLMProvider()
    if name == "mock":
        return MockLLMProvider()
    raise AIProviderConfigurationError(f"Неизвестный LLM_PROVIDER={name!r}. Используйте mlx или mock.")


def _stt_provider(name: str):
    if name == "mlx":
        return MlxSTTProvider()
    if name == "mock":
        return MockSTTProvider()
    raise AIProviderConfigurationError(f"Неизвестный STT_PROVIDER={name!r}. Используйте mlx или mock.")


def _tts_provider(name: str):
    if name == "mlx":
        return MlxTTSProvider()
    if name == "mock":
        return MockTTSProvider()
    raise AIProviderConfigurationError(f"Неизвестный TTS_PROVIDER={name!r}. Используйте mlx или mock.")


@dataclass
class LLMService:
    provider: str | None = None

    @property
    def _provider(self):
        return _llm_provider(_provider_name(self.provider, settings.LLM_PROVIDER))

    def generate_random_scenario(self, difficulty: str = "medium") -> dict[str, Any]:
        return self._provider.generate_random_scenario(difficulty=difficulty)

    def generate_graph(self, scenario, max_depth: int = 6) -> dict[str, Any]:
        return self._provider.generate_graph(scenario=scenario, max_depth=max_depth)

    def evaluate_user_reply(self, session, message_content: str) -> dict[str, Any]:
        return self._provider.evaluate_user_reply(session=session, message_content=message_content)

    def generate_counterparty_reply(self, session, evaluation: dict[str, Any]) -> str:
        return self._provider.generate_counterparty_reply(session=session, evaluation=evaluation)

    def generate_ideal_answer(self, session) -> str:
        return self._provider.generate_ideal_answer(session=session)


@dataclass
class STTService:
    provider: str | None = None

    def transcribe(self, audio_file, *, language: str | None = None, context: str = "") -> str:
        provider = _stt_provider(_provider_name(self.provider, settings.STT_PROVIDER))
        return provider.transcribe(audio_file, language=language, context=context)


@dataclass
class TTSService:
    provider: str | None = None

    def synthesize(
        self,
        text: str,
        *,
        file_prefix: str | None = None,
        voice: str | None = None,
        instruct: str | None = None,
        lang_code: str | None = None,
    ) -> str:
        provider = _tts_provider(_provider_name(self.provider, settings.TTS_PROVIDER))
        return provider.synthesize(
            text,
            file_prefix=file_prefix,
            voice=voice,
            instruct=instruct,
            lang_code=lang_code,
        )
