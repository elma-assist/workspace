import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";

async function checkQr(page: Page, url: string) {
  const img = page.getByRole("img", { name: "QR code for this link" });
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1], "base64"));
  expect(png.width).toBe(1024);
  expect(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
  ).toBe(url);
}

test("publish link and printable QR; shared conversation resumes on another device with the same request", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const password = readFileSync("infra/local/runtime.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith("SEED_PASSWORD="))!
    .slice("SEED_PASSWORD=".length);
  await page.goto("/app");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await page
    .getByRole("button", { name: "Open Nordhaus", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish agent", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save publication" }),
  ).toBeEnabled();
  await page
    .getByRole("checkbox", { name: "Publish agent", exact: true })
    .check();
  await page.getByRole("button", { name: "Save publication" }).click();
  await expect(page.getByLabel("Share link")).toBeVisible();
  const publicUrl = await page.getByLabel("Share link").inputValue();
  expect(new URL(publicUrl).pathname).toMatch(/^\/a\/[\da-f-]+$/);
  await checkQr(page, publicUrl);
  const pngDownload = page.waitForEvent("download");
  await page.getByText("Download PNG", { exact: true }).click();
  await (await pngDownload).saveAs("artifacts/sharing/agent-qr.png");
  const svgDownload = page.waitForEvent("download");
  await page.getByText("Download SVG", { exact: true }).click();
  await (await svgDownload).saveAs("artifacts/sharing/agent-qr.svg");
  expect(readFileSync("artifacts/sharing/agent-qr.svg", "utf8")).toContain(
    "<svg",
  );
  await page.screenshot({ path: "artifacts/sharing/publication.png" });

  const ownerContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    await owner.goto(publicUrl);
    const firstResponse = owner.waitForResponse(
      (r) =>
        r.ok() &&
        r.request().method() === "POST" &&
        r.url().endsWith("/sessions"),
    );
    await owner.getByRole("button", { name: "Start a chat" }).click();
    const first = await (await firstResponse).json();
    await expect(owner.locator(".chat-state")).toContainText(/Ready/i, {
      timeout: 30000,
    });
    await owner
      .getByRole("button", { name: "Open side panel", exact: true })
      .click();
    await owner.getByRole("combobox", { name: "Start a request" }).click();
    await owner
      .getByRole("option", { name: "Repair request", exact: true })
      .click();
    await owner.getByRole("button", { name: "Open form", exact: true }).click();
    const draftSaved = owner.waitForResponse(
      (r) =>
        r.ok() &&
        r.request().method() === "POST" &&
        r.url().endsWith("/answers"),
    );
    await owner
      .getByRole("textbox", { name: /^Your name/ })
      .fill("Anton shared");
    await owner.getByLabel("Address / apartment").fill("Donkerstrasse 77");
    await draftSaved;
    await expect(
      owner.getByText("Draft saved.", { exact: false }),
    ).toBeVisible();
    await owner
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "Please remember the reference code amber lighthouse for our conversation.",
      );
    await owner
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Enter");
    await expect(owner.locator(".message.assistant").last()).toContainText(
      /amber lighthouse/i,
      { timeout: 30000 },
    );
    await owner
      .getByRole("button", { name: "Share conversation", exact: true })
      .click();
    await expect(owner.getByLabel("Share link")).toBeVisible();
    const shareUrl = await owner.getByLabel("Share link").inputValue();
    expect(new URL(shareUrl).pathname).toBe("/s");
    await checkQr(owner, shareUrl);
    await owner
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();

    const recipient = await recipientContext.newPage();
    await recipient.goto(shareUrl);
    const nextResponse = recipient.waitForResponse(
      (r) => r.ok() && r.url().endsWith("/shared/sessions"),
    );
    await recipient
      .getByRole("button", { name: "Continue chat", exact: true })
      .click();
    const next = await (await nextResponse).json();
    expect(next.id).toBe(first.id);
    await expect(recipient.locator(".chat-messages")).toContainText(
      "amber lighthouse",
    );
    await expect(
      recipient.getByRole("textbox", { name: /^Your name/ }),
    ).toHaveValue("Anton shared");
    await expect(recipient.locator(".chat-state")).toContainText(/Ready/i, {
      timeout: 30000,
    });
    await recipient
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        'What code did we mention? Also correct the address to "Dunkerstrasse 77" in the selected request.',
      );
    await recipient
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Enter");
    await expect(recipient.getByLabel("Address / apartment")).toHaveValue(
      "Dunkerstrasse 77",
      { timeout: 30000 },
    );
    await expect(recipient.locator(".chat-state")).toContainText(/Ready/i, {
      timeout: 30000,
    });
    await recipient
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("What reference code did we mention earlier?");
    await recipient
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Enter");
    await expect(recipient.locator(".message.assistant").last()).toContainText(
      /amber lighthouse/i,
      { timeout: 30000 },
    );
    const requests = await (
      await recipient.request.get(
        `/api/public/conversations/${first.id}/requests`,
        { headers: { "X-Guest-Token": next.guest_token } },
      )
    ).json();
    expect(requests).toHaveLength(1);
    await recipient.screenshot({
      path: "artifacts/sharing/shared-conversation.png",
    });

    await owner.reload();
    // The URL now restores this conversation automatically.
    await expect(owner.getByLabel("Address / apartment")).toHaveValue(
      "Dunkerstrasse 77",
      { timeout: 15000 },
    );
    await owner
      .getByRole("button", { name: "Share conversation", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Revoke all conversation links" })
      .click();
    await expect(
      owner.getByText("All previous conversation links have been revoked."),
    ).toBeVisible();
    await recipient.reload();
    await expect(
      recipient.getByText(/invalid, revoked or no longer published/),
    ).toBeVisible();
  } finally {
    await ownerContext.close();
    await recipientContext.close();
  }
});

