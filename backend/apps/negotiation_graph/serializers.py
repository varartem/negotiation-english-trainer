from rest_framework import serializers

from .models import NegotiationGraph


class NegotiationGraphSerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationGraph
        fields = ["id", "scenario", "max_depth", "graph_json", "created_at"]
        read_only_fields = ["id", "created_at"]
