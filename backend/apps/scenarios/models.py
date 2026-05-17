from django.db import models


class Scenario(models.Model):
    COUNTERPARTY_STANCE_OPEN = "open"
    COUNTERPARTY_STANCE_NEUTRAL = "neutral"
    COUNTERPARTY_STANCE_RESISTANT = "resistant"

    COUNTERPARTY_STANCE_CHOICES = [
        (COUNTERPARTY_STANCE_OPEN, "Open to negotiations"),
        (COUNTERPARTY_STANCE_NEUTRAL, "Neutral"),
        (COUNTERPARTY_STANCE_RESISTANT, "Not open to dialogue"),
    ]

    company_name = models.CharField(max_length=255)
    company_description = models.TextField(blank=True)
    product_name = models.CharField(max_length=255)
    product_description = models.TextField(blank=True)
    user_role = models.CharField(max_length=255)
    counterparty_role = models.CharField(max_length=255)
    counterparty_description = models.TextField(blank=True)
    negotiation_goal = models.TextField()
    counterparty_stance = models.CharField(
        max_length=20,
        choices=COUNTERPARTY_STANCE_CHOICES,
        default=COUNTERPARTY_STANCE_NEUTRAL,
    )
    extra_context = models.TextField(blank=True)
    is_random = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.company_name} - {self.product_name}"
