import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WidgetLanguageContext,
  useWidgetText,
} from "../../apps/web/components/WidgetLanguage";
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

test("German widget localizes the accessible voice meter and AI notice", () => {
  function Notice() {
    const t = useWidgetText();
    return (
      <p>
        {t("AI can make mistakes.")} {t("Ask a question in English or German.")}
      </p>
    );
  }
  const html = renderToStaticMarkup(
    <MantineProvider>
      <WidgetLanguageContext.Provider value="de">
        <AgentAvatar
          name="Tristar Service"
          status="Verbunden"
          phase="idle"
          level={0}
        />
        <Notice />
      </WidgetLanguageContext.Provider>
    </MantineProvider>,
  );
  assert.match(html, /aria-label="Tristar Service: Sprachpegel"/);
  assert.match(html, /KI kann Fehler machen\./);
  assert.match(html, /Stellen Sie eine Frage auf Deutsch oder Englisch/);
  assert.doesNotMatch(html, /voice level|AI can make mistakes|Ask a question/);
});
