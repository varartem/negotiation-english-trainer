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

    def test_repairs_escaped_string_value_delimiters_before_extraction(self) -> None:
        payload = parse_json_object(
            r'{"ideal_answer": \"I understand your caution. Could we review the ROI analysis first?\"}'
        )

        self.assertEqual(
            payload["ideal_answer"],
            "I understand your caution. Could we review the ROI analysis first?",
        )

    def test_repairs_escaped_object_keys_and_string_value_delimiters(self) -> None:
        payload = parse_json_object(
            r'{\"ideal_answer\": \"Could we review the ROI analysis first?\"}'
        )

        self.assertEqual(payload["ideal_answer"], "Could we review the ROI analysis first?")

    def test_preserves_escaped_quotes_inside_valid_strings(self) -> None:
        payload = parse_json_object(
            r'{"feedback": ["Avoid saying \"cheap\"; use \"cost-effective\" instead."]}'
        )

        self.assertEqual(
            payload["feedback"],
            ['Avoid saying "cheap"; use "cost-effective" instead.'],
        )


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


class ChatPlainTextTests(SimpleTestCase):
    def test_returns_plain_text_response(self) -> None:
        class PlainTextProvider(MlxLLMProvider):
            def __init__(self) -> None:
                pass

            def _generate(self, messages, max_tokens: int) -> str:
                return "Could we review the ROI analysis first?"

        provider = PlainTextProvider()

        answer = provider._chat_plain_text("prompt", max_tokens=10)

        self.assertEqual(answer, "Could we review the ROI analysis first?")

    def test_uses_json_fallback_for_legacy_ideal_answer_shape(self) -> None:
        class LegacyJsonProvider(MlxLLMProvider):
            def __init__(self) -> None:
                pass

            def _generate(self, messages, max_tokens: int) -> str:
                return r'{"ideal_answer": \"Could we review the ROI analysis first?\"}'

        provider = LegacyJsonProvider()

        answer = provider._chat_plain_text(
            "prompt",
            max_tokens=10,
            fallback_json_field="ideal_answer",
        )

        self.assertEqual(answer, "Could we review the ROI analysis first?")

    def test_uses_partial_fallback_for_escaped_legacy_field(self) -> None:
        class EscapedPartialJsonProvider(MlxLLMProvider):
            def __init__(self) -> None:
                pass

            def _generate(self, messages, max_tokens: int) -> str:
                return r'{\"ideal_answer\": \"Could we review the ROI analysis first?'

        provider = EscapedPartialJsonProvider()

        answer = provider._chat_plain_text(
            "prompt",
            max_tokens=10,
            fallback_json_field="ideal_answer",
        )

        self.assertEqual(answer, "Could we review the ROI analysis first?")
