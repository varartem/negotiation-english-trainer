import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("scenarios", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="NegotiationGraph",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("max_depth", models.PositiveSmallIntegerField(default=6)),
                ("graph_json", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "scenario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="graphs",
                        to="scenarios.scenario",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
