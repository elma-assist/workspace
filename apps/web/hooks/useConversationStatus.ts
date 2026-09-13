"use client";
import { useEffect, useState } from "react";
/** Brief speech pauses should not flicker between 'speaking' and 'listening'. */
export function useConversationStatus(candidate: string) {
  const [display, setDisplay] = useState(candidate);
  useEffect(() => {
    const urgent = /error|ended|Microphone off|Reconnecting/.test(candidate);
    const delay = urgent
      ? 0
      : candidate === "Listening"
        ? 550
        : candidate === "You are speaking"
          ? 160
          : 250;
    const timer = setTimeout(() => setDisplay(candidate), delay);
    return () => clearTimeout(timer);
  }, [candidate]);
  return display;
}
