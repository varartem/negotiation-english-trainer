import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("negotiation_graph", "0001_initial"),
        ("scenarios", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DialogueSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("current_node_id", models.CharField(max_length=120)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("success", "Success"),
                            ("dead_end", "Dead end"),
                            ("abandoned", "Abandoned"),
                        ],
                        default="active",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "graph",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="negotiation_graph.negotiationgraph",
                    ),
                ),
                (
                    "scenario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="scenarios.scenario",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Message",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("user", "User"),
                            ("assistant", "Assistant"),
                            ("tutor", "Tutor"),
                            ("system", "System"),
                        ],
                        max_length=20,
                    ),
                ),
                ("node_id", models.CharField(max_length=120)),
                ("content", models.TextField()),
                ("audio_url", models.URLField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="messages",
                        to="dialogue.dialoguesession",
                    ),
                ),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="Evaluation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "general_sentiment",
                    models.CharField(
                        choices=[("positive", "Positive"), ("neutral", "Neutral"), ("negative", "Negative")],
                        max_length=20,
                    ),
                ),
                (
                    "emotion",
                    models.CharField(
                        choices=[
                            ("anger", "Anger"),
                            ("fear", "Fear"),
                            ("sadness", "Sadness"),
                            ("surprise", "Surprise"),
                            ("joy", "Joy"),
                            ("disgust", "Disgust"),
                            ("neutral", "Neutral"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "pressure_level",
                    models.CharField(
                        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
                        max_length=20,
                    ),
                ),
                ("negotiation_move", models.CharField(max_length=80)),
                ("strategy_score", models.PositiveSmallIntegerField()),
                ("english_score", models.PositiveSmallIntegerField()),
                ("stage_fit_score", models.PositiveSmallIntegerField()),
                ("feedback_json", models.JSONField(default=dict)),
                ("better_version", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "message",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="evaluation",
                        to="dialogue.message",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
