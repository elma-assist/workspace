import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`conversation deep link keeps a stable full-form loader at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const info = await (
      await page.request.get("/api/public/agents/nordhaus/emma")
    ).json();
    const created = await page.request.post(
      `/api/public/${info.publication_id}/sessions`,
      { data: { mode: "text" }, headers: { Origin: "http://localhost:8180" } },
    );
    expect(created.ok(), `Session setup: ${created.status()}`).toBeTruthy();
    const session = await created.json();
    await page.addInitScript(
      ({ publication, visitor }) => {
        localStorage.setItem(
          `elma-visitor-${location.origin}-${publication}`,
          visitor,
        );
      },
      { publication: info.publication_id, visitor: session.visitor_token },
    );
    let releaseInfo!: () => void;
    let releaseRequests!: () => void;
    const infoGate = new Promise<void>((resolve) => {
      releaseInfo = resolve;
    });
    const requestsGate = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });
    await page.route("**/api/public/agents/nordhaus/emma", async (route) => {
      await infoGate;
      await route.continue();
    });
    await page.route(
      "**/api/public/conversations/*/requests",
      async (route) => {
        await requestsGate;
        await route.continue();
      },
    );
    const url = `/a/nordhaus/emma/conversations/${session.id}/requests/list`;
    try {
      await page.goto(url);
      const frame = page.locator(".public-agent-chat");
      const loading = page.getByLabel("Loading conversation", { exact: true });
      await expect(loading).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Talk to|Open conversation/ }),
      ).toHaveCount(0);
      const initial = await frame.boundingBox();
      releaseInfo();
      await expect(frame.locator(".chat-workspace")).toHaveCount(1);
      await expect(loading).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Start call" }),
      ).not.toBeVisible();
      await expect(frame.locator(".public-agent-chat-content")).toHaveAttribute(
        "inert",
        "",
      );
      expect(await frame.boundingBox()).toEqual(initial);
      releaseRequests();
      await expect(frame).toHaveAttribute("aria-busy", "false", {
        timeout: 30000,
      });
      await expect(loading).not.toBeVisible();
      await expect(frame.locator(".request-panel")).toBeVisible();
      await expect(frame.locator(".chat-workspace")).toHaveClass(
        /with-requests/,
      );
      expect(await frame.boundingBox()).toEqual(initial);
      expect(new URL(page.url()).pathname).toContain(
        `/conversations/${session.id}`,
      );
      expect(new URL(page.url()).search).toBe("");
      await page.screenshot({
        path: `artifacts/public-loading/restored-${width}.png`,
      });

      // A failed restore replaces the loader with an actionable error in the same frame.
      await page.route(
        `**/api/public/${info.publication_id}/sessions`,
        (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Temporary connection failure" }),
          }),
        { times: 1 },
      );
      await page.reload();
      await expect(frame.getByRole("alert")).toContainText(
        "Temporary connection failure",
      );
      await expect(loading).not.toBeVisible();
      expect(await frame.boundingBox()).toEqual(initial);
      await frame.getByRole("button", { name: "Retry", exact: true }).click();
      await expect(frame).toHaveAttribute("aria-busy", "false", {
        timeout: 30000,
      });
      await expect(frame.locator(".request-panel")).toBeVisible();
    } finally {
      releaseInfo();
      releaseRequests();
    }
  });
}
