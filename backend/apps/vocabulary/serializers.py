from rest_framework import serializers

from apps.dialogue.models import Message

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

    def validate_source_message(self, value: Message | None):
        if value is None:
            return value

        request = self.context.get("request")
        if request is None or value.session.user_id != request.user.id:
            raise serializers.ValidationError("Нельзя добавить фразу из чужого диалога.")
        return value
