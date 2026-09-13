import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import {
  AgentAvatar,
  avatarPhase,
} from "../../apps/web/components/AgentAvatar";

test("avatar distinguishes work, actual speech, idle and unavailable connection", () => {
  assert.equal(avatarPhase("thinking", false, true), "busy");
  assert.equal(avatarPhase("listening", true, false), "busy");
  assert.equal(avatarPhase("speaking", true, true), "speaking");
  assert.equal(avatarPhase("speaking", false, false), "busy");
  assert.equal(avatarPhase("listening", false, true), "idle");
  assert.equal(avatarPhase("error", true, true), "offline");
  assert.equal(avatarPhase("reconnecting", false, true), "busy");
});

test("avatar level is bounded and only signals agent speech", () => {
  const render = (phase: "idle" | "speaking", level: number) =>
    renderToStaticMarkup(
      <MantineProvider>
        <AgentAvatar
          name="Emma"
          status="Listening"
          phase={phase}
          level={level}
        />
      </MantineProvider>,
    );
  assert.match(render("speaking", 0.7), /aria-valuenow="70"/);
  assert.match(render("speaking", 0), /aria-valuenow="0"/);
  assert.match(render("idle", 0.7), /aria-valuenow="0"/);
  assert.match(render("speaking", 2), /aria-valuenow="100"/);
  assert.match(render("speaking", NaN), /aria-valuenow="0"/);
});
