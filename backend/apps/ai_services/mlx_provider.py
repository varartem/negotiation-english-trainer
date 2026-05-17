from __future__ import annotations

import contextlib
import io
import tempfile
import threading
import time
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


JSON_REPAIR_MIN_TOKENS = 1200
JSON_INCOMPLETE_REPAIR_MULTIPLIER = 2
SCENARIO_MAX_TOKENS = 1200
GRAPH_MAX_TOKENS = 3200


def _log_llm_event(message: str) -> None:
    print(f"[llm] {message}", flush=True)


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
                started_at = time.perf_counter()
                _log_llm_event(f"loading model: {settings.LLM_MODEL}")
                try:
                    from mlx_lm import load
                except Exception as exc:
                    raise AIServiceError(f"Не удалось импортировать mlx-lm: {exc}") from exc

                try:
                    self._llm_model, self._llm_tokenizer = load(settings.LLM_MODEL)
                except Exception as exc:
                    raise AIServiceError(f"Не удалось загрузить LLM {settings.LLM_MODEL}: {exc}") from exc
                _log_llm_event(f"model loaded in {time.perf_counter() - started_at:.2f}s")
            else:
                _log_llm_event("using cached model")
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

    def generate_random_scenario(self, counterparty_stance: str = "neutral") -> dict[str, Any]:
        payload = self._chat_json(
            prompts.scenario_prompt(counterparty_stance),
            max_tokens=SCENARIO_MAX_TOKENS,
        )
        return normalize_scenario(payload, counterparty_stance=counterparty_stance)

    def generate_graph(self, scenario, max_depth: int = 6) -> dict[str, Any]:
        payload = self._chat_json(
            prompts.graph_prompt(scenario, max_depth),
            max_tokens=GRAPH_MAX_TOKENS,
        )
        return normalize_graph(payload, max_depth=max_depth)

    def evaluate_user_reply(self, session, message_content: str) -> dict[str, Any]:
        started_at = time.perf_counter()
        _log_llm_event(f"evaluate_user_reply start session={session.id}")
        payload = self._chat_json(
            prompts.evaluation_prompt(session=session, message_content=message_content),
            max_tokens=1000,
        )
        normalized = normalize_evaluation(payload)
        if not normalized["better_version"]:
            _log_llm_event("evaluation missed better_version; generating ideal answer")
            normalized["better_version"] = self.generate_ideal_answer(session)
        _log_llm_event(f"evaluate_user_reply done in {time.perf_counter() - started_at:.2f}s")
        return normalized

    def generate_counterparty_reply(self, session, evaluation: dict[str, Any]) -> str:
        started_at = time.perf_counter()
        _log_llm_event(f"generate_counterparty_reply start session={session.id}")
        payload = self._chat_json(
            prompts.counterparty_prompt(session=session, evaluation=evaluation),
            max_tokens=300,
        )
        reply = normalize_text_field(payload, "reply")
        _log_llm_event(
            f"generate_counterparty_reply done in {time.perf_counter() - started_at:.2f}s chars={len(reply)}"
        )
        return reply

    def stream_counterparty_reply(
        self,
        session,
        evaluation: dict[str, Any],
        on_delta: Callable[[str], None],
    ) -> str:
        started_at = time.perf_counter()
        _log_llm_event(f"stream_counterparty_reply start session={session.id}")
        reply = self._chat_json_field_stream(
            prompts.counterparty_prompt(session=session, evaluation=evaluation),
            max_tokens=300,
            field="reply",
            on_delta=on_delta,
        )
        _log_llm_event(
            f"stream_counterparty_reply done in {time.perf_counter() - started_at:.2f}s chars={len(reply)}"
        )
        return reply

    def generate_ideal_answer(self, session) -> str:
        started_at = time.perf_counter()
        _log_llm_event(f"generate_ideal_answer start session={session.id}")
        payload = self._chat_json(prompts.ideal_answer_prompt(session), max_tokens=300)
        answer = normalize_text_field(payload, "ideal_answer")
        _log_llm_event(f"generate_ideal_answer done in {time.perf_counter() - started_at:.2f}s")
        return answer

    def _chat_json(self, user_prompt: str, max_tokens: int) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": prompts.JSON_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        raw = self._generate(messages, max_tokens=max_tokens)
        try:
            return parse_json_object(raw)
        except AIServiceError as exc:
            repair_tokens = _json_repair_token_budget(max_tokens, exc)
            _log_llm_event(
                f"json parse failed ({exc}); requesting JSON repair max_tokens={repair_tokens}"
            )
            repaired = self._generate(
                [
                    *messages,
                    {"role": "assistant", "content": raw[:4000]},
                    {
                        "role": "user",
                        "content": "Repair your previous answer. Return only one valid JSON object with the requested schema.",
                    },
                ],
                max_tokens=repair_tokens,
            )
            return parse_json_object(repaired)

    def _chat_json_field_stream(
        self,
        user_prompt: str,
        *,
        max_tokens: int,
        field: str,
        on_delta: Callable[[str], None],
    ) -> str:
        messages = [
            {"role": "system", "content": prompts.JSON_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        raw_parts: list[str] = []
        emitted = ""
        started_at = time.perf_counter()
        first_delta_logged = False
        for segment in self._generate_stream(messages, max_tokens=max_tokens):
            raw_parts.append(segment)
            field_prefix = _json_string_field_prefix("".join(raw_parts), field)
            if len(field_prefix) > len(emitted):
                delta = field_prefix[len(emitted) :]
                emitted = field_prefix
                if delta:
                    if not first_delta_logged:
                        first_delta_logged = True
                        _log_llm_event(
                            f"first streamed {field} delta after {time.perf_counter() - started_at:.2f}s"
                        )
                    on_delta(delta)

        raw = "".join(raw_parts)
        try:
            payload = parse_json_object(raw)
        except AIServiceError as exc:
            repair_tokens = _json_repair_token_budget(max_tokens, exc)
            _log_llm_event(
                f"streamed JSON parse failed ({exc}); requesting JSON repair max_tokens={repair_tokens}"
            )
            repaired = self._generate(
                [
                    *messages,
                    {"role": "assistant", "content": raw[:4000]},
                    {
                        "role": "user",
                        "content": "Repair your previous answer. Return only one valid JSON object with the requested schema.",
                    },
                ],
                max_tokens=repair_tokens,
            )
            payload = parse_json_object(repaired)

        final_text = normalize_text_field(payload, field)
        if final_text.startswith(emitted):
            final_delta = final_text[len(emitted) :]
            if final_delta:
                on_delta(final_delta)
        elif not emitted:
            on_delta(final_text)
        return final_text

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
                started_at = time.perf_counter()
                _log_llm_event(f"generate start max_tokens={max_tokens}")
                text = generate(
                    model,
                    tokenizer,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    verbose=False,
                    sampler=sampler,
                ).strip()
                _log_llm_event(
                    f"generate done in {time.perf_counter() - started_at:.2f}s chars={len(text)}"
                )
                return text
        except Exception as exc:
            raise AIServiceError(f"LLM {settings.LLM_MODEL} не смогла сгенерировать ответ: {exc}") from exc

    def _generate_stream(self, messages: list[dict[str, str]], max_tokens: int):
        model, tokenizer = self.runtime.llm()
        try:
            from mlx_lm import stream_generate
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
                started_at = time.perf_counter()
                _log_llm_event(f"stream_generate start max_tokens={max_tokens}")
                segments = 0
                for response in stream_generate(
                    model,
                    tokenizer,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    sampler=sampler,
                ):
                    if response.text:
                        segments += 1
                        yield response.text
                _log_llm_event(
                    f"stream_generate done in {time.perf_counter() - started_at:.2f}s segments={segments}"
                )
        except Exception as exc:
            raise AIServiceError(f"LLM {settings.LLM_MODEL} не смогла сгенерировать ответ: {exc}") from exc


def _json_string_field_prefix(text: str, field: str) -> str:
    key = f'"{field}"'
    key_index = text.find(key)
    if key_index == -1:
        return ""

    colon_index = text.find(":", key_index + len(key))
    if colon_index == -1:
        return ""

    index = colon_index + 1
    while index < len(text) and text[index].isspace():
        index += 1
    if index >= len(text) or text[index] != '"':
        return ""

    index += 1
    chars: list[str] = []
    while index < len(text):
        char = text[index]
        if char == '"':
            break
        if char != "\\":
            chars.append(char)
            index += 1
            continue

        if index + 1 >= len(text):
            break
        escaped = text[index + 1]
        if escaped in {'"', "\\", "/"}:
            chars.append(escaped)
            index += 2
        elif escaped == "b":
            chars.append("\b")
            index += 2
        elif escaped == "f":
            chars.append("\f")
            index += 2
        elif escaped == "n":
            chars.append("\n")
            index += 2
        elif escaped == "r":
            chars.append("\r")
            index += 2
        elif escaped == "t":
            chars.append("\t")
            index += 2
        elif escaped == "u":
            digits = text[index + 2 : index + 6]
            if len(digits) < 4:
                break
            try:
                chars.append(chr(int(digits, 16)))
            except ValueError:
                break
            index += 6
        else:
            break

    return "".join(chars)


def _json_repair_token_budget(max_tokens: int, error: AIServiceError) -> int:
    if "незавершённый JSON" in str(error):
        return max(max_tokens * JSON_INCOMPLETE_REPAIR_MULTIPLIER, JSON_REPAIR_MIN_TOKENS)
    return max(max_tokens, JSON_REPAIR_MIN_TOKENS)


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
