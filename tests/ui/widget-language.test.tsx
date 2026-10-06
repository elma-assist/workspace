import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function mount(lang: string) {
  const elements: any[] = [];
  const controls: Record<string, any> = {};
  const location = { href: "https://example.com/", search: "" };
  const document = {
    currentScript: {
      src: "https://elma-assist.de/widget.js",
      lang,
      dataset: { agent: "agent-id" },
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
        querySelector(selector: string) {
          return (controls[selector] ??= { focus() {} });
        },
      };
    },
  };
  const window = { addEventListener() {}, removeEventListener() {} };
  runInNewContext(
    readFileSync("packages/agent-widget/dist/widget.js", "utf8"),
    {
      document,
      window,
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
  return { launcher, panel: elements[1] };
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
