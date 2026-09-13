import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function openDraft(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  await frame
    .getByRole("button", { name: "Open side panel", exact: true })
    .click();
  await frame.getByRole("combobox", { name: "Start a request" }).click();
  await frame
    .getByRole("option", { name: "Repair request", exact: true })
    .click();
  await frame.getByRole("button", { name: "Open form", exact: true }).click();
  return frame;
}

for (const width of [1440, 390]) {
  test(`partial draft autosaves and restores the same request after reload (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const frame = await openDraft(page);
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/answers") &&
        r.request().method() === "POST" &&
        r.ok(),
    );
    await frame
      .getByRole("textbox", { name: /^Your name/ })
      .fill("Anton Autosaved");
    await expect(
      frame.getByRole("button", { name: "Save draft", exact: true }),
    ).toHaveCount(0);
    await expect(
      frame.getByRole("checkbox", { name: "I have checked" }),
    ).toHaveCount(0);
    const response = await (await saved).json();
    expect(Object.values(response.answers)).toContain("Anton Autosaved");
    await expect(
      frame.getByText("Draft saved.", { exact: false }),
    ).toBeVisible();
    await expect(
      frame.getByRole("button", { name: "Submit request", exact: true }),
    ).toBeEnabled();
    await expect(
      frame.locator(".field-save-state").filter({ hasText: "Saved" }),
    ).toHaveCount(1);
    const address = new URL(page.url());
    const conversation = address.searchParams.get("elma-conversation");
    expect(conversation).toBeTruthy();
    expect(address.searchParams.get("elma-active-request")).toBe(response.id);
    await page.reload();
    await expect(
      frame.getByRole("textbox", { name: /^Your name/ }),
    ).toHaveValue("Anton Autosaved", { timeout: 30000 });
    expect(new URL(page.url()).searchParams.get("elma-conversation")).toBe(
      conversation,
    );
    expect(new URL(page.url()).searchParams.get("elma-active-request")).toBe(
      response.id,
    );
    await expect(frame.getByRole("textbox", { name: /^Email/ })).toHaveValue(
      "",
    );
    await page.screenshot({ path: `artifacts/autosave/restored-${width}.png` });
  });
}

test("typing stays enabled during save; latest edit survives an earlier response", async ({
  page,
}) => {
  const frame = await openDraft(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted!: () => void;
  const started = new Promise<void>((resolve) => {
    intercepted = resolve;
  });
  let writes = 0;
  await page.route("**/requests/*/answers", async (route) => {
    if (++writes === 1) {
      intercepted();
      await gate;
    }
    await route.continue();
  });
  try {
    const name = frame.getByRole("textbox", { name: /^Your name/ });
    await name.fill("Ant");
    await started;
    await expect(name).toBeEnabled();
    await name.fill("Anton Final");
    release();
    await expect(
      frame.getByText("Draft saved.", { exact: false }),
    ).toBeVisible();
    await expect(name).toHaveValue("Anton Final");
    expect(writes).toBe(2);
    await page.reload();
    await expect(
      frame.getByRole("textbox", { name: /^Your name/ }),
    ).toHaveValue("Anton Final", { timeout: 30000 });
  } finally {
    release();
  }
});

test("failed save is visible, preserves input and blocks chat until retry succeeds", async ({
  page,
}) => {
  const frame = await openDraft(page);
  await expect(frame.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await page.route("**/requests/*/answers", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Test: saving unavailable" },
    }),
  );
  await frame.getByRole("textbox", { name: /^Your name/ }).fill("Anton Retry");
  await expect(
    frame.getByText("Test: saving unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    frame.locator(".field-save-state").filter({ hasText: /^Saved$/ }),
  ).toHaveCount(0);
  await frame
    .getByRole("button", { name: "Close side panel", exact: true })
    .click();
  const message = frame.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("Please check the current form and tell me my name.");
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(message).toHaveValue(
    "Please check the current form and tell me my name.",
  );
  await expect(frame.locator(".message.user")).toHaveCount(0);
  await page.unroute("**/requests/*/answers");
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(message).toHaveValue("");
  await expect(frame.locator(".message.assistant").last()).toContainText(
    "Anton Retry",
    { timeout: 45000 },
  );
  await frame
    .getByRole("button", { name: "Open side panel", exact: true })
    .click();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton Retry",
  );
  await expect(frame.getByText("Draft saved.", { exact: false })).toBeVisible();
});

test("autosaved manual answers and a photo submit with one explicit action", async ({
  page,
}) => {
  const frame = await openDraft(page);
  await frame.getByRole("textbox", { name: /^Your name/ }).fill("Anton Manual");
  await frame
    .getByRole("textbox", { name: /^Email/ })
    .fill("anton@example.com");
  await frame.getByLabel("Address / apartment").fill("Dunkerstrasse 77");
  await frame.getByLabel("What needs repairing?").fill("Broken kitchen window");
  await frame.locator("input[type=file]").setInputFiles({
    name: "window.png",
    mimeType: "image/png",
    buffer: readFileSync("apps/landing/public/favicon-32x32.png"),
  });
  await expect(frame.getByRole("img", { name: "window.png" })).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Submit request", exact: true }),
  ).toBeEnabled();
  await frame
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(
    frame.getByText("Request received.", { exact: false }),
  ).toBeVisible();
  await expect(
    frame.getByRole("textbox", { name: /^Your name/ }),
  ).toBeDisabled();
  await page.reload();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton Manual",
    { timeout: 30000 },
  );
  await expect(frame.getByLabel("Address / apartment")).toHaveValue(
    "Dunkerstrasse 77",
  );
  await expect(frame.getByRole("img", { name: "window.png" })).toBeVisible();
});
