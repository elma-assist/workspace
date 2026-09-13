import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { Markdown } from "../../apps/web/components/Markdown";
import {
  AudioMeter,
  conversationStatus,
} from "../../apps/web/components/VoiceActivity";
function render(child: React.ReactNode) {
  return renderToStaticMarkup(<MantineProvider>{child}</MantineProvider>);
}
test("agent Markdown renders structure without executable HTML or links", () => {
  const html = render(
    <Markdown
      text={
        "## Meeting\n\n**Ready**\n\n- First\n- Second\n\n| Time | Room |\n| --- | --- |\n| 18:30 | A |\n\n```js\nconst ready = true;\n```\n\n[Safe](https://example.com) [Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>"
      }
    />,
  );
  for (const tag of [
    "<h2>",
    "<strong>Ready</strong>",
    "<li>",
    "<table>",
    "<pre>",
    "<code",
  ])
    assert.ok(html.includes(tag), tag);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});
test("incomplete streaming Markdown remains renderable", () => {
  assert.ok(
    render(
      <Markdown text={"**An unfinished answer\n\n```js\nconst a ="} />,
    ).includes("unfinished answer"),
  );
});
test("audio meter follows measured level, including silence", () => {
  assert.ok(
    render(<AudioMeter label="User" level={0} />).includes('aria-valuenow="0"'),
  );
  assert.ok(
    render(<AudioMeter label="User" level={0.65} />).includes(
      'aria-valuenow="65"',
    ),
  );
});
test("connection, processing and microphone states stay distinct", () => {
  assert.equal(
    conversationStatus("Connecting", false, false, 0, true),
    "Connecting to agent",
  );
  assert.equal(
    conversationStatus("listening", true, false, 0, true),
    "Processing your request",
  );
  assert.equal(
    conversationStatus("listening", false, false, 0.2, true),
    "You are speaking",
  );
  assert.equal(
    conversationStatus("listening", false, true, 0.2, true),
    "Microphone off",
  );
  assert.equal(
    conversationStatus("speaking", false, false, 0, true),
    "Agent is responding",
  );
  assert.equal(
    conversationStatus("Reconnecting", true, false, 0, true),
    "Reconnecting",
  );
});
