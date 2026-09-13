import { test, expect, type Page } from "@playwright/test";

async function selectLanguage(page: Page, language: "English" | "Deutsch") {
  await page.locator(".language-trigger").click();
  await page
    .getByRole("menuitemradio", { name: language, exact: true })
    .click();
}

// Browser language must not override the explicit English initial default.
test.use({ locale: "de-DE" });

test("English default, explicit German selection and metadata survive reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-language="en"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const sources = await page
    .locator(".source-link")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
  await selectLanguage(page, "Deutsch");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page).toHaveTitle("Elma — Bewohneranliegen delegieren.");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Hausverwaltungen/,
  );
  await expect(page.locator("h1")).toContainText("Entlasten Sie Ihr Team.");
  await expect(page.locator(".stat-number")).toHaveText("62,1%");
  await expect(page.locator(".owner-stat")).toContainText(
    "Wohnungseigentümern in Deutschland",
  );
  expect(
    await page
      .locator(".source-link")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
  ).toEqual(sources);
  await page
    .getByRole("button", { name: "Schritt 4: Prüfen", exact: true })
    .click();
  await expect(page.locator(".context-status")).toHaveText(
    "Prüfung durch Ihr Team",
  );
  await expect(
    page.getByRole("button", { name: "Animation abspielen", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator('[data-language="de"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await selectLanguage(page, "English");
  await expect(page.locator(".context-status")).toHaveText("Conversation");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".stat-number")).toHaveText("62.1%");
});

test("German remains selectable without storage and translates demo errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  await page.route("**/api/demo", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await selectLanguage(page, "Deutsch");
  await expect(page.locator(".widget-error").first()).toContainText(
    "vorübergehend nicht verfügbar",
  );
  await expect(page.locator(".widget-error").last()).toContainText(
    "vorübergehend nicht verfügbar",
  );
  for (const button of await page.locator("[data-open-agent]").all())
    await expect(button).toBeDisabled();
  await selectLanguage(page, "English");
  await expect(page.locator(".widget-error").first()).toContainText(
    "temporarily unavailable",
  );
});

test("German copy and all illustration steps fit narrow and wide layouts", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await selectLanguage(page, "Deutsch");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (let step = 0; step < 4; step++) {
      await page.locator(`[data-step-button="${step}"]`).click();
      expect(
        await page
          .locator(".scene.is-active")
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        `scene ${step} at ${width}px`,
      ).toBe(true);
    }
  }
  await page
    .getByRole("button", { name: "Elma ausprobieren", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Start a chat", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Start a voice conversation",
      exact: true,
    }),
  ).toBeVisible();
});

test("compact language menu supports keyboard, selection and dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.locator(".language-trigger");
  const menu = page.getByRole("menu");
  const english = page.getByRole("menuitemradio", {
    name: "English",
    exact: true,
  });
  const german = page.getByRole("menuitemradio", {
    name: "Deutsch",
    exact: true,
  });
  const initialURL = page.url();
  await expect(trigger).toHaveAccessibleName("Language: English");
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(english).toBeFocused();
  await english.press("End");
  await expect(german).toBeFocused();
  await german.press("Home");
  await expect(english).toBeFocused();
  await english.press("ArrowUp");
  await expect(german).toBeFocused();
  await german.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleName("Sprache: Deutsch");
  await expect(trigger).toContainText("DE");
  await expect(menu).toBeHidden();
  expect(page.url()).toBe(initialURL);
  await trigger.press("Space");
  await expect(german).toBeFocused();
  await expect(german).toHaveAttribute("aria-checked", "true");
  await german.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.locator("h1").click();
  await expect(menu).toBeHidden();
  await trigger.click();
  await german.press("Tab");
  await expect(menu).toBeHidden();
  await expect(trigger).not.toBeFocused();
  await trigger.click();
  await german.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(menu).toBeHidden();
});
