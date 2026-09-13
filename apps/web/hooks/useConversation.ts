"use client";
import { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, Track, RemoteParticipant } from "livekit-client";
import { observeAudioLevels } from "./audioLevels";
import { Session, Message } from "../lib/api";
export function useConversation(session: Session) {
  const [mode, setMode] = useState(session.mode),
    [messages, setMessages] = useState<Message[]>(session.messages ?? []),
    [state, setState] = useState("Connecting"),
    [input, setInput] = useState(""),
    [muted, setMuted] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState(false),
    [switching, setSwitching] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [levels, setLevels] = useState({ user: 0, agent: 0 });
  const room = useRef<Room | null>(null),
    audio = useRef<HTMLDivElement>(null),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMessages(session.messages ?? []);
    const r = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { stopMicTrackOnMute: true },
    });
    room.current = r;
    setMicrophoneEnabled(false);
    const updateMicrophone = () =>
      setMicrophoneEnabled(r.localParticipant.isMicrophoneEnabled);
    r.on(RoomEvent.LocalTrackPublished, updateMicrophone);
    r.on(RoomEvent.LocalTrackUnpublished, updateMicrophone);
    r.on(RoomEvent.TrackMuted, updateMicrophone);
    r.on(RoomEvent.TrackUnmuted, updateMicrophone);
    let live = true;
    const append = (id: string, role: "user" | "assistant", text: string) =>
      setMessages((old) => {
        const index = old.findIndex((m) => m.id === id);
        if (index < 0) return [...old, { id, role, content: text }];
        return old.map((m) => (m.id === id ? { ...m, content: text } : m));
      });
    r.registerTextStreamHandler(
      "lk.transcription",
      async (reader, participant) => {
        const role =
          participant.identity === r.localParticipant.identity
            ? "user"
            : "assistant";
        const id = reader.info.attributes?.["lk.segment_id"] || reader.info.id;
        let text = "";
        for await (const chunk of reader) {
          text += chunk;
          if (live) {
            append(id, role, text);
            if (role === "assistant") setPending(false);
          }
        }
        if (live && role === "assistant") setPending(false);
      },
    );
    const stopMeter = observeAudioLevels(r, (levels) => {
      if (live)
        setLevels((old) =>
          Math.abs(old.user - levels.user) > 0.01 ||
          Math.abs(old.agent - levels.agent) > 0.01
            ? levels
            : old,
        );
    });
    r.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        audio.current?.appendChild(element);
      }
    });
    r.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });
    const updateAgentState = (p: RemoteParticipant) => {
      if (live && p.attributes["lk.agent.state"])
        setState(p.attributes["lk.agent.state"]);
    };
    // A resumed agent may already be listening when it joins: no greeting means
    // there may be no later attribute change to update the connecting indicator.
    r.on(RoomEvent.ParticipantConnected, updateAgentState);
    r.on(RoomEvent.ParticipantAttributesChanged, (_, p) => {
      if (p instanceof RemoteParticipant) updateAgentState(p);
    });
    r.on(RoomEvent.Disconnected, () => {
      if (live) {
        setState("Disconnected");
        setMicrophoneEnabled(false);
      }
    });
    r.on(RoomEvent.Reconnecting, () => setState("Reconnecting"));
    r.on(RoomEvent.Reconnected, () => {
      const p = [...r.remoteParticipants.values()].find(
        (p) => p.attributes["lk.agent.state"],
      );
      setState(p?.attributes["lk.agent.state"] || "Connecting");
    });
    r.connect(session.url, session.token)
      .then(async () => {
        if (!live) {
          await r.disconnect();
          return;
        }
        const active = [...r.remoteParticipants.values()].find(
          (p) => p.attributes["lk.agent.state"],
        );
        setState(active?.attributes["lk.agent.state"] || "Connecting");
        await r.startAudio();
        if (session.mode === "voice")
          await r.localParticipant.setMicrophoneEnabled(true);
      })
      .catch((e) => {
        if (live) {
          setError(e.message || "Could not connect");
          setState("Error");
        }
      });
    return () => {
      live = false;
      stopMeter();
      r.disconnect();
      room.current = null;
    };
  }, [session.id, session.token]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !input.trim() || !room.current) return;
    const text = input.trim();
    setInput("");
    setPending(true);
    setError("");
    setMessages((old) => [
      ...old,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    try {
      await room.current.localParticipant.sendText(text, { topic: "lk.chat" });
    } catch (e) {
      setPending(false);
      setError((e as Error).message);
    }
  }
  async function switchMode() {
    if (switching) return;
    setSwitching(true);
    setError("");
    try {
      const r = room.current;
      if (!r) return;
      const next = mode === "text" ? "voice" : "text";
      // Stopping the microphone must not wait on the server or a draft save.
      if (next === "text") {
        await r.localParticipant.setMicrophoneEnabled(false);
        setMuted(true);
      }
      const agent = [...r.remoteParticipants.values()].find(
        (p) => p.attributes["lk.agent.state"],
      );
      if (!agent) throw new Error("Agent is still connecting");
      if (next === "voice") await r.localParticipant.setMicrophoneEnabled(true);
      await r.localParticipant.performRpc({
        destinationIdentity: agent.identity,
        method: "elma.setMode",
        payload: next,
      });
      setMode(next);
      setMuted(false);
    } catch (e) {
      if (mode === "text")
        await room.current?.localParticipant
          .setMicrophoneEnabled(false)
          .catch(() => {});
      setError((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  async function flush() {
    const r = room.current;
    const agent =
      r &&
      [...r.remoteParticipants.values()].find(
        (p) => p.attributes["lk.agent.state"],
      );
    if (r && agent)
      await r.localParticipant
        .performRpc({
          destinationIdentity: agent.identity,
          method: "elma.flush",
          payload: "",
          responseTimeout: 2000,
        })
        .catch(() => {});
  }
  async function toggle() {
    try {
      await room.current?.localParticipant.setMicrophoneEnabled(muted);
      setMuted(!muted);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    mode,
    messages,
    state,
    input,
    setInput,
    muted,
    microphoneEnabled,
    error,
    pending,
    switching,
    levels,
    audio,
    end,
    send,
    switchMode,
    toggle,
    flush,
  };
}
