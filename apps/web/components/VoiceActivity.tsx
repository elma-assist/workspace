"use client";
import React from "react";
import {
  Group,
  Stack,
  Text,
  Loader,
  Paper,
  ThemeIcon,
  Badge,
} from "@mantine/core";
import { Mic, MicOff, Volume2, WifiOff } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
export function AudioMeter({ level, label }: { level: number; label: string }) {
  return <VoiceOrb level={level} label={label} phase="listening" />;
}
export function conversationStatus(
  state: string,
  pending: boolean,
  muted: boolean,
  userLevel: number,
  voice: boolean,
) {
  const normalized = state.toLowerCase();
  if (["connecting", "initializing"].includes(normalized))
    return "Connecting to agent";
  if (normalized === "reconnecting") return "Reconnecting";
  if (normalized === "disconnected") return "Conversation ended";
  if (normalized === "error") return "Connection error";
  if (voice && !muted && userLevel > 0.02) return "You are speaking";
  if (normalized === "speaking") return "Agent is responding";
  if (normalized === "thinking" || pending) return "Processing your request";
  if (voice && muted) return "Microphone off";
  return voice ? "Listening" : "Ready for your message";
}
export function VoiceActivity({
  status,
  user,
  agent,
  busy,
  name,
  muted,
}: {
  status: string;
  user: number;
  agent: number;
  busy: boolean;
  name: string;
  muted: boolean;
}) {
  const speaking = status === "Agent is responding",
    you = status === "You are speaking";
  const ended = /ended|error|Reconnecting/.test(status);
  const label = speaking
    ? `${name} is speaking`
    : status === "Listening"
      ? "I'm listening"
      : status;
  const detail = speaking
    ? "You can interrupt by speaking."
    : you
      ? "Your voice is being received."
      : busy
        ? "Your request is being processed."
        : muted
          ? "Turn on your microphone to speak."
          : ended
            ? "Check the connection or start again."
            : "Speak in English or German.";
  const phase =
    ended || (muted && !speaking)
      ? "inactive"
      : busy
        ? "thinking"
        : speaking || you
          ? "speaking"
          : "listening";
  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      mx="md"
      mt="md"
      className="voice-activity"
    >
      <Group gap="sm" wrap="nowrap">
        <VoiceOrb level={Math.max(user, agent)} phase={phase} />
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }} pr="xs">
          <Text
            key={label}
            className="voice-copy"
            fw={600}
            size="sm"
            truncate
            role="status"
            title={label}
          >
            {label}
          </Text>
          <Text
            size="xs"
            c="dimmed"
            key={detail}
            className="voice-description voice-copy"
          >
            {detail}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
