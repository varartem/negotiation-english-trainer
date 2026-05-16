import uuid

from django.db import migrations, models


def populate_public_ids(apps, _schema_editor):
    DialogueSession = apps.get_model("dialogue", "DialogueSession")
    for session in DialogueSession.objects.filter(public_id__isnull=True):
        session.public_id = uuid.uuid4()
        session.save(update_fields=["public_id"])


class Migration(migrations.Migration):
    dependencies = [
        ("dialogue", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="dialoguesession",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="dialoguesession",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
