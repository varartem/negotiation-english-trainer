from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("scenarios", "0002_counterparty_stance"),
    ]

    operations = [
        migrations.AddField(
            model_name="scenario",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scenarios",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
