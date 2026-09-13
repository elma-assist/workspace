import { test, expect } from "@playwright/test";

test("agent corrects an explicitly requested saved address in the active draft", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  const pending = page.waitForResponse(
    (r) =>
      r.ok() &&
      r.request().method() === "POST" &&
      r.url().endsWith("/sessions"),
  );
  await page.getByRole("button", { name: "Start a chat" }).click();
  const session = await (await pending).json();
  const f = page.frameLocator("iframe");
  await expect(f.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await f.getByRole("button", { name: "Open side panel", exact: true }).click();
  await f.getByRole("combobox", { name: "Start a request" }).click();
  await f.getByRole("option", { name: "Repair request", exact: true }).click();
  await f.getByRole("button", { name: "Open form", exact: true }).click();
  await f.getByRole("textbox", { name: /^Your name/ }).fill("Anton");
  await f.getByRole("textbox", { name: /^Email/ }).fill("anton@example.com");
  await f.getByLabel("Address / apartment").fill("Donkerstrasse 77");
  await expect(f.getByText("Draft saved.", { exact: false })).toBeVisible();
  const path = `/api/public/conversations/${session.id}/requests`;
  const headers = { "X-Guest-Token": session.guest_token };
  const initial = await (await page.request.get(path, { headers })).json();
  const correct = async (message: string, address: string) => {
    await f
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(message);
    await f.getByRole("textbox", { name: "Message", exact: true }).press("Enter");
    await expect(f.getByLabel("Address / apartment")).toHaveValue(address, {
      timeout: 45000,
    });
    await expect(f.locator(".chat-state")).toContainText(/Ready/i, {
      timeout: 30000,
    });
  };
  await correct(
    'Please change the address from "Donkerstrasse 77" to "Dunkerstrasse 77" directly in the form panel. After that, let me know!',
    "Dunkerstrasse 77",
  );
  await correct(
    'Bitte korrigiere die Adresse in meiner ausgewählten Anfrage auf "Dunkerstrasse 78". Alle anderen Felder sollen gleich bleiben.',
    "Dunkerstrasse 78",
  );
  const final = await (await page.request.get(path, { headers })).json();
  expect(final).toHaveLength(1);
  expect(final[0].id).toBe(initial[0].id);
  expect(final[0].answers).toEqual({
    ...initial[0].answers,
    address: "Dunkerstrasse 78",
  });
  expect(final[0].revision).toBeGreaterThan(initial[0].revision);
  await page.screenshot({
    path: "artifacts/corrections/address-corrected.png",
  });
  await f.getByRole("button", { name: "Close conversation" }).click();
});
