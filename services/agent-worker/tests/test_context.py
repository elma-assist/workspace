import json
import unittest
import threading
from unittest.mock import patch

import httpx
from livekit.agents import Agent, ModelSettings, llm
from worker import Assistant


class KnowledgeTurnTest(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, context, response, selected=None):
        queries = []
        captured = []

        def search(request):
            if request.url.path.endswith("/active-request"):
                return httpx.Response(200, json={"request": selected})
            queries.append(json.loads(request.content)["query"])
            return response

        async def generate(agent, chat_ctx, tools, settings):
            captured.append(chat_ctx)
            yield "The meeting is at 18:30."

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(search), base_url="http://api"
        ) as client:
            agent = Assistant(
                {
                    "language": "auto",
                    "instruction": "Help residents.",
                    "tts_provider": "mistral",
                },
                client,
                "/test",
            )
            with patch.object(Agent.default, "llm_node", generate):
                chunks = [
                    chunk
                    async for chunk in agent.llm_node(context, [], ModelSettings())
                ]
        self.assertEqual(chunks, ["The meeting is at 18:30."])
        return captured[0], queries

    def context(self):
        context = llm.ChatContext()
        context.add_message(
            role="system", content="Help residents. English or German only."
        )
        context.add_message(role="assistant", content="Hello!")
        context.add_message(role="user", content="When is the meeting?")
        return context

    async def test_retrieval_only_reaches_model_not_shared_messages(self):
        context = self.context()
        original = context.to_dict()
        model, queries = await self.invoke(
            context,
            httpx.Response(
                200,
                json={
                    "sources": [
                        {"name": "Handbook", "excerpt": "The meeting is at 18:30."}
                    ]
                },
            ),
        )
        self.assertEqual(queries, ["When is the meeting?"])
        self.assertEqual(context.to_dict(), original)
        self.assertEqual(len(model.items), len(context.items))
        entries, metadata = model.to_provider_format(format="mistralai")
        self.assertEqual(
            metadata.instructions, "Help residents. English or German only."
        )
        self.assertEqual(entries[-1]["role"], "user")
        self.assertIn("When is the meeting?", entries[-1]["content"])
        self.assertIn("18:30", entries[-1]["content"])
        self.assertIn("untrusted", entries[-1]["content"])
        self.assertEqual(
            [e["content"] for e in entries if e["role"] == "assistant"], ["Hello!"]
        )

    async def test_context_with_runtime_lock_is_not_deepcopied(self):
        context = self.context()
        message = context.items[-1]
        assert isinstance(message, llm.ChatMessage)
        message.__pydantic_private__ = {"runtime_lock": threading.RLock()}
        original = list(message.content)
        model, _ = await self.invoke(
            context,
            httpx.Response(
                200,
                json={
                    "sources": [{"name": "Handbook", "excerpt": "Meeting at 18:30."}]
                },
            ),
        )
        self.assertEqual(message.content, original)
        last = model.items[-1]
        assert isinstance(last, llm.ChatMessage)
        self.assertIsNot(last.content, message.content)

    async def test_retrieval_failure_is_private_too(self):
        context = self.context()
        original = context.to_dict()
        model, _ = await self.invoke(context, httpx.Response(503))
        self.assertEqual(context.to_dict(), original)
        self.assertIn("unavailable", model.items[-1].text_content)
        self.assertEqual(model.items[-1].role, "user")

    async def test_empty_results_leave_context_unchanged(self):
        context = self.context()
        model, _ = await self.invoke(context, httpx.Response(200, json={"sources": []}))
        self.assertEqual(model.to_dict(), context.to_dict())

    async def test_selected_request_is_private_and_refreshed_each_turn(self):
        context = self.context()
        original = context.to_dict()
        selected = {
            "id": "selected-request",
            "code": "A01",
            "form_id": "repair-form",
            "revision": 2,
            "status": "draft",
            "answers": {"name": "Anton"},
            "snapshot": {"name": "Repair", "definition": {"fields": []}},
        }
        model, _ = await self.invoke(
            context, httpx.Response(200, json={"sources": []}), selected
        )
        self.assertEqual(context.to_dict(), original)
        self.assertIn("selected-request", model.items[-1].text_content)
        self.assertIn("Anton", model.items[-1].text_content)
        self.assertIn("A01", model.items[-1].text_content)
        selected["id"] = "another-request"
        refreshed, _ = await self.invoke(
            context, httpx.Response(200, json={"sources": []}), selected
        )
        self.assertIn("another-request", refreshed.items[-1].text_content)
        self.assertNotIn("selected-request", refreshed.items[-1].text_content)
        self.assertEqual(context.to_dict(), original)

    async def test_greeting_does_not_query_knowledge(self):
        context = llm.ChatContext()
        context.add_message(role="system", content="Help residents.")
        model, queries = await self.invoke(
            context, httpx.Response(200, json={"sources": []})
        )
        self.assertEqual(queries, [])
        self.assertEqual(model.to_dict(), context.to_dict())

    async def test_followup_does_not_reuse_old_excerpts(self):
        context = self.context()
        await self.invoke(
            context,
            httpx.Response(
                200,
                json={
                    "sources": [
                        {"name": "Handbook", "excerpt": "The meeting is at 18:30."}
                    ]
                },
            ),
        )
        context.add_message(role="assistant", content="The meeting is at 18:30.")
        context.add_message(role="user", content="What are the office hours?")
        model, queries = await self.invoke(
            context,
            httpx.Response(
                200, json={"sources": [{"name": "Office", "excerpt": "Open at 09:00."}]}
            ),
        )
        self.assertEqual(queries, ["What are the office hours?"])
        self.assertNotIn("Handbook", str(model.to_dict()))
        self.assertIn("Office", model.items[-1].text_content)


if __name__ == "__main__":
    unittest.main()
