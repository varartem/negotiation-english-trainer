from django.conf import settings
from django.db import models


class VocabularyItem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="vocabulary_items",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    phrase = models.CharField(max_length=255)
    translation = models.CharField(max_length=255, blank=True)
    context = models.TextField(blank=True)
    source_message = models.ForeignKey(
        "dialogue.Message",
        related_name="vocabulary_items",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    user_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.phrase
