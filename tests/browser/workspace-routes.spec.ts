import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("workspace sections use paths, preserve the shell and restore on reload and browser navigation", async ({
  page,
  context,
}) => {
  const password = readFileSync("infra/local/runtime.env", "utf8")
    .split("\n")
    .find((line) => line.startsWith("SEED_PASSWORD="))!
    .slice(14);
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { email: "admin@example.com", password },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/app/nordhaus/employees");
  await expect(
    page.getByRole("heading", { name: "Employees", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Employees", exact: true }),
  ).toBeVisible();
  await page
    .locator(".mantine-AppShell-root")
    .evaluate((element) => element.setAttribute("data-test-shell", "retained"));
  for (const name of [
    "Agents",
    "Knowledge",
    "Forms",
    "Requests",
    "Conversations",
    "Employees",
    "Usage",
    "Settings",
  ]) {
    const link = page.getByRole("link", { name, exact: true });
    const path = `/app/nordhaus/${name.toLowerCase()}`;
    await expect(link).toHaveAttribute("href", path);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(link).toHaveAttribute("data-active", "true");
    await expect(page.locator(".mantine-AppShell-root")).toHaveAttribute(
      "data-test-shell",
      "retained",
    );
  }
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Usage & balance", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Organization settings", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/app/nordhaus/employees");
  await expect(
    other.getByRole("heading", { name: "Employees", exact: true }),
  ).toBeVisible();
  await other.close();
  await page.goto("/app/nordhaus");
  await expect(page).toHaveURL(/\/app\/nordhaus\/agents$/);
  const unknown = await page.goto("/app/nordhaus/unknown-section");
  expect(unknown?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/nordhaus/employees");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/nordhaus\/forms$/);
  await expect(
    page.getByRole("heading", { name: "Forms", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/workspace-routes/mobile.png" });
});
