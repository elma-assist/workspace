import json
import unittest
from uuid import uuid4
import httpx
from form_tools import FormTools


class IncrementalFormTest(unittest.IsolatedAsyncioTestCase):
    async def test_single_known_field_is_saved_without_other_required_fields(self):
        fid, rid = str(uuid4()), str(uuid4())
        calls = []
        draft = {
            "code": "A01",
            "id": rid,
            "form_id": fid,
            "revision": 3,
            "status": "draft",
            "snapshot": {
                "name": "Repair",
                "definition": {
                    "fields": [
                        {"id": "name", "kind": "text"},
                        {"id": "email", "kind": "email"},
                    ]
                },
            },
            "answers": {},
            "files": [],
        }

        def handler(r):
            data = json.loads(r.content)
            calls.append((r.url.path, data))
            if r.url.path.endswith("/answers"):
                draft["answers"] = data["answers"]
                draft["revision"] = 4
            return httpx.Response(200, json=draft)

        async with httpx.AsyncClient(
            base_url="http://api", transport=httpx.MockTransport(handler)
        ) as client:
            result = await FormTools.fill_form(
                FormTools(client, "/conversation"), fid, {"name": "Anton"}
            )
        self.assertEqual(
            calls[1],
            (
                f"/conversation/requests/{rid}/answers",
                {"revision": 3, "answers": {"name": "Anton"}},
            ),
        )
        self.assertEqual(result["answers"], {"name": "Anton"})
        self.assertEqual(result["request_code"], "A01")

    async def test_existing_manual_value_is_not_overwritten(self):
        draft = {
            "code": "A01",
            "id": str(uuid4()),
            "form_id": str(uuid4()),
            "revision": 3,
            "status": "draft",
            "snapshot": {"name": "Repair", "definition": {"fields": []}},
            "answers": {"name": "Manual value"},
            "files": [],
        }
        paths = []

        def handler(r):
            paths.append(r.url.path)
            return httpx.Response(200, json=draft)

        async with httpx.AsyncClient(
            base_url="http://api", transport=httpx.MockTransport(handler)
        ) as client:
            result = await FormTools.fill_form(
                FormTools(client, "/conversation"),
                draft["form_id"],
                {"name": "Overwrite"},
            )
        self.assertIn("error", result)
        self.assertEqual(paths, ["/conversation/requests"])

    async def test_explicit_correction_updates_only_requested_field(self):
        draft = {
            "code": "A01",
            "id": str(uuid4()),
            "form_id": str(uuid4()),
            "revision": 7,
            "status": "draft",
            "snapshot": {"name": "Repair", "definition": {"fields": []}},
            "answers": {"address": "Donkerstrasse 77", "name": "Anton"},
            "files": [],
        }
        patches = []

        def handler(r):
            if r.url.path.endswith("/answers"):
                data = json.loads(r.content)
                patches.append(data)
                draft["answers"].update(data["answers"])
                draft["revision"] += 1
            return httpx.Response(200, json=draft)

        async with httpx.AsyncClient(
            base_url="http://api", transport=httpx.MockTransport(handler)
        ) as client:
            result = await FormTools.fill_form(
                FormTools(client, "/conversation"),
                draft["form_id"],
                {"address": "Dunkerstrasse 77"},
                {"address": "Donkerstrasse 77"},
            )
        self.assertEqual(
            patches, [{"revision": 7, "answers": {"address": "Dunkerstrasse 77"}}]
        )
        self.assertEqual(
            result["answers"], {"address": "Dunkerstrasse 77", "name": "Anton"}
        )

    async def test_stale_correction_does_not_replace_newer_or_cleared_value(self):
        for current in ["Manually corrected address", ""]:
            with self.subTest(current=current):
                draft = {
                    "code": "A01",
                    "id": str(uuid4()),
                    "form_id": str(uuid4()),
                    "revision": 8,
                    "status": "draft",
                    "snapshot": {"name": "Repair", "definition": {"fields": []}},
                    "answers": {"address": current},
                    "files": [],
                }
                paths = []

                def handler(r):
                    paths.append(r.url.path)
                    return httpx.Response(200, json=draft)

                async with httpx.AsyncClient(
                    base_url="http://api", transport=httpx.MockTransport(handler)
                ) as client:
                    result = await FormTools.fill_form(
                        FormTools(client, "/conversation"),
                        draft["form_id"],
                        {"address": "Dunkerstrasse 77"},
                        {"address": "Donkerstrasse 77"},
                    )
                self.assertIn("error", result)
                self.assertEqual(paths, ["/conversation/requests"])
