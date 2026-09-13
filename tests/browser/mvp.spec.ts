import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const password = readFileSync("infra/local/runtime.env", "utf8")
  .split("\n")
  .find((l) => l.startsWith("SEED_PASSWORD="))!
  .split("=")
  .slice(1)
  .join("=");

test("workspace, knowledge, live RAG chat, history and metering", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await page
    .getByRole("button", { name: "Open Nordhaus", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Agents", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/workspace.png", fullPage: true });
  await page.getByRole("link", { name: "Knowledge", exact: true }).click();
  await expect(page.getByText("Resident handbook")).toBeVisible();
  await page.getByRole("link", { name: "Agents", exact: true }).first().click();
  await page.getByRole("button", { name: "Open conversation" }).click();
  await expect(page.locator(".chat-state")).not.toContainText("Connecting", {
    timeout: 30000,
  });
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("When is the next resident meeting and where is it?");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(page.locator(".message.assistant").last()).toContainText(
    /October 14|14 October|14th/,
    { timeout: 45000 },
  );
  await expect(page.locator(".message.assistant").last()).toContainText(
    /18:30|6:30/,
  );
  await expect(page.locator(".chat-state")).toContainText(
    "Ready for your message",
  );
  await expect(page.locator(".chat-messages")).not.toContainText(
    /Reference excerpts|Internal retrieval|untrusted document content/,
  );
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Bitte auf Deutsch: Wann sind die Ruhezeiten?");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(page.locator(".message.assistant").last()).toContainText(
    /22:00|22 Uhr/,
    { timeout: 45000 },
  );
  await expect(page.locator(".chat-state")).toContainText(
    "Ready for your message",
  );
  await expect(page.locator(".chat-messages")).not.toContainText(
    /Reference excerpts|Internal retrieval|untrusted document content/,
  );
  await page.screenshot({ path: "artifacts/chat.png", fullPage: true });
  await page.getByRole("button", { name: "Close conversation" }).click();
  await page.getByRole("link", { name: "Conversations", exact: true }).click();
  await expect(
    page
      .getByText("When is the next resident meeting and where is it?", {
        exact: true,
      })
      .first(),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: "Usage", exact: true }).click();
  await expect(page.getByText("mistral-small-latest").first()).toBeVisible();
});

test("landing uses the embedded published agent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator('iframe[title="AI agent conversation"]');
  await expect(
    frame.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("What are your office hours?");
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(frame.locator(".message.assistant").last()).toContainText(
    /09:00|9:00|9 AM|9 am/,
    { timeout: 45000 },
  );
  await page.screenshot({ path: "artifacts/widget.png", fullPage: true });
  await frame.getByRole("button", { name: "Close conversation" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
});
