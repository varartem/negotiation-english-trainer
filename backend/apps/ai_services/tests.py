from __future__ import annotations

from django.test import SimpleTestCase

from .mlx_provider import MlxLLMProvider
from .schemas import parse_json_object


class ParseJsonObjectTests(SimpleTestCase):
    def test_repairs_missing_comma_between_object_fields(self) -> None:
        payload = parse_json_object(
            """
            {
              "general_sentiment": "neutral"
              "emotion": "neutral",
              "pressure_level": "low"
            }
            """
        )

        self.assertEqual(payload["general_sentiment"], "neutral")
        self.assertEqual(payload["emotion"], "neutral")

    def test_repairs_missing_comma_between_array_items(self) -> None:
        payload = parse_json_object(
            '{"feedback": ["Ask one focused question" "Confirm the budget"]}'
        )

        self.assertEqual(
            payload["feedback"],
            ["Ask one focused question", "Confirm the budget"],
        )

    def test_repairs_unescaped_double_quotes_inside_string_values(self) -> None:
        payload = parse_json_object(
            '{"feedback": ["Avoid saying "cheap"; use "cost-effective" instead."]}'
        )

        self.assertEqual(
            payload["feedback"],
            ['Avoid saying "cheap"; use "cost-effective" instead.'],
        )

    def test_repairs_trailing_commas(self) -> None:
        payload = parse_json_object(
            """
            {
              "reply": "That sounds useful.",
            }
            """
        )

        self.assertEqual(payload["reply"], "That sounds useful.")


class ChatJsonTextFieldTests(SimpleTestCase):
    def test_uses_partial_string_field_after_failed_json_repair(self) -> None:
        class PartialJsonProvider(MlxLLMProvider):
            def __init__(self) -> None:
                pass

            def _generate(self, messages, max_tokens: int) -> str:
                return '{"ideal_answer": "Could we align on proof first?'

        provider = PartialJsonProvider()

        answer = provider._chat_json_text_field(
            "prompt",
            max_tokens=10,
            field="ideal_answer",
        )

        self.assertEqual(answer, "Could we align on proof first?")
