import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`numbered draft can be deleted and its confirmation restored at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const info = await (
      await page.request.get("/api/public/agents/nordhaus/emma")
    ).json();
    const created = await page.request.post(
      `/api/public/${info.publication_id}/sessions`,
      {
        data: { mode: "text" },
        headers: { Origin: "http://localhost:8180" },
      },
    );
    expect(created.ok()).toBeTruthy();
    const session = await created.json();
    const base = `/api/public/conversations/${session.id}`;
    const headers = { "X-Guest-Token": session.guest_token };
    const forms = await (
      await page.request.get(base + "/forms", { headers })
    ).json();
    const response = await page.request.post(base + "/requests", {
      headers,
      data: { form_id: forms[0].id },
    });
    expect(response.ok()).toBeTruthy();
    const draft = await response.json();
    expect(draft.code).toMatch(/^[A-Z]+[0-9]{2}$/);
    await page.addInitScript(
      ({ publication, visitor }) => {
        localStorage.setItem(
          `elma-visitor-${location.origin}-${publication}`,
          visitor,
        );
      },
      { publication: info.publication_id, visitor: session.visitor_token },
    );
    await page.goto(
      `/a/nordhaus/emma/conversations/${session.id}/requests/${draft.id}`,
    );
    await expect(page.locator(".public-agent-chat")).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: 30000 },
    );
    const panel = page.locator(".request-panel");
    await expect(
      panel.getByText(`Request ${draft.code}`, { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: `Delete draft ${draft.code}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/delete/${draft.id}$`));
    let dialog = page.getByRole("dialog", {
      name: `Delete draft ${draft.code}`,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await panel
      .getByRole("button", { name: `Delete draft ${draft.code}`, exact: true })
      .click();
    await page.reload();
    dialog = page.getByRole("dialog", {
      name: `Delete draft ${draft.code}`,
      exact: true,
    });
    await expect(dialog).toBeVisible({ timeout: 30000 });
    let deletes = 0;
    await page.route(`**${base}/requests/${draft.id}`, async (route) => {
      if (route.request().method() === "DELETE") {
        deletes++;
        await new Promise((r) => setTimeout(r, 700));
      }
      await route.continue();
    });
    const remove = dialog.getByRole("button", {
      name: "Delete draft",
      exact: true,
    });
    await remove.click();
    await expect(remove).toHaveAttribute("aria-busy", "true");
    await expect(remove).toBeDisabled();
    await expect(dialog).not.toBeVisible();
    await expect(panel.getByText("Nothing here yet")).toBeVisible();
    expect(deletes).toBe(1);
    await page.reload();
    await expect(panel.getByText("Nothing here yet")).toBeVisible({
      timeout: 30000,
    });

    await panel.getByRole("combobox", { name: "Start a request" }).click();
    await page
      .getByRole("option", { name: forms[0].name, exact: true })
      .click();
    await panel.getByRole("button", { name: "Open form", exact: true }).click();
    const nextTitle = panel.getByText(/^Request [A-Z]+[0-9]{2}$/, {
      exact: true,
    });
    await expect(nextTitle).toBeVisible();
    const nextCode = (await nextTitle.innerText()).replace("Request ", "");
    expect(nextCode).not.toBe(draft.code);
    await page.screenshot({
      path: `artifacts/request-codes/request-${width}.png`,
    });
    await panel
      .getByRole("button", { name: `Delete draft ${nextCode}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete draft", exact: true })
      .click();
    await expect(panel.getByText("Nothing here yet")).toBeVisible();
  });
}
