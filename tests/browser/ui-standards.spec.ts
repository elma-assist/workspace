import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function login(page: Page) {
  const password = readFileSync("infra/local/runtime.env", "utf8")
    .split("\n")
    .find((l) => l.startsWith("SEED_PASSWORD="))!
    .slice(14);
  const response = await page.request.post("/api/auth/login", {
    data: { email: "admin@example.com", password },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/app/nordhaus/agents");
  await expect(
    page.getByRole("heading", { name: "Agents", exact: true }),
  ).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`routed editors restore after reload and back/forward at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page
      .getByRole("button", { name: "Edit agent", exact: true })
      .first()
      .click();
    const agentUrl = page.url();
    expect(new URL(agentUrl).pathname).toMatch(/\/agents\/[^/]+\/edit$/);
    expect(new URL(agentUrl).search).toBe("");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Edit agent" }),
    ).toBeVisible();
    await expect(page.getByLabel("Breadcrumbs")).toContainText("Edit agent");
    await expect(
      page.getByRole("textbox", { name: /^Agent name/ }),
    ).toHaveValue("Emma");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: "Edit agent" }),
    ).toBeVisible();
    await page
      .getByLabel("Breadcrumbs")
      .getByRole("link", { name: "Agents", exact: true })
      .click();
    await expect(page).toHaveURL(/\/agents$/);
    await page
      .getByRole("button", { name: "Publish agent", exact: true })
      .first()
      .click();
    const publicationUrl = page.url();
    expect(new URL(publicationUrl).search).toBe("");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /^Publish / }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save publication" }),
    ).toBeEnabled();
    await page
      .getByLabel("Breadcrumbs")
      .getByRole("link", { name: "Agents", exact: true })
      .click();
    await page.goto("/app/nordhaus/forms/new");
    await expect(
      page.getByRole("heading", { name: "Create form" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Create form" }),
    ).toBeVisible();
    await page
      .getByLabel("Breadcrumbs")
      .getByRole("link", { name: "Forms", exact: true })
      .click();
    await expect(page).toHaveURL(/\/forms$/);
    await page.goto("/app/nordhaus/people/invite");
    await expect(
      page.getByRole("heading", { name: "Invite a teammate" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Invite a teammate" }),
    ).toBeVisible();
    await page.goto("/app/nordhaus/knowledge");
    await page
      .getByRole("button", { name: /^Open / })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Add document", exact: true })
      .click();
    expect(new URL(page.url()).pathname).toMatch(
      /\/knowledge\/[^/]+\/add-document$/,
    );
    expect(new URL(page.url()).search).toBe("");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Add document" }),
    ).toBeVisible();
    await expect(page.getByLabel("Breadcrumbs")).toContainText("Add document");
    await page
      .getByLabel("Breadcrumbs")
      .getByRole("link", { name: "Knowledge", exact: true })
      .click();
    await expect(page).toHaveURL(/\/knowledge$/);
    await page.goto("/app/new");
    await expect(
      page.getByRole("heading", { name: "Create organization" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Create organization" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "My organizations", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto(
      new URL(agentUrl).pathname.replace(
        /\/agents\/[^/]+\/edit$/,
        "/agents/00000000-0000-0000-0000-000000000000/edit",
      ),
    );
    await expect(
      page.getByRole("alert").filter({ hasText: /unavailable/i }),
    ).toBeVisible();
    await page.goto(publicationUrl);
    await expect(
      page.getByRole("heading", { name: /^Publish / }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/ui-standards/publication-${width}.png`,
    });
  });
}

