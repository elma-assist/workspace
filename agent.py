"""Voice assistant: Voxtral STT → Mistral LLM → Voxtral TTS."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, TurnHandlingOptions
from livekit.plugins import mistralai, silero

load_dotenv(Path(__file__).with_name('.env.local'))

server = AgentServer()


def make_session() -> AgentSession:
    return AgentSession(
        stt=mistralai.STT(model=os.getenv('MISTRAL_STT_MODEL', 'voxtral-mini-latest')),
        llm=mistralai.LLM(model=os.getenv('MISTRAL_LLM_MODEL', 'mistral-small-latest')),
        tts=mistralai.TTS(
            model=os.getenv('MISTRAL_TTS_MODEL', 'voxtral-mini-tts-latest'),
            voice=os.getenv('MISTRAL_VOICE', 'en_paul_neutral'),
        ),
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(turn_detection='vad'),
    )


@server.rtc_session(agent_name='mistral-voice')
async def entrypoint(ctx: agents.JobContext):
    language = os.getenv('ASSISTANT_LANGUAGE', 'auto')
    language_instruction = (
        'Speak English or German. Match the language of the latest user message. '
        'Switch naturally when the user switches languages, and follow explicit language requests. '
        'Start with a brief English greeting mentioning that German is also available. '
        if language.lower() == 'auto'
        else f'Respond in {language}. '
    )
    session = make_session()
    await session.start(
        room=ctx.room,
        agent=Agent(instructions=(
            'You are a friendly voice assistant. Keep answers short and conversational, '
            'usually one to three sentences. Do not use Markdown, emojis or lists. '
            ) + language_instruction + (

            'Be honest about uncertainty. You cannot perform actions outside this conversation.'
        )),
    )
    await session.generate_reply(user_input='Hello! Briefly greet me and invite me to talk.')


if __name__ == '__main__':
    needs_key = any(arg in {'console', 'dev', 'start', 'connect'} for arg in sys.argv[1:])
    inspection = any(arg in {'--help', '--list-devices'} for arg in sys.argv[1:])
    if needs_key and not inspection and not os.getenv('MISTRAL_API_KEY', '').strip():
        sys.exit('Добавьте MISTRAL_API_KEY в /Users/anton/projects/gpt_live/.env.local')
    agents.cli.run_app(server)
