from rest_framework import generics

from apps.ai_services.errors import AIServiceError
from apps.ai_services.services import LLMService

from .models import VocabularyItem
from .serializers import VocabularyItemSerializer


class VocabularyListCreateView(generics.ListCreateAPIView):
    serializer_class = VocabularyItemSerializer

    def get_queryset(self):
        return VocabularyItem.objects.select_related("source_message").filter(user=self.request.user)

    def perform_create(self, serializer):
        phrase = serializer.validated_data["phrase"].strip()
        context = serializer.validated_data.get("context", "").strip()
        translation = serializer.validated_data.get("translation", "").strip()
        if translation:
            serializer.save(user=self.request.user, phrase=phrase, context=context, translation=translation)
            return

        try:
            translation = LLMService().translate_vocabulary_phrase(phrase, context=context)
        except AIServiceError as exc:
            raise AIServiceError(f"Не удалось перевести фразу для словаря: {exc}") from exc

        serializer.save(user=self.request.user, phrase=phrase, context=context, translation=translation.strip()[:255])


class VocabularyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = VocabularyItemSerializer

    def get_queryset(self):
        return VocabularyItem.objects.filter(user=self.request.user)
