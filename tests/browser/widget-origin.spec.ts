import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

test("widget works on a separate website and isolates guest histories", async ({
  page,
  request,
}) => {
  const server = createServer((req, res) =>
    res.end(
      "<!doctype html><title>Partner website</title><h1>Partner website</h1>",
    ),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
  try {
    await request.post("/api/auth/register", {
      data: {
        name: "Widget owner",
        email: `widget-${Date.now()}@example.com`,
        password: "test-widget-password",
      },
    });
    const org = (
      await (
        await request.post("/api/organizations", {
          data: { name: "Widget test" },
        })
      ).json()
    ).id;
    const agent = (
      await (
        await request.post(`/api/organizations/${org}/agents`, {
          data: {
            name: "Ada",
            instruction: "You answer questions briefly.",
            config: { llm: "mistral-large-latest" },
          },
        })
      ).json()
    ).id;
    const pub = (
      await (
        await request.put(
          `/api/organizations/${org}/agents/${agent}/publication`,
          { data: { enabled: true, origins: [origin] } },
        )
      ).json()
    ).id;
    await page.goto(origin);
    await page.evaluate(
      ({ pub }) => {
        const script = document.createElement("script");
        script.src = "http://localhost:8180/widget.js";
        script.dataset.agent = pub;
        document.body.append(script);
      },
      { pub },
    );
    const firstSession = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/public/${pub}/sessions`) &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Open agent widget" }).click();
    await page.getByRole("button", { name: "Start a chat" }).click();
    const first = await (await firstSession).json();
    const frame = page.frameLocator("iframe");
    await expect(frame.locator(".message.assistant")).toContainText("Ada", {
      timeout: 25000,
    });
    await frame
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("What is two plus two? Please answer with the digit.");
    await frame.getByRole("textbox", { name: "Message", exact: true }).press("Enter");
    await expect(frame.locator(".message.assistant").last()).toContainText(
      /4|four/,
      { timeout: 25000 },
    );
    const second = await (
      await request.post(`/api/public/${pub}/sessions`, {
        headers: { Origin: origin },
        data: { mode: "text" },
      })
    ).json();
    expect(
      (
        await request.get(`/api/public/conversations/${second.id}`, {
          headers: { "x-guest-token": first.guest_token },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get(`/api/public/conversations/${first.id}`, {
          headers: { "x-guest-token": first.guest_token },
        })
      ).status(),
    ).toBe(200);
    await request.put(`/api/organizations/${org}/agents/${agent}/publication`, {
      data: { enabled: false, origins: [origin] },
    });
    expect(
      (
        await request.post(`/api/public/${pub}/sessions`, {
          headers: { Origin: origin },
          data: { mode: "text" },
        })
      ).status(),
    ).toBe(403);
    await frame.getByRole("button", { name: "Close conversation" }).click();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
