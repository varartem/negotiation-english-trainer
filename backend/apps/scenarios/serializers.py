from rest_framework import serializers

from .models import Scenario


class ScenarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Scenario
        fields = [
            "id",
            "company_name",
            "company_description",
            "product_name",
            "product_description",
            "user_role",
            "counterparty_role",
            "counterparty_description",
            "negotiation_goal",
            "difficulty",
            "extra_context",
            "is_random",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_random", "created_at", "updated_at"]