test("submit spinner overlays a stable button, blocks duplicate submit and clears after failure", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Edit agent", exact: true })
    .first()
    .click();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/organizations/*/agents/*", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    requests++;
    await Promise.race([
      wait,
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Test save failure" }),
    });
  });
  const save = page.getByRole("button", { name: "Save agent", exact: true });
  const before = await save.boundingBox();
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toBeDisabled();
  await expect(save.locator(".mantine-Button-loader")).toBeVisible();
  const during = await save.boundingBox();
  expect(during!.width).toBe(before!.width);
  expect(during!.height).toBe(before!.height);
  await page.getByRole("textbox", { name: /^Agent name/ }).press("Enter");
  expect(requests).toBe(1);
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "Test save failure" }),
  ).toBeVisible();
  await expect(save).toHaveAttribute("aria-busy", "false");
  await expect(save).toBeEnabled();
});

test("widget URL restores conversation, selected request and share modal", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await expect(page).toHaveURL(/elma-agent=/);
  await page.reload();
  const start = page.getByRole("button", { name: "Start a chat", exact: true });
  await expect(start).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.ok() &&
      r.request().method() === "POST" &&
      r.url().endsWith("/sessions"),
  );
  await start.click();
  const session = await (await response).json();
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("button", { name: "Open side panel", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`elma-conversation=${session.id}`));
  await frame
    .getByRole("button", { name: "Open side panel", exact: true })
    .click();
  await frame.getByRole("combobox", { name: "Start a request" }).click();
  await frame
    .getByRole("option", { name: "Repair request", exact: true })
    .click();
  await frame.getByRole("button", { name: "Open form", exact: true }).click();
  await frame
    .getByRole("textbox", { name: /^Your name/ })
    .fill("Route test Anton");
  await expect(frame.getByText("Draft saved.", { exact: false })).toBeVisible();
  const requestId = new URL(page.url()).searchParams.get("elma-active-request");
  expect(requestId).toBeTruthy();
  await frame.locator("input[type=file]").setInputFiles({
    name: "route-photo.png",
    mimeType: "image/png",
    buffer: readFileSync("apps/landing/public/favicon-32x32.png"),
  });
  await frame.getByRole("button", { name: "View route-photo.png" }).click();
  await expect(page).toHaveURL(/elma-photo=/);
  await page.reload();
  await expect(
    frame.getByRole("dialog", { name: "route-photo.png" }),
  ).toBeVisible({ timeout: 30000 });
  await frame.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).not.toHaveURL(/elma-photo=/);
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Route test Anton",
    { timeout: 30000 },
  );
  await expect(page).toHaveURL(new RegExp(`elma-conversation=${session.id}`));
  await frame
    .getByRole("button", { name: "All requests", exact: true })
    .click();
  await expect(page).toHaveURL(/elma-active-request=list/);
  await page.goBack();
  await expect(frame.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Route test Anton",
  );
  await frame
    .getByRole("button", { name: "Share conversation", exact: true })
    .click();
  await expect(frame.getByLabel("Share link")).toBeVisible();
  await expect(page).toHaveURL(/elma-share-conversation=open/);
  await page.reload();
  await expect(frame.getByLabel("Share link")).toBeVisible({ timeout: 30000 });
  await frame.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).not.toHaveURL(/elma-share-conversation=/);
  await frame
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await expect(page).not.toHaveURL(/elma-agent=/);
});

test("saved form, member access, request and history panels open directly", async ({
  page,
}) => {
  await login(page);
  const orgs = await (await page.request.get("/api/organizations")).json();
  const org = orgs.find((o: { slug: string }) => o.slug === "nordhaus");
  const base = `/api/organizations/${org.id}`;
  const forms = await (await page.request.get(base + "/forms")).json();
  await page.goto(`/app/nordhaus/forms/${forms[0].id}/edit`);
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByRole("heading", { name: "Edit form" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Form name/ })).toHaveValue(
    forms[0].name,
  );
  await page.reload();
  await expect(page.getByRole("textbox", { name: /^Form name/ })).toHaveValue(
    forms[0].name,
  );
  const members = await (await page.request.get(base + "/members")).json();
  const member = members.find((m: { role: string }) => m.role === "employee");
  expect(member).toBeTruthy();
  await page.goto(`/app/nordhaus/people/${member.id}/access`);
  expect(new URL(page.url()).search).toBe("");
  await expect(
    page.getByRole("heading", { name: "Access for " + member.name }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Access for " + member.name }),
  ).toBeVisible();
  const requests = await (await page.request.get(base + "/requests")).json();
  expect(requests.length).toBeGreaterThan(0);
  await page.goto(`/app/nordhaus/requests/${requests[0].id}`);
  expect(new URL(page.url()).search).toBe("");
  await expect(
    page.getByRole("heading", {
      name: `${requests[0].code} · ${requests[0].snapshot.name}`,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: `${requests[0].code} · ${requests[0].snapshot.name}`,
    }),
  ).toBeVisible();
  const conversations = await (
    await page.request.get(base + "/conversations")
  ).json();
  expect(conversations.length).toBeGreaterThan(0);
  await page.goto(`/app/nordhaus/conversations/${conversations[0].id}`);
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator(".history-detail h3")).toHaveText(
    conversations[0].title,
  );
  await page.reload();
  await expect(page.locator(".history-detail h3")).toHaveText(
    conversations[0].title,
  );
});

test("workspace conversation URL resumes the same conversation and nested share dialog", async ({
  page,
}) => {
  await login(page);
  const response = page.waitForResponse(
    (r) =>
      r.ok() &&
      r.request().method() === "POST" &&
      r.url().endsWith("/sessions"),
  );
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .first()
    .click();
  const first = await (await response).json();
  await expect(page).toHaveURL(
    new RegExp(`/agents/[^/]+/conversations/${first.id}$`),
  );
  await expect(page.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Share conversation", exact: true })
    .click();
  await expect(page.getByLabel("Share link")).toBeVisible();
  const resumed = page.waitForResponse(
    (r) =>
      r.ok() &&
      r.request().method() === "POST" &&
      r.url().endsWith("/sessions"),
  );
  await page.reload();
  const second = await (await resumed).json();
  expect(second.id).toBe(first.id);
  expect(second.resumed).toBe(true);
  await expect(page.getByLabel("Share link")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).not.toHaveURL(/\/share$/);
  await page
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/agents$/);
});
