from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Scenario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("company_name", models.CharField(max_length=255)),
                ("company_description", models.TextField(blank=True)),
                ("product_name", models.CharField(max_length=255)),
                ("product_description", models.TextField(blank=True)),
                ("user_role", models.CharField(max_length=255)),
                ("counterparty_role", models.CharField(max_length=255)),
                ("counterparty_description", models.TextField(blank=True)),
                ("negotiation_goal", models.TextField()),
                (
                    "difficulty",
                    models.CharField(
                        choices=[("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard")],
                        default="medium",
                        max_length=20,
                    ),
                ),
                ("extra_context", models.TextField(blank=True)),
                ("is_random", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
