"use client";
import React from "react";
import { Avatar, Tooltip, VisuallyHidden } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";

export function avatarPhase(state: string, pending: boolean, voice: boolean) {
  const s = state.toLowerCase();
  if (["error", "disconnected"].includes(s)) return "offline";
  if (voice && s === "speaking") return "speaking";
  if (
    pending ||
    [
      "connecting",
      "initializing",
      "reconnecting",
      "thinking",
      "speaking",
    ].includes(s)
  )
    return "busy";
  return "idle";
}

/** A fixed-size ring; only the agent's measured audio changes its intensity. */
export function AgentAvatar({
  name,
  status,
  phase,
  level,
  online = false,
  size = 48,
  announce = true,
}: {
  name: string;
  status: string;
  phase: ReturnType<typeof avatarPhase>;
  level: number;
  online?: boolean;
  size?: number;
  announce?: boolean;
}) {
  const reduced = useReducedMotion();
  const energy =
    phase === "speaking" && Number.isFinite(level)
      ? Math.max(0, Math.min(1, level))
      : 0;
  return (
    <Tooltip label={status}>
      <div
        className="agent-avatar"
        data-phase={phase}
        data-online={online}
        style={{ "--avatar-size": `${size}px` } as React.CSSProperties}
        role={announce ? undefined : "img"}
        aria-label={announce ? undefined : `${name}: ${status}`}
      >
        <Avatar size={size * 0.75} radius="xl" aria-hidden="true">
          {name[0]}
        </Avatar>
        <svg
          className="agent-avatar-ring"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <circle className="agent-avatar-track" cx="24" cy="24" r="21" />
          <circle
            className="agent-avatar-signal"
            cx="24"
            cy="24"
            r="21"
            style={{
              strokeOpacity:
                phase === "speaking"
                  ? reduced
                    ? 1
                    : 0.35 + energy * 0.65
                  : undefined,
              strokeWidth:
                phase === "speaking" && !reduced ? 2 + energy * 1.5 : 2,
            }}
          />
        </svg>
        {announce && (
          <>
            <VisuallyHidden
              className="chat-state"
              role="status"
              aria-live="polite"
            >
              {status}
            </VisuallyHidden>
            <VisuallyHidden
              role="meter"
              aria-label={`${name} voice level`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(energy * 100)}
            />
          </>
        )}
      </div>
    </Tooltip>
  );
}
