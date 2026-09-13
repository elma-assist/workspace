"use client";
import React from "react";
import { Tooltip, VisuallyHidden } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { Phone, PhoneOff } from "lucide-react";
import { ActionIcon } from "./AsyncAction";

export function CallButton({
  active,
  voice,
  level,
  loading,
  disabled,
  onClick,
}: {
  active: boolean;
  voice: boolean;
  level: number;
  loading: boolean;
  disabled: boolean;
  onClick: () => Promise<void>;
}) {
  const reduced = useReducedMotion();
  const energy =
    active && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  const label = voice ? "End call" : "Start call";
  return (
    <div
      className="call-control"
      data-active={active}
      data-speaking={energy > 0.02}
      style={{ "--call-energy": reduced ? 0 : energy } as React.CSSProperties}
    >
      <span className="call-halo" aria-hidden="true" />
      <Tooltip label={label}>
        <ActionIcon
          type="button"
          size="input-sm"
          radius="xl"
          variant="filled"
          color={voice ? "red" : "green"}
          className="call-button"
          aria-label={label}
          aria-pressed={voice}
          loading={loading}
          disabled={disabled}
          onClick={onClick}
        >
          {voice ? (
            <PhoneOff size={18} aria-hidden="true" />
          ) : (
            <Phone size={18} aria-hidden="true" />
          )}
        </ActionIcon>
      </Tooltip>
      <VisuallyHidden
        role="meter"
        aria-label="Your microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(energy * 100)}
      />
    </div>
  );
}
