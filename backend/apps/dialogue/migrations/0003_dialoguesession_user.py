from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("dialogue", "0002_dialoguesession_public_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="dialoguesession",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="dialogue_sessions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
