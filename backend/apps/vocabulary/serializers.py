from rest_framework import serializers

from .models import VocabularyItem


class VocabularyItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VocabularyItem
        fields = [
            "id",
            "phrase",
            "translation",
            "context",
            "source_message",
            "user_note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
