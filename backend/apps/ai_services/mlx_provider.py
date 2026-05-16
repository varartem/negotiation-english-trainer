from __future__ import annotations

import contextlib
import io
import tempfile
import threading
import uuid
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings

from . import prompts
from .errors import AIServiceError
from .schemas import (
    normalize_evaluation,
    normalize_graph,
    normalize_scenario,
    normalize_text_field,
    parse_json_object,
)


class MlxRuntime:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.llm_inference_lock = threading.Lock()
        self.tts_inference_lock = threading.Lock()
        self.asr_inference_lock = threading.Lock()
        self._llm_model = None
        self._llm_tokenizer = None
        self._tts_model = None
        self._asr_session = None

    def llm(self):
        with self._lock:
            if self._llm_model is None or self._llm_tokenizer is None:
                try:
                    from mlx_lm import load
                except Exception as exc:
                    raise AIServiceError(f"Не удалось импортировать mlx-lm: {exc}") from exc

                try:
                    self._llm_model, self._llm_tokenizer = load(settings.LLM_MODEL)
                except Exception as exc:
                    raise AIServiceError(f"Не удалось загрузить LLM {settings.LLM_MODEL}: {exc}") from exc
            return self._llm_model, self._llm_tokenizer

    def tts_model(self):
        with self._lock:
            if self._tts_model is None:
                try:
                    from mlx_audio.tts.utils import load_model
                except Exception as exc:
                    raise AIServiceError(f"Не удалось импортировать mlx-audio: {exc}") from exc

                try:
                    self._tts_model = load_model(settings.TTS_MODEL)
                except Exception as exc:
                    raise AIServiceError(f"Не удалось загрузить TTS {settings.TTS_MODEL}: {exc}") from exc
            return self._tts_model

    def asr_session(self):
        with self._lock:
            if self._asr_session is None:
                try:
                    from mlx_qwen3_asr import Session
                except Exception as exc:
                    raise AIServiceError(f"Не удалось импортировать mlx-qwen3-asr: {exc}") from exc

                try:
                    self._asr_session = Session(model=settings.STT_MODEL)
                except Exception as exc:
                    raise AIServiceError(f"Не удалось загрузить STT {settings.STT_MODEL}: {exc}") from exc
            return self._asr_session


@lru_cache(maxsize=1)
def get_mlx_runtime() -> MlxRuntime:
    return MlxRuntime()


class MlxLLMProvider:
    def __init__(self, runtime: MlxRuntime | None = None) -> None:
        self.runtime = runtime or get_mlx_runtime()

    def generate_random_scenario(self, difficulty: str = "medium") -> dict[str, Any]:
        payload = self._chat_json(prompts.scenario_prompt(difficulty), max_tokens=900)
        return normalize_scenario(payload, difficulty=difficulty)

    def generate_graph(self, scenario, max_depth: int = 6) -> dict[str, Any]:
        payload = self._chat_json(prompts.graph_prompt(scenario, max_depth), max_tokens=1800)
        return normalize_graph(payload, max_depth=max_depth)

    def evaluate_user_reply(self, session, message_content: str) -> dict[str, Any]:
        payload = self._chat_json(
            prompts.evaluation_prompt(session=session, message_content=message_content),
            max_tokens=1000,
        )
        normalized = normalize_evaluation(payload)
        if not normalized["better_version"]:
            normalized["better_version"] = self.generate_ideal_answer(session)
        return normalized

    def generate_counterparty_reply(self, session, evaluation: dict[str, Any]) -> str:
        payload = self._chat_json(
            prompts.counterparty_prompt(session=session, evaluation=evaluation),
            max_tokens=300,
        )
        return normalize_text_field(payload, "reply")

    def generate_ideal_answer(self, session) -> str:
        payload = self._chat_json(prompts.ideal_answer_prompt(session), max_tokens=300)
        return normalize_text_field(payload, "ideal_answer")

    def _chat_json(self, user_prompt: str, max_tokens: int) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": prompts.JSON_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        raw = self._generate(messages, max_tokens=max_tokens)
        try:
            return parse_json_object(raw)
        except AIServiceError:
            repaired = self._generate(
                [
                    *messages,
                    {"role": "assistant", "content": raw[:4000]},
                    {
                        "role": "user",
                        "content": "Repair your previous answer. Return only one valid JSON object with the requested schema.",
                    },
                ],
                max_tokens=max_tokens,
            )
            return parse_json_object(repaired)

    def _generate(self, messages: list[dict[str, str]], max_tokens: int) -> str:
        model, tokenizer = self.runtime.llm()
        try:
            from mlx_lm import generate
            from mlx_lm.sample_utils import make_sampler
        except Exception as exc:
            raise AIServiceError(f"Не удалось импортировать генератор mlx-lm: {exc}") from exc

        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
        sampler = make_sampler(
            settings.LLM_TEMPERATURE,
            settings.LLM_TOP_P,
            0.0,
            1,
            top_k=settings.LLM_TOP_K,
        )
        try:
            with self.runtime.llm_inference_lock:
                return generate(
                    model,
                    tokenizer,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    verbose=False,
                    sampler=sampler,
                ).strip()
        except Exception as exc:
            raise AIServiceError(f"LLM {settings.LLM_MODEL} не смогла сгенерировать ответ: {exc}") from exc


