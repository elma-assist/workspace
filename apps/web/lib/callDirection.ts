export type Direction = "right" | "left" | "none";
export type CallActivity = {
  active: boolean;
  agentSpeaking: boolean;
  userLevel: number;
  agentLevel: number;
};

/** Debounce speaker changes independently of audio sample/render frequency. */
export class CallDirectionTracker {
  private direction: Direction = "none";
  private candidate: Direction = "none";
  private candidateSince = 0;
  private changedAt = -Infinity;

  update(activity: CallActivity, now: number): Direction {
    if (!activity.active) {
      this.direction = this.candidate = "none";
      this.candidateSince = now;
      this.changedAt = -Infinity;
      return "none";
    }
    // Agent is on the left, caller on the right: point toward the listener.
    // Agent state spans pauses between words and prevents microphone echo
    // from reversing the indicator. A real interruption ends that state.
    const next: Direction =
      activity.agentSpeaking || activity.agentLevel > 0.06
        ? "right"
        : activity.userLevel > 0.08
          ? "left"
          : "none";
    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateSince = now;
    }
    const delay = next === "none" ? 900 : this.direction === "none" ? 180 : 300;
    if (
      next !== this.direction &&
      now - this.candidateSince >= delay &&
      (this.direction === "none" || now - this.changedAt >= 650)
    ) {
      this.direction = next;
      this.changedAt = now;
    }
    return this.direction;
  }
}
