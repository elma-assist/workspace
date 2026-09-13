"""Paid end-to-end voice check: synthetic speech -> WebRTC -> STT/RAG/LLM/TTS.

Uses existing provider keys locally; never writes credentials or tokens to reports.
"""

import asyncio
from array import array
import json
import os
import time
import re
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv
from livekit import rtc
from livekit.plugins import mistralai

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")
BASE_URL = os.environ.get("ELMA_TEST_URL", "http://localhost:8180").rstrip("/")
OUTPUT = ROOT / "artifacts" / ("production-voice" if BASE_URL.startswith("https://") else "local-voice")
OUTPUT.mkdir(parents=True, exist_ok=True)


async def synthesize(text: str) -> tuple[bytes, int]:
    engine = mistralai.TTS(model="voxtral-mini-tts-latest", voice="en_paul_neutral")
    chunks = []
    async with engine.synthesize(text) as stream:
        async for event in stream:
            chunks.append(bytes(event.frame.data))
    rate = engine.sample_rate
    await engine.aclose()
    return b"".join(chunks), rate


async def check(
    language: str,
    question: str,
    expected: str,
    form_values: dict[str, str] | None = None,
):
    pcm, rate = await synthesize(question)
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        pub = (await client.get("/api/demo")).json()["publication_id"]
        response = await client.post(
            f"/api/public/{pub}/sessions",
            json={"mode": "voice"},
            headers={"Origin": BASE_URL},
        )
        response.raise_for_status()
        session = response.json()
        room = rtc.Room()
        transcripts = []
        audio = bytearray()
        tasks = set()
        listening = asyncio.Event()
        answer = asyncio.Event()
        spoke = False
        started = 0.0
        first_audio = None

        async def text_stream(reader, identity):
            nonlocal spoke
            text = await reader.read_all()
            if identity.startswith("agent-"):
                transcripts.append(text)
                if spoke and re.search(expected, text, re.I):
                    answer.set()

        room.register_text_stream_handler(
            "lk.transcription",
            lambda reader, identity: asyncio.create_task(text_stream(reader, identity)),
        )

        @room.on("participant_attributes_changed")
        def attributes(changed, participant):
            if participant.attributes.get("lk.agent.state") == "listening":
                listening.set()

        async def read_audio(track):
            nonlocal first_audio
            async for event in rtc.AudioStream(
                track, sample_rate=24000, num_channels=1
            ):
                if (
                    spoke
                    and started > 0
                    and first_audio is None
                    and max(map(abs, array("h", bytes(event.frame.data))), default=0)
                    > 500
                ):
                    first_audio = time.monotonic()
                audio.extend(bytes(event.frame.data))

        @room.on("track_subscribed")
        def subscribed(track, publication, participant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                task = asyncio.create_task(read_audio(track))
                tasks.add(task)
                task.add_done_callback(tasks.discard)

        try:
            await room.connect(session["url"], session["token"])
            source = rtc.AudioSource(rate, 1)
            track = rtc.LocalAudioTrack.create_audio_track("test-microphone", source)
            await room.local_participant.publish_track(
                track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
            )
            await asyncio.wait_for(listening.wait(), 25)
            # Allow the short greeting to finish before injecting one utterance.
            await asyncio.sleep(7)
            audio.clear()
            spoke = True
            for offset in range(0, len(pcm), rate // 50 * 2):
                chunk = pcm[offset : offset + rate // 50 * 2]
                await source.capture_frame(
                    rtc.AudioFrame(chunk, rate, 1, len(chunk) // 2)
                )
            await source.wait_for_playout()
            started = time.monotonic()
            for _ in range(75):
                await source.capture_frame(
                    rtc.AudioFrame(bytes(rate // 50 * 2), rate, 1, rate // 50)
                )
            await asyncio.wait_for(answer.wait(), 40)
            await asyncio.sleep(2)
            if form_values:
                for attempt in range(45):
                    forms_response = await client.get(
                        f"/api/public/conversations/{session['id']}/requests",
                        headers={"X-Guest-Token": session["guest_token"]},
                    )
                    forms_response.raise_for_status()
                    drafts = forms_response.json()
                    if any(
                        all(
                            v.lower() in str(d["answers"].get(k, "")).lower()
                            for k, v in form_values.items()
                        )
                        for d in drafts
                    ):
                        break
                    await asyncio.sleep(1)
                else:
                    raise AssertionError("Spoken details did not reach the form draft")
            assert len(audio) > 24000, "No assistant audio received"
            await source.aclose()
        finally:
            await room.disconnect()
            for task in tasks:
                task.cancel()
        with wave.open(str(OUTPUT / f"voice-{language}.wav"), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(24000)
            out.writeframes(audio)
        await asyncio.sleep(2)
        detail = (
            await client.get(
                f"/api/public/conversations/{session['id']}",
                headers={"x-guest-token": session["guest_token"]},
            )
        ).json()
        assert any(m["role"] == "user" for m in detail["messages"]), (
            "STT transcript missing"
        )
        assert detail["sources"], "Knowledge retrieval missing"
        internal_markers = (
            "Reference excerpts",
            "Internal retrieval",
            "untrusted document content",
        )
        for text in transcripts + [
            message["content"] for message in detail["messages"]
        ]:
            assert not any(marker in text for marker in internal_markers), (
                "Private retrieval context leaked into transcript or stored history"
            )
        return {
            "language": language,
            "answer": transcripts[-1],
            "audio_bytes": len(audio),
            "first_audio_after_end_seconds": round(
                max(0, (first_audio or started) - started), 2
            ),
            "sources": len(detail["sources"]),
        }


async def main():
    results = []
    for case in [
        ("en", "What time is the next resident meeting?", "18|6:30|six.*thirty"),
        ("de", "Wann sind bei Nordhaus die Ruhezeiten?", "22|zehn"),
    ]:
        result = await check(*case)
        results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    (OUTPUT / "voice-check.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False)
    )


if __name__ == "__main__":
    asyncio.run(main())
