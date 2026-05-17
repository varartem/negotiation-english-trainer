from django.db import migrations, models


def forwards(apps, schema_editor):
    Scenario = apps.get_model("scenarios", "Scenario")
    value_map = {
        "easy": "open",
        "medium": "neutral",
        "hard": "resistant",
    }
    for old_value, new_value in value_map.items():
        Scenario.objects.filter(counterparty_stance=old_value).update(counterparty_stance=new_value)


def backwards(apps, schema_editor):
    Scenario = apps.get_model("scenarios", "Scenario")
    value_map = {
        "open": "easy",
        "neutral": "medium",
        "resistant": "hard",
    }
    for old_value, new_value in value_map.items():
        Scenario.objects.filter(counterparty_stance=old_value).update(counterparty_stance=new_value)


class Migration(migrations.Migration):
    dependencies = [
        ("scenarios", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="scenario",
            old_name="difficulty",
            new_name="counterparty_stance",
        ),
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="scenario",
            name="counterparty_stance",
            field=models.CharField(
                choices=[
                    ("open", "Open to negotiations"),
                    ("neutral", "Neutral"),
                    ("resistant", "Not open to dialogue"),
                ],
                default="neutral",
                max_length=20,
            ),
        ),
    ]
