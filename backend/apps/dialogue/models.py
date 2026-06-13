import uuid

from django.conf import settings
from django.db import models


class DialogueSession(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_SUCCESS = "success"
    STATUS_DEAD_END = "dead_end"
    STATUS_ABANDONED = "abandoned"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_DEAD_END, "Dead end"),
        (STATUS_ABANDONED, "Abandoned"),
    ]

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    scenario = models.ForeignKey(
        "scenarios.Scenario",
        related_name="sessions",
        on_delete=models.CASCADE,
    )
    graph = models.ForeignKey(
        "negotiation_graph.NegotiationGraph",
        related_name="sessions",
        on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="dialogue_sessions",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    current_node_id = models.CharField(max_length=120)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Session #{self.pk} ({self.status})"


class Message(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_TUTOR = "tutor"
    ROLE_SYSTEM = "system"

    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
        (ROLE_TUTOR, "Tutor"),
        (ROLE_SYSTEM, "System"),
    ]

    session = models.ForeignKey(
        DialogueSession,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    node_id = models.CharField(max_length=120)
    content = models.TextField()
    audio_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:40]}"


class Evaluation(models.Model):
    SENTIMENT_CHOICES = [
        ("positive", "Positive"),
        ("neutral", "Neutral"),
        ("negative", "Negative"),
    ]
    EMOTION_CHOICES = [
        ("anger", "Anger"),
        ("fear", "Fear"),
        ("sadness", "Sadness"),
        ("surprise", "Surprise"),
        ("joy", "Joy"),
        ("disgust", "Disgust"),
        ("neutral", "Neutral"),
    ]
    PRESSURE_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    message = models.OneToOneField(
        Message,
        related_name="evaluation",
        on_delete=models.CASCADE,
    )
    general_sentiment = models.CharField(max_length=20, choices=SENTIMENT_CHOICES)
    emotion = models.CharField(max_length=20, choices=EMOTION_CHOICES)
    pressure_level = models.CharField(max_length=20, choices=PRESSURE_CHOICES)
    negotiation_move = models.CharField(max_length=80)
    strategy_score = models.PositiveSmallIntegerField()
    english_score = models.PositiveSmallIntegerField()
    stage_fit_score = models.PositiveSmallIntegerField()
    feedback_json = models.JSONField(default=dict)
    better_version = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Evaluation for message #{self.message_id}"
