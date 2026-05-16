from django.urls import path

from .views import synthesize_text, transcribe_audio


urlpatterns = [
    path("speech/transcribe/", transcribe_audio, name="speech-transcribe"),
    path("speech/synthesize/", synthesize_text, name="speech-synthesize"),
]
