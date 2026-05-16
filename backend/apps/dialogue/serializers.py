from rest_framework import serializers

from apps.negotiation_graph.serializers import NegotiationGraphSerializer
from apps.scenarios.serializers import ScenarioSerializer

from .models import DialogueSession, Evaluation, Message


class EvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evaluation
        fields = [
            "id",
            "message",
            "general_sentiment",
            "emotion",
            "pressure_level",
            "negotiation_move",
            "strategy_score",
            "english_score",
            "stage_fit_score",
            "feedback_json",
            "better_version",
            "created_at",
        ]
        read_only_fields = ["id", "message", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    evaluation = EvaluationSerializer(read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "session",
            "role",
            "node_id",
            "content",
            "audio_url",
            "evaluation",
            "created_at",
        ]
        read_only_fields = ["id", "session", "role", "node_id", "audio_url", "evaluation", "created_at"]


class DialogueSessionSerializer(serializers.ModelSerializer):
    scenario = ScenarioSerializer(read_only=True)
    graph = NegotiationGraphSerializer(read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = DialogueSession
        fields = [
            "id",
            "public_id",
            "scenario",
            "graph",
            "current_node_id",
            "status",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "scenario",
            "graph",
            "current_node_id",
            "status",
            "messages",
            "created_at",
            "updated_at",
        ]


class DialogueSessionSummarySerializer(serializers.ModelSerializer):
    scenario = ScenarioSerializer(read_only=True)

    class Meta:
        model = DialogueSession
        fields = [
            "id",
            "public_id",
            "scenario",
            "current_node_id",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class UserMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(trim_whitespace=True, allow_blank=False)
