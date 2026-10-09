import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const publication = "423ca3c4-3c93-406c-abb6-aa250140ad1f";
test("branded embed carries topic without a user message and isolates new scenarios", async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route("https://embed.test/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<script src="https://service.test/widget.js" lang="de" data-agent="${publication}" data-brand-name="Tristar Hausmanagement" data-assistant-name="Tristar Service" data-launcher-label="Anliegen mitteilen" data-demo="true" defer></script>`,
    }),
  );
  await page.route("https://service.test/widget.js", (route) =>
    route.fulfill({
      contentType: "application/javascript; charset=utf-8",
      body: readFileSync("packages/agent-widget/dist/widget.js", "utf8"),
    }),
  );
  await page.route("https://service.test/api/public/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        headers: {
          "Access-Control-Allow-Origin": "https://embed.test",
          "Access-Control-Allow-Headers": "Content-Type,X-Visitor-Token",
          "Access-Control-Allow-Methods": "POST",
        },
        body: "",
      });
      return;
    }
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({
      headers: {
        "Access-Control-Allow-Origin": "https://embed.test",
        "Access-Control-Allow-Headers": "Content-Type,X-Visitor-Token",
      },
      contentType: "application/json",
      body: JSON.stringify({
        id:
          body.new_conversation || !body.conversation_id
            ? `conversation-${requests.length}`
            : body.conversation_id,
        token: "token",
        url: "wss://service.test",
        visitor_token: "visitor",
        widget_context: body.widget_context,
        agent_name: "Tristar Service",
      }),
    });
  });
  await page.route("https://service.test/widget/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<script>window.addEventListener("message",e=>{if(e.data.type==="elma:session")document.body.textContent=e.data.session.agent_name+":"+e.data.session.widget_context.scenario});window.parent.postMessage({type:"elma:ready"},"*")</script>',
    }),
  );
  await page.goto("https://embed.test/");
  await expect(page.getByRole("button", { name: "Service öffnen" })).toHaveText(
    "Anliegen mitteilen",
  );
  expect(
    await page.evaluate(
      (id) => (window as any).elmaWidgets[id].features,
      publication,
    ),
  ).toContain("scenarios");
  for (const scenario of [
    "damage",
    "management_question",
    "management_inquiry",
  ]) {
    await page.evaluate(
      (scenario) =>
        window.dispatchEvent(
          new CustomEvent("elma:open", { detail: { scenario } }),
        ),
      scenario,
    );
    await page.reload();
    await expect(page.getByRole("heading")).toHaveText(
      "Wie können wir Ihnen helfen?",
    );
    await expect(page.locator(".elma-panel")).not.toContainText(
      /Mit elma|elma KI|DEIN KI/,
    );
    await page
      .getByRole("button", { name: "Chat starten", exact: true })
      .click();
    await expect(page.frameLocator("iframe").locator("body")).toHaveText(
      `Tristar Service:${scenario}`,
    );
    const request = requests.at(-1);
    expect(request.new_conversation).toBe(true);
    expect(request.conversation_id).toBeNull();
    expect(request.widget_context.scenario).toBe(scenario);
    expect(request).not.toHaveProperty("message");
    await expect(page).toHaveURL(new RegExp(`elma-scenario=${scenario}`));
  }
  const finalConversation = new URL(page.url()).searchParams.get(
    "elma-conversation",
  );
  await page.goBack();
  await expect(page.getByRole("heading")).toHaveText(
    "Wie können wir Ihnen helfen?",
  );
  await page.goForward();
  await expect(page.frameLocator("iframe").locator("body")).toHaveText(
    "Tristar Service:management_inquiry",
  );
  expect(requests.at(-1).conversation_id).toBe(finalConversation);
  expect(requests.at(-1).new_conversation).toBe(false);
});

test("branded iframe title survives streamed metadata updates", async ({
  page,
}) => {
  const base = process.env.WIDGET_TEST_BASE_URL || "http://localhost:8180";
  await page.route(`${base}/integration-test`, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<iframe src="/widget/${publication}/conversations/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?language=de"></iframe>`,
    }),
  );
  await page.route(`${base}/api/**`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: /\/(forms|requests)$/.test(route.request().url())
        ? "[]"
        : route.request().url().endsWith("/active-request")
          ? '{"version":0,"request":null}'
          : '{"messages":[],"sources":[]}',
    }),
  );
  await page.goto(`${base}/integration-test`);
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".widget-wait")).toContainText(
    "Verbindung zum Assistenten",
  );
  await page.evaluate(() => {
    document.querySelector("iframe")!.contentWindow!.postMessage(
      {
        type: "elma:session",
        session: {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          token: "synthetic",
          guest_token: "synthetic",
          url: "wss://127.0.0.1:1",
          agent_name: "Tristar Service",
          mode: "text",
          messages: [],
          widget_context: {
            brand_name: "Tristar Hausmanagement",
            assistant_name: "Tristar Service",
            language: "de",
            demo: true,
          },
        },
      },
      location.origin,
    );
  });
  await expect
    .poll(() => frame.locator("title").allTextContents())
    .toEqual(["Tristar Service"]);
  const documentFrame = page
    .frames()
    .find((f) => f.url().includes("/widget/"))!;
  await documentFrame.evaluate(() => {
    document.title = "AI assistant";
  });
  await expect
    .poll(() => frame.locator("title").allTextContents())
    .toEqual(["Tristar Service"]);
  await documentFrame.evaluate(() => {
    const metadataTitle = document.createElement("title");
    metadataTitle.textContent = "AI assistant";
    document.head.querySelector("title")!.replaceWith(metadataTitle);
  });
  await expect
    .poll(() => frame.locator("title").allTextContents())
    .toEqual(["Tristar Service"]);
  await expect(frame.locator("body")).toContainText("KI kann Fehler machen.");
  await expect(frame.locator("body")).toContainText(
    "Stellen Sie eine Frage auf Deutsch oder Englisch.",
  );
  await expect(
    frame.locator('[role="meter"][aria-label="Tristar Service: Sprachpegel"]'),
  ).toHaveCount(1);
});
