"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  CallDirectionTracker,
  type CallActivity,
  type Direction,
} from "../lib/callDirection";

export function CallDirection(activity: CallActivity) {
  const latest = useRef(activity);
  latest.current = activity;
  const tracker = useRef(new CallDirectionTracker());
  const [direction, setDirection] = useState<Direction>("none");
  useEffect(() => {
    const update = () =>
      setDirection(tracker.current.update(latest.current, performance.now()));
    update();
    if (!activity.active) return;
    const timer = setInterval(update, 50);
    return () => clearInterval(timer);
  }, [activity.active]);
  return (
    <span
      className="call-direction"
      data-direction={activity.active ? direction : "none"}
      aria-hidden="true"
    >
      <span className="call-direction-track">
        <ChevronRight size={12} strokeWidth={2.5} />
        <ChevronRight size={12} strokeWidth={2.5} />
      </span>
    </span>
  );
}
