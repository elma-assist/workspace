import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const password = readFileSync("infra/local/runtime.env", "utf8")
  .split("\n")
  .find((l) => l.startsWith("SEED_PASSWORD="))!
  .slice("SEED_PASSWORD=".length);

test("form builder, agent opens and fills a real draft, photos, submission and guest return", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await page
    .getByRole("button", { name: "Open Nordhaus", exact: true })
    .click();
  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page.getByText("Repair request", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create form", exact: true }).click();
  await page
    .getByRole("textbox", { name: /^Form name/ })
    .fill("Simple form " + Date.now());
  await page
    .getByLabel("When should the agent offer this form?")
    .fill("A simple test form.");
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  await page.getByLabel("Field 2 label").fill("Your question");
  await page.getByRole("button", { name: "Move field 2 up" }).click();
  await expect(page.getByLabel("Field 1 label")).toHaveValue("Your question");
  await page.getByRole("button", { name: "Save form", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
  await page.goto("/");
  let cid = "";
  page.on("response", async (r) => {
    if (r.url().endsWith("/sessions") && r.ok()) {
      cid = (await r.json()).id;
    }
  });
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".chat-state")).toContainText(
    /Ready|responding/i,
    { timeout: 30000 },
  );
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "I need to report a broken window. Please open the repair request form. My name is Anton Test. Save my name now; I will provide my other details next.",
    );
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton Test",
    { timeout: 60000 },
  );
  await expect(frame.getByRole("textbox", { name: /^Email/ })).toHaveValue("");
  await expect(
    frame.locator(".field-save-state").filter({ hasText: "Saved" }).first(),
  ).toBeVisible();
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "My email is anton@example.com. My address is Lindenstrasse 12 apartment 4. The kitchen window is broken. Please save these details too.",
    );
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(frame.getByRole("textbox", { name: /^Email/ })).toHaveValue(
    "anton@example.com",
    { timeout: 45000 },
  );
  await expect(frame.getByLabel("Address / apartment")).not.toHaveValue("");
  await frame.locator("input[type=file]").setInputFiles({
    name: "window.png",
    mimeType: "image/png",
    buffer: readFileSync("apps/landing/public/favicon-32x32.png"),
  });
  await expect(frame.getByRole("img", { name: "window.png" })).toBeVisible({
    timeout: 15000,
  });
  await page.screenshot({
    path: "artifacts/forms/draft-desktop.png",
    fullPage: true,
  });
  await frame.getByRole("checkbox", { name: "I have checked" }).check();
  await frame
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(
    frame.getByText("Request received.", { exact: false }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Close conversation" }).click();
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton Test",
  );
  await frame.getByRole("button", { name: "Close conversation" }).click();
  await page.goto("/app/nordhaus/agents");
  await page.getByRole("link", { name: "Requests", exact: true }).click();
  await page
    .getByRole("button", { name: /^Open request / })
    .first()
    .click();
  await page.getByRole("combobox", { name: "Request status" }).click();
  await page.getByRole("option", { name: "In progress", exact: true }).click();
  await expect(
    page.getByText("In progress · Alex Morgan", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "window.png" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/forms/request-admin.png",
    fullPage: true,
  });
});

test("mobile form stays separate from conversation and preserves a manual draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  await frame
    .getByRole("button", { name: "Open side panel", exact: true })
    .click();
  await expect(
    frame.getByRole("button", { name: "Close side panel", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await frame.getByRole("combobox", { name: "Start a request" }).click();
  await frame
    .getByRole("option", { name: "Repair request", exact: true })
    .click();
  await frame.getByRole("button", { name: "Open form", exact: true }).click();
  await frame
    .getByRole("textbox", { name: /^Your name/ })
    .fill("Mobile resident");
  await expect(frame.getByText("Draft saved.", { exact: false })).toBeVisible();
  await frame
    .getByRole("button", { name: "Close side panel", exact: true })
    .click();
  await expect(
    frame.getByRole("button", { name: "Open side panel", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    frame.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Open side panel", exact: true })
    .click();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Mobile resident",
  );
  const size = await frame
    .locator("body")
    .evaluate((el) => ({ w: el.scrollWidth, viewport: innerWidth }));
  expect(size.w).toBeLessThanOrEqual(size.viewport + 1);
  await frame.locator(".conversation-request-pane").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "artifacts/forms/mobile.png" });
  await frame.getByRole("button", { name: "Close conversation" }).click();
  await expect(
    page.getByRole("button", { name: "Open agent widget" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Mobile resident",
    { timeout: 15000 },
  );
  await expect(frame.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
});
