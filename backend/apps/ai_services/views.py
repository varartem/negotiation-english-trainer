from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .progress import stream_progress_response
from .services import STTService, TTSService


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def transcribe_audio(request):
    audio_file = request.FILES.get("audio")
    if audio_file is None:
        return Response({"detail": "Передайте аудио в multipart-поле audio."}, status=status.HTTP_400_BAD_REQUEST)

    text = STTService().transcribe(
        audio_file,
        language=request.data.get("language") or None,
        context=request.data.get("context", ""),
    )
    return Response({"text": text})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def transcribe_audio_progress(request):
    audio_file = request.FILES.get("audio")
    if audio_file is None:
        return Response({"detail": "Передайте аудио в multipart-поле audio."}, status=status.HTTP_400_BAD_REQUEST)

    language = request.data.get("language") or None
    context = request.data.get("context", "")

    def worker(emit):
        emit(4, "queued", "Запрос STT поставлен в очередь.")
        text = STTService().transcribe(
            audio_file,
            language=language,
            context=context,
            progress_callback=emit,
        )
        return {"text": text}

    return stream_progress_response(worker)


@api_view(["POST"])
def synthesize_text(request):
    text = str(request.data.get("text", "")).strip()
    if not text:
        return Response({"detail": "Передайте непустое поле text."}, status=status.HTTP_400_BAD_REQUEST)

    audio_url = TTSService().synthesize(
        text,
        voice=request.data.get("voice") or None,
        instruct=request.data.get("instruct") or None,
        lang_code=request.data.get("language") or None,
    )
    return Response({"audio_url": audio_url})
