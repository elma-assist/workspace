import unittest
from widget_context import widget_greeting, widget_instructions
from contracts.models import RuntimeConfig


class WidgetContextTest(unittest.TestCase):
    def config(self, scenario):
        return RuntimeConfig.model_validate(dict(name="Tristar Service", instruction="Base instruction", kb_ids=[], version=1, mode="text", language="German", widget_context={"brand_name": "Tristar Hausmanagement", "assistant_name": "Tristar Service", "language": "de", "scenario": scenario, "demo": True})).model_dump(mode="json")

    def test_distinct_topics_and_formal_honest_greetings(self):
        greetings = set()
        for scenario in ("damage", "management_question", "management_inquiry"):
            config = self.config(scenario)
            greeting = widget_greeting(config)
            assert greeting is not None
            self.assertIn("Tristar Service", greeting)
            self.assertIn("Konzeptdemo", greeting)
            self.assertNotIn("Elma", greeting)
            greetings.add(greeting)
            instructions = widget_instructions(config)
            self.assertIn("not a message", instructions)
            self.assertIn("Sie", instructions)
            self.assertIn("without a successful real action", instructions)
        self.assertEqual(len(greetings), 3)

    def test_unbranded_config_has_no_override(self):
        self.assertIsNone(widget_greeting({}))
        self.assertEqual(widget_instructions({}), "")
