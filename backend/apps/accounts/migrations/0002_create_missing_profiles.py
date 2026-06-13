from django.conf import settings
from django.db import migrations


def create_missing_profiles(apps, schema_editor):
    User = apps.get_model(settings.AUTH_USER_MODEL)
    AccountProfile = apps.get_model("accounts", "AccountProfile")
    existing_user_ids = set(AccountProfile.objects.values_list("user_id", flat=True))
    profiles = [
        AccountProfile(user_id=user_id)
        for user_id in User.objects.values_list("id", flat=True)
        if user_id not in existing_user_ids
    ]
    AccountProfile.objects.bulk_create(profiles)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_missing_profiles, migrations.RunPython.noop),
    ]
