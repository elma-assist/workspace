"use client";
import React, { useEffect, useRef } from "react";
import { useMantineTheme } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
type Phase = "listening" | "speaking" | "thinking" | "inactive";
/** Fixed-size canvas: animation never changes the layout or triggers React renders. */
export function VoiceOrb({
  level,
  phase,
  label = "Voice activity",
}: {
  level: number;
  phase: Phase;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    target = useRef({ level, phase });
  target.current = { level, phase };
  const theme = useMantineTheme(),
    reducedMotion = useReducedMotion();
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const size = 88,
      ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = size * ratio;
    element.height = size * ratio;
    ctx.scale(ratio, ratio);
    const colors = [
      theme.colors.blue[4],
      theme.colors.cyan[4],
      theme.colors.indigo[3],
    ];
    let frame = 0,
      previous = performance.now(),
      energy = 0,
      angle = 0;
    const paint = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const desired =
        target.current.phase === "inactive" ? 0 : target.current.level;
      energy +=
        (desired - energy) *
        (1 - Math.exp(-dt / (desired > energy ? 0.12 : 0.5)));
      const speed = target.current.phase === "thinking" ? 0.55 : 0.18;
      if (!reducedMotion) angle += dt * speed;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      // Overlapping translucent lobes make a soft cloud, driven by measured speech energy.
      for (let i = 0; i < 6; i++) {
        const theta = angle * (i % 2 ? 1 : -0.7) + (i * Math.PI) / 3;
        const spread = 7 + energy * 3;
        const x = Math.cos(theta) * spread,
          y = Math.sin(theta * 1.15) * spread;
        const radius = 18 + energy * 8 + Math.sin(theta * 1.7) * 2;
        const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
        const color =
          target.current.phase === "inactive"
            ? theme.colors.gray[4]
            : colors[i % colors.length];
        gradient.addColorStop(0, color + "c0");
        gradient.addColorStop(0.48, color + "78");
        gradient.addColorStop(1, color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Small particles orbit slowly; speaking changes their radius and brightness.
      for (let i = 0; i < 18; i++) {
        const theta = (i * Math.PI * 2) / 18 + angle * (i % 2 ? 1 : -0.55);
        const radius = 29 + (i % 4) * 2 + energy * 3;
        const x = Math.cos(theta) * radius,
          y = Math.sin(theta) * radius * 0.8;
        ctx.globalAlpha = 0.2 + energy * 0.5;
        ctx.fillStyle =
          target.current.phase === "inactive"
            ? theme.colors.gray[5]
            : colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 0.65 + (i % 3) * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (!reducedMotion) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [theme, reducedMotion]);
  return (
    <div
      className="voice-orb"
      role="meter"
      aria-label={`${label} audio level`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(1, Math.max(0, level)) * 100)}
    >
      <canvas ref={canvas} width={88} height={88} aria-hidden="true" />
    </div>
  );
}
