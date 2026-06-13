from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vocabulary", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="vocabularyitem",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vocabulary_items",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
