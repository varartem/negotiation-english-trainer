from __future__ import annotations

from collections.abc import Callable
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

    def generate_random_scenario(self, counterparty_stance: str = "neutral") -> dict[str, Any]:
        return self._provider.generate_random_scenario(counterparty_stance=counterparty_stance)

    def stream_random_scenario(
        self,
        counterparty_stance: str = "neutral",
        on_field_delta: Callable[[str, str], None] | None = None,
    ) -> dict[str, Any]:
        provider = self._provider
        emit_field_delta = on_field_delta or (lambda _field, _delta: None)
        if hasattr(provider, "stream_random_scenario"):
            return provider.stream_random_scenario(
                counterparty_stance=counterparty_stance,
                on_field_delta=emit_field_delta,
            )

        scenario = provider.generate_random_scenario(counterparty_stance=counterparty_stance)
        for field in (
            "company_name",
            "company_description",
            "product_name",
            "product_description",
            "user_role",
            "counterparty_role",
            "counterparty_description",
            "negotiation_goal",
            "extra_context",
        ):
            value = str(scenario.get(field, "")).strip()
            if value:
                emit_field_delta(field, value)
        return scenario

    def generate_graph(self, scenario, max_depth: int = 6) -> dict[str, Any]:
        return self._provider.generate_graph(scenario=scenario, max_depth=max_depth)

    def evaluate_user_reply(self, session, message_content: str) -> dict[str, Any]:
        return self._provider.evaluate_user_reply(session=session, message_content=message_content)

    def generate_counterparty_reply(self, session, evaluation: dict[str, Any]) -> str:
        return self._provider.generate_counterparty_reply(session=session, evaluation=evaluation)

    def stream_counterparty_reply(
        self,
        session,
        evaluation: dict[str, Any],
        on_delta: Callable[[str], None],
    ) -> str:
        provider = self._provider
        if hasattr(provider, "stream_counterparty_reply"):
            return provider.stream_counterparty_reply(
                session=session,
                evaluation=evaluation,
                on_delta=on_delta,
            )

        reply = provider.generate_counterparty_reply(session=session, evaluation=evaluation)
        if reply:
            on_delta(reply)
        return reply

    def generate_ideal_answer(self, session) -> str:
        return self._provider.generate_ideal_answer(session=session)


@dataclass
class STTService:
    provider: str | None = None

    def transcribe(
        self,
        audio_file,
        *,
        language: str | None = None,
        context: str = "",
        progress_callback: Callable[[int, str, str], None] | None = None,
    ) -> str:
        provider = _stt_provider(_provider_name(self.provider, settings.STT_PROVIDER))
        return provider.transcribe(
            audio_file,
            language=language,
            context=context,
            progress_callback=progress_callback,
        )


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
        progress_callback: Callable[[int, str, str], None] | None = None,
    ) -> str:
        provider = _tts_provider(_provider_name(self.provider, settings.TTS_PROVIDER))
        return provider.synthesize(
            text,
            file_prefix=file_prefix,
            voice=voice,
            instruct=instruct,
            lang_code=lang_code,
            progress_callback=progress_callback,
        )
