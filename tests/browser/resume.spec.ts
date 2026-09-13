import { test, expect } from "@playwright/test";
test("widget restores conversation history and selected draft; agent continues that request", async ({
  page,
}) => {
  test.setTimeout(120000);
  let session: any;
  page.on("response", async (r) => {
    if (
      r.ok() &&
      r.request().method() === "POST" &&
      r.url().endsWith("/sessions")
    )
      session = await r.json();
  });
  const open = async () => {
    await page.getByRole("button", { name: "Open agent widget" }).click();
    await page.getByRole("button", { name: "Start a chat" }).click();
  };
  await page.goto("/");
  await open();
  const f = page.frameLocator("iframe");
  await expect(f.locator(".chat-state")).toContainText(/Ready|responding/i, {
    timeout: 30000,
  });
  const say = async (text: string) => {
    await f.getByRole("textbox", { name: "Message", exact: true }).fill(text);
    await f
      .getByRole("textbox", { name: "Message", exact: true })
      .press("Enter");
  };
  await say(
    "Please open the repair form. My name is Anton. Save my name now. Remember my reference code: emerald bicycle.",
  );
  await expect(f.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton",
    { timeout: 45000 },
  );
  const original = session.id;
  await expect(f.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await f.getByRole("button", { name: "Close conversation" }).click();
  await expect(
    page.getByRole("button", { name: "Open agent widget" }),
  ).toBeVisible();
  await page.reload();
  await open();
  await expect(f.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton",
    { timeout: 15000 },
  );
  expect(session.id).toBe(original);
  expect(session.resumed).toBe(true);
  await expect(f.locator(".chat-messages")).toContainText("emerald bicycle");
  await expect(f.locator(".chat-state")).toContainText(/Ready/i, {
    timeout: 30000,
  });
  await say("What reference code did I give you?");
  await expect(f.locator(".message.assistant").last()).toContainText(
    /emerald bicycle/i,
    { timeout: 30000 },
  );
  await say(
    "My email is anton@example.com. Please fill it in the active request.",
  );
  await expect(f.getByRole("textbox", { name: /^Email/ })).toHaveValue(
    "anton@example.com",
    { timeout: 30000 },
  );
  const headers = { "X-Guest-Token": session.guest_token };
  const path = `/api/public/conversations/${original}`;
  const rows = await (
    await page.request.get(path + "/requests", { headers })
  ).json();
  expect(rows).toHaveLength(1);
  expect(rows[0].answers.name).toBe("Anton");
  expect(rows[0].answers.email).toBe("anton@example.com");
  await page.screenshot({ path: "artifacts/resume/restored-draft.png" });
  // A submitted active request cannot silently turn into a new draft.
  let response = await page.request.post(
    path + `/requests/${rows[0].id}/answers`,
    {
      headers,
      data: {
        revision: rows[0].revision,
        answers: { address: "Lindenstrasse 12", problem: "Broken window" },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  const ready = await response.json();
  response = await page.request.post(path + `/requests/${rows[0].id}/submit`, {
    headers,
    data: { revision: ready.revision, confirmed: true },
  });
  expect(response.ok()).toBeTruthy();
  await expect(
    f.getByText("Request received.", { exact: false }),
  ).toBeVisible();
  await f.getByRole("button", { name: "All requests", exact: true }).click();
  await f.getByRole("combobox", { name: "Start a request" }).click();
  await f.getByRole("option", { name: "Repair request", exact: true }).click();
  await f.getByRole("button", { name: "Open form", exact: true }).click();
  const secondDraftSaved = page.waitForResponse(
    (r) =>
      r.ok() && r.request().method() === "POST" && r.url().endsWith("/answers"),
  );
  await f.getByRole("textbox", { name: /^Your name/ }).fill("Second request");
  await secondDraftSaved;
  await expect(f.getByText("Draft saved.", { exact: false })).toBeVisible();
  await f.getByRole("button", { name: "All requests", exact: true }).click();
  await f.getByRole("button", { name: /Repair request.*New/ }).click();
  await expect(f.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Anton",
  );
  await say(
    "Fill in one more detail for this request: the window is in the kitchen.",
  );
  await expect(f.locator(".message.assistant").last()).toContainText(
    /submitted|read.only|cannot|can't/i,
    { timeout: 30000 },
  );
  expect(
    await (await page.request.get(path + "/requests", { headers })).json(),
  ).toHaveLength(2);
  await f.getByRole("button", { name: "All requests", exact: true }).click();
  await f.getByRole("button", { name: /Repair request.*Draft/ }).click();
  await expect(f.getByRole("textbox", { name: /^Your name/ })).toHaveValue(
    "Second request",
  );
  await say("Save my email second@example.com in the request I just selected.");
  await expect(f.getByRole("textbox", { name: /^Email/ })).toHaveValue(
    "second@example.com",
    { timeout: 30000 },
  );
  const finalRows = await (
    await page.request.get(path + "/requests", { headers })
  ).json();
  expect(finalRows).toHaveLength(2);
  expect(
    finalRows.find((r: { id: string }) => r.id === rows[0].id).answers.email,
  ).toBe("anton@example.com");
});
