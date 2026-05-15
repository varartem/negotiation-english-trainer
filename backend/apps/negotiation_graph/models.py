from django.db import models


class NegotiationGraph(models.Model):
    scenario = models.ForeignKey(
        "scenarios.Scenario",
        related_name="graphs",
        on_delete=models.CASCADE,
    )
    max_depth = models.PositiveSmallIntegerField(default=6)
    graph_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Graph #{self.pk} for scenario #{self.scenario_id}"
