"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Group, Text } from "@mantine/core";

export function CallStatus({
  voice,
  connected,
  switching,
  state,
}: {
  voice: boolean;
  connected: boolean;
  switching: boolean;
  state: string;
}) {
  const started = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const visible = voice || switching;
  useEffect(() => {
    if (!visible) {
      started.current = null;
      setSeconds(0);
      return;
    }
    if (!connected || !voice) return;
    started.current ??= Date.now();
    const update = () =>
      setSeconds(Math.floor((Date.now() - started.current!) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [visible, connected, voice]);

  if (!visible) return null;
  const onLine = voice && connected;
  const unavailable = /disconnected|error/i.test(state);
  const label = switching
    ? voice
      ? "Ending call…"
      : "Calling…"
    : unavailable
      ? "Call disconnected"
      : /reconnecting/i.test(state)
        ? "Reconnecting…"
        : onLine
          ? "On the line"
          : "Connecting call…";
  const color = onLine ? "green.7" : unavailable ? "red.7" : "dimmed";
  return (
    <Group
      gap={6}
      wrap="nowrap"
      className="call-status"
      data-connected={onLine}
    >
      <Box
        w={6}
        h={6}
        bg={onLine ? "green.6" : unavailable ? "red.6" : "gray.5"}
        style={{ borderRadius: "50%" }}
        aria-hidden="true"
      />
      <Text size="xs" c={color} role="status">
        {label}
      </Text>
      {onLine && (
        <Text
          size="xs"
          c={color}
          role="timer"
          aria-label="Call duration"
          style={{ fontVariantNumeric: "tabular-nums", minWidth: "5ch" }}
        >
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </Text>
      )}
    </Group>
  );
}
