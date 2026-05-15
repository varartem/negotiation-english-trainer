from rest_framework import generics

from .models import VocabularyItem
from .serializers import VocabularyItemSerializer


class VocabularyListCreateView(generics.ListCreateAPIView):
    queryset = VocabularyItem.objects.select_related("source_message")
    serializer_class = VocabularyItemSerializer


class VocabularyDeleteView(generics.DestroyAPIView):
    queryset = VocabularyItem.objects.all()
    serializer_class = VocabularyItemSerializer