class MlxSTTProvider:
    def __init__(self, runtime: MlxRuntime | None = None) -> None:
        self.runtime = runtime or get_mlx_runtime()

    def transcribe(
        self,
        audio_file,
        *,
        language: str | None = None,
        context: str = "",
        progress_callback: Callable[[int, str, str], None] | None = None,
    ) -> str:
        progress = progress_callback or (lambda _progress, _stage, _detail="": None)
        temp_path: Path | None = None
        try:
            progress(8, "preparing_audio", "Подготавливаем запись для STT.")
            audio_path = self._materialize_audio(audio_file)
            temp_path = audio_path if hasattr(audio_file, "chunks") else None
            progress(24, "loading_model", "Загружаем STT-модель.")
            session = self.runtime.asr_session()
            progress(48, "transcribing", "STT-модель распознает речь.")
            with self.runtime.asr_inference_lock:
                result = session.transcribe(
                    audio_path,
                    language=language or settings.STT_LANGUAGE or None,
                    context=context or settings.STT_CONTEXT,
                    verbose=False,
                )
            progress(92, "normalizing_text", "Готовим распознанный текст.")
            return result.text.strip()
        except AIServiceError:
            raise
        except Exception as exc:
            raise AIServiceError(f"STT {settings.STT_MODEL} не смогла распознать аудио: {exc}") from exc
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)

    def _materialize_audio(self, audio_file) -> Path:
        if isinstance(audio_file, (str, Path)):
            return Path(audio_file)

        suffix = Path(getattr(audio_file, "name", "")).suffix or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as target:
            for chunk in audio_file.chunks():
                target.write(chunk)
            return Path(target.name)


class MlxTTSProvider:
    def __init__(self, runtime: MlxRuntime | None = None) -> None:
        self.runtime = runtime or get_mlx_runtime()

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
        progress = progress_callback or (lambda _progress, _stage, _detail="": None)
        cleaned = text.strip()
        if not cleaned:
            raise AIServiceError("Нельзя озвучить пустой текст.")

        progress(8, "preparing_text", "Подготавливаем текст для TTS.")
        output_dir = Path(settings.MEDIA_ROOT) / "tts"
        output_dir.mkdir(parents=True, exist_ok=True)
        safe_prefix = file_prefix or f"tts_{uuid.uuid4().hex}"
        output_file = output_dir / f"{safe_prefix}.wav"
        progress(22, "loading_model", "Загружаем TTS-модель.")
        model = self.runtime.tts_model()
        progress(42, "loading_generator", "Готовим генератор аудио.")

        try:
            from mlx_audio.tts.generate import generate_audio
        except Exception as exc:
            raise AIServiceError(f"Не удалось импортировать генератор mlx-audio: {exc}") from exc

        progress(58, "synthesizing_audio", "TTS-модель создает аудио.")
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            with self.runtime.tts_inference_lock:
                generate_audio(
                    text=cleaned,
                    model=model,
                    voice=voice or settings.TTS_VOICE,
                    instruct=instruct or settings.TTS_INSTRUCT,
                    lang_code=lang_code or settings.TTS_LANGUAGE,
                    output_path=str(output_dir),
                    file_prefix=safe_prefix,
                    audio_format="wav",
                    join_audio=True,
                    play=False,
                    verbose=False,
                )

        progress(94, "finalizing_audio", "Проверяем готовый аудиофайл.")
        if not output_file.exists():
            details = stdout.getvalue().strip()
            raise AIServiceError(f"TTS {settings.TTS_MODEL} не создала аудиофайл. {details}")

        media_url = settings.MEDIA_URL.rstrip("/")
        return f"{media_url}/tts/{output_file.name}"
