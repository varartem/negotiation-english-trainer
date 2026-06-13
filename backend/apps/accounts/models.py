from django.conf import settings
from django.db import models


class AccountProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="profile",
        on_delete=models.CASCADE,
    )
    photo = models.FileField(upload_to="account_photos/", blank=True)

    def __str__(self) -> str:
        return f"Profile for {self.user}"