test("public agent page and sharing QR fit a mobile screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const demo = await (await page.request.get("/api/demo")).json();
  await page.goto("/a/nordhaus/emma");
  await page.getByRole("button", { name: "Start a chat" }).click();
  await expect(page.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Share conversation", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "QR code for this link" }),
  ).toBeVisible();
  const size = await page
    .locator("body")
    .evaluate((el) => ({ width: el.scrollWidth, viewport: innerWidth }));
  expect(size.width).toBeLessThanOrEqual(size.viewport + 1);
  await page.screenshot({ path: "artifacts/sharing/mobile-qr.png" });
  const sharedUrl = await page.getByLabel("Share link").inputValue();
  await checkQr(page, sharedUrl);
  const dialog = page.getByRole("dialog", {
    name: "Share conversation",
    exact: true,
  });
  await expect(
    dialog.getByText(/Download PNG|Download SVG|This is a local address/),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeVisible();
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 740 });
    const qr = await dialog
      .getByRole("img", { name: "QR code for this link" })
      .boundingBox();
    const link = await dialog.getByLabel("Share link").boundingBox();
    const modal = await dialog.boundingBox();
    expect(qr!.x + qr!.width).toBeLessThan(link!.x);
    expect(link!.y).toBeGreaterThanOrEqual(qr!.y);
    expect(link!.y + link!.height).toBeLessThanOrEqual(qr!.y + qr!.height);
    expect(modal!.height).toBeLessThan(450);
    expect(modal!.x).toBeGreaterThanOrEqual(0);
    expect(modal!.x + modal!.width).toBeLessThanOrEqual(width);
  }
  await page.screenshot({ path: "artifacts/sharing/compact-desktop.png" });
  await page.goto("/s#" + "x".repeat(43));
  await expect(
    page.getByText(/invalid, revoked or no longer published/),
  ).toBeVisible();
  await page.evaluate((hash) => {
    location.hash = hash;
  }, new URL(sharedUrl).hash);
  await expect(
    page.getByRole("button", { name: "Continue chat", exact: true }),
  ).toBeVisible();
});
