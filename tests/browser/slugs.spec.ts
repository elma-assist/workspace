import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";

test("published agent gets a readable URL and QR, reload resumes the same conversation", async ({
  page,
}) => {
  const password = readFileSync("infra/local/runtime.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith("SEED_PASSWORD="))!
    .slice("SEED_PASSWORD=".length);
  await page.request.post("/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  const name = `Müller Wohnen ${Date.now()}`;
  const org = await (
    await page.request.post("/api/organizations", { data: { name } })
  ).json();
  expect(org.slug).toBe(
    name.toLowerCase().replace("ü", "ue").replaceAll(" ", "-"),
  );
  const agent = await (
    await page.request.post(`/api/organizations/${org.id}/agents`, {
      data: {
        name: "Анна Помощник",
        description: "Helps residents with their repair requests.",
        instruction: "Help briefly in English or German.",
      },
    })
  ).json();
  const path = `/api/organizations/${org.id}/agents/${agent.id}/publication`;
  const pub = await (
    await page.request.put(path, { data: { enabled: true, origins: [] } })
  ).json();
  expect(new URL(pub.url).pathname).toBe(`/a/${org.slug}/anna-pomoshchnik`);
  await page.goto(`/app/${org.slug}/agents/${agent.id}/publish`);
  await expect(page.getByLabel("Share link")).toHaveValue(pub.url);
  const qr = page.getByRole("img", { name: "QR code for this link" });
  await expect(qr).toBeVisible();
  const png = PNG.sync.read(
    Buffer.from((await qr.getAttribute("src"))!.split(",")[1], "base64"),
  );
  expect(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
  ).toBe(pub.url);
  await page.goto(pub.url);
  await expect(
    page.getByRole("heading", { name: "Talk to Анна Помощник" }),
  ).toBeVisible();
  await expect(page.locator(".public-agent-description")).toHaveText(
    "Helps residents with their repair requests.",
  );
  const started = page.waitForResponse(
    (r) => r.url().endsWith("/sessions") && r.ok(),
  );
  await page.getByRole("button", { name: "Start a chat", exact: true }).click();
  const session = await (await started).json();
  await expect(page.locator(".agent-avatar")).toHaveAttribute(
    "data-online",
    "true",
    { timeout: 30000 },
  );
  await page.reload();
  await expect(page.locator(".agent-avatar")).toHaveAttribute(
    "data-online",
    "true",
    { timeout: 30000 },
  );
  expect(new URL(page.url()).pathname).toBe(
    `/a/${org.slug}/anna-pomoshchnik/conversations/${session.id}`,
  );
  await page.screenshot({ path: "artifacts/readable-slugs/conversation.png" });
  const obsolete = await page.request.get(`/a/${pub.id}`);
  expect(obsolete.status()).toBe(404);
  expect(
    (await page.request.get(`/api/public/agents/${pub.id}`)).status(),
  ).toBe(404);
  await page.request.put(path, { data: { enabled: false, origins: [] } });
  await page.goto(pub.url);
  await expect(
    page.getByText("This agent is not published", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a chat", exact: true }),
  ).toBeDisabled();
});
