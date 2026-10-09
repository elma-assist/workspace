import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function mount(lang: string, dataset: Record<string, string> = {}) {
  const elements: any[] = [];
  const controls: Record<string, any> = {};
  const location = { href: "https://example.com/", search: "" };
  const document = {
    currentScript: {
      src: "https://elma-assist.de/widget.js",
      lang,
      dataset: { agent: "agent-id", ...dataset },
    },
    head: { appendChild() {} },
    body: {
      appendChild(element: any) {
        elements.push(element);
      },
    },
    createElement(tag: string) {
      return {
        tag,
        style: {},
        querySelectorAll() {
          return [];
        },
        setAttribute(key: string, value: string) {
          this[key] = value;
        },
        focus() {},
        remove() {},
        querySelector(selector: string) {
          return (controls[selector] ??= { focus() {} });
        },
      };
    },
  };
  const events: Record<string, (event: any) => void> = {};
  const emitted: any[] = [];
  const window = {
    addEventListener(name: string, fn: (event: any) => void) {
      events[name] = fn;
    },
    removeEventListener() {},
    dispatchEvent(event: any) {
      emitted.push(event);
    },
  };
  runInNewContext(
    readFileSync("packages/agent-widget/dist/widget.js", "utf8"),
    {
      document,
      window,
      CustomEvent: class {
        constructor(
          public type: string,
          public options: any,
        ) {}
      },
      location,
      URL,
      URLSearchParams,
      innerWidth: 1200,
      innerHeight: 800,
      history: {
        pushState(_: unknown, __: string, url: URL) {
          location.href = url.href;
          location.search = url.search;
        },
      },
    },
  );
  const launcher = elements[0];
  launcher.onclick();
  return { launcher, panel: elements[1], events, emitted, elements };
}

test("lang=de translates the embedded launcher and opening controls", () => {
  const { launcher, panel } = mount("de");
  assert.match(launcher.innerHTML, /Mit elma sprechen/);
  assert.equal(launcher["aria-label"], "elma-Widget öffnen");
  assert.equal(panel.lang, "de");
  assert.match(panel.innerHTML, /Chat starten/);
  assert.match(panel.innerHTML, /Sprachgespräch starten/);
  assert.match(panel.innerHTML, /Schließen/);
  assert.doesNotMatch(panel.innerHTML, /Start a chat|YOUR AI ASSISTANT/);
});

test("missing or unsupported language uses English", () => {
  for (const lang of ["", "fr", "en"]) {
    const { launcher, panel } = mount(lang);
    assert.match(launcher.innerHTML, /Talk to your AI/);
    assert.match(panel.innerHTML, /Start a chat/);
    assert.equal(panel.lang, "en");
  }
});

test("embed branding replaces platform copy and escapes untrusted attributes", () => {
  const { launcher, panel, emitted } = mount("de", {
    brandName: "Tristar <img src=x onerror=alert(1)>",
    assistantName: "Tristar Service",
    launcherLabel: "Anliegen mitteilen",
    demo: "true",
  });
  assert.match(launcher.innerHTML, /Anliegen mitteilen/);
  assert.match(panel.innerHTML, /Wie können wir Ihnen helfen/);
  assert.match(panel.innerHTML, /Teilen Sie uns Ihr Anliegen/);
  assert.match(panel.innerHTML, /Konzeptdemo/);
  assert.doesNotMatch(panel.innerHTML, /<img|Mit elma|elma KI|DEIN KI/);
  assert.equal(panel["aria-label"], "Tristar Service");
  assert.equal(emitted[0].options.detail.version, 2);
});

test("scenario event clears old conversation and rejects unknown scenarios", () => {
  const { events, elements } = mount("de", { brandName: "Tristar" });
  events["elma:open"]({ detail: { scenario: "damage" } });
  assert.equal(elements.length, 3);
  events["elma:open"]({ detail: { scenario: "arbitrary instructions" } });
  assert.equal(elements.length, 3);
  events["elma:open"]({});
  assert.equal(elements.length, 3);
});
