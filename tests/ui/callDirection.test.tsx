import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CallDirectionTracker,
  type CallActivity,
} from "../../apps/web/lib/callDirection";

const quiet: CallActivity = {
  active: true,
  agentSpeaking: false,
  userLevel: 0,
  agentLevel: 0,
};

test("agent speech keeps its direction through word gaps and loud microphone echo", () => {
  const tracker = new CallDirectionTracker();
  const agent = { ...quiet, agentSpeaking: true, agentLevel: 0.4 };
  assert.equal(tracker.update(agent, 0), "none");
  assert.equal(tracker.update(agent, 180), "right");
  for (const now of [240, 400, 700, 1000, 1300]) {
    assert.equal(
      tracker.update({ ...agent, agentLevel: 0, userLevel: 0.9 }, now),
      "right",
    );
  }
  // Once the agent has stopped, sustained user speech can take over.
  const user = { ...quiet, userLevel: 0.8 };
  assert.equal(tracker.update(user, 1400), "right");
  assert.equal(tracker.update(user, 1600), "right");
  assert.equal(tracker.update(user, 1700), "left");
});

test("brief noise cannot reverse direction and a real change respects minimum hold", () => {
  const tracker = new CallDirectionTracker();
  const user = { ...quiet, userLevel: 0.5 };
  const agent = { ...quiet, agentLevel: 0.5 };
  tracker.update(user, 0);
  assert.equal(tracker.update(user, 180), "left");
  tracker.update(agent, 200);
  assert.equal(tracker.update(agent, 500), "left");
  assert.equal(tracker.update(agent, 830), "right");
  for (const now of [900, 1100, 1300]) {
    assert.equal(tracker.update(user, now), "right");
    assert.equal(tracker.update(agent, now + 100), "right");
  }
});

test("silence bridges short pauses, settles after 900 ms and disconnect resets immediately", () => {
  const tracker = new CallDirectionTracker();
  const user = { ...quiet, userLevel: 0.5 };
  tracker.update(user, 0);
  tracker.update(user, 180);
  assert.equal(tracker.update(quiet, 1000), "left");
  assert.equal(tracker.update(quiet, 1899), "left");
  assert.equal(tracker.update(quiet, 1900), "none");
  tracker.update(user, 2000);
  assert.equal(tracker.update(user, 2180), "left");
  assert.equal(tracker.update({ ...user, active: false }, 2181), "none");
  assert.equal(tracker.update(user, 2200), "none");
  assert.equal(tracker.update(user, 2380), "left");
});
