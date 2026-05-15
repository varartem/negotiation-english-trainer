from django.db import models


class Scenario(models.Model):
    DIFFICULTY_EASY = "easy"
    DIFFICULTY_MEDIUM = "medium"
    DIFFICULTY_HARD = "hard"

    DIFFICULTY_CHOICES = [
        (DIFFICULTY_EASY, "Easy"),
        (DIFFICULTY_MEDIUM, "Medium"),
        (DIFFICULTY_HARD, "Hard"),
    ]

    company_name = models.CharField(max_length=255)
    company_description = models.TextField(blank=True)
    product_name = models.CharField(max_length=255)
    product_description = models.TextField(blank=True)
    user_role = models.CharField(max_length=255)
    counterparty_role = models.CharField(max_length=255)
    counterparty_description = models.TextField(blank=True)
    negotiation_goal = models.TextField()
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default=DIFFICULTY_MEDIUM,
    )
    extra_context = models.TextField(blank=True)
    is_random = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.company_name} - {self.product_name}"
