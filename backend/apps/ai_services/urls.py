from django.urls import path

from .views import synthesize_text, transcribe_audio, transcribe_audio_progress


urlpatterns = [
    path("speech/transcribe/", transcribe_audio, name="speech-transcribe"),
    path("speech/transcribe/progress/", transcribe_audio_progress, name="speech-transcribe-progress"),
    path("speech/synthesize/", synthesize_text, name="speech-synthesize"),
]
