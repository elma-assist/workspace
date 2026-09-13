import { test, expect } from "@playwright/test";

test("call button shows connection and duration, follows local audio and ends the call", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A controlled synthetic input, never the user's physical microphone.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      await ctx.resume();
      const source = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const output = ctx.createMediaStreamDestination();
      source.connect(gain).connect(output);
      source.start();
      (
        window as unknown as {
          micTest: {
            gain: GainNode;
            ctx: AudioContext;
            track: MediaStreamTrack;
          };
        }
      ).micTest = { gain, ctx, track: output.stream.getAudioTracks()[0] };
      return output.stream;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  const message = frame.getByRole("textbox", { name: "Message", exact: true });
  await message.fill("Keep this unsent text while switching the microphone.");
  const mic = frame.locator(".call-control");
  await expect(frame.locator(".call-status")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(frame.getByRole("button", { name: "Start call" })).toHaveCSS(
    "background-color",
    "rgb(64, 192, 87)",
  );
  await expect(frame.locator(".call-button .lucide-phone")).toHaveCount(1);
  const initialCallButton = (await mic.boundingBox())!;
  await frame.getByRole("button", { name: "Start call" }).click();
  await expect(frame.getByRole("button", { name: "End call" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(mic).toHaveAttribute("data-speaking", "false");
  await expect(frame.locator(".call-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect(frame.locator(".call-status").getByRole("status")).toHaveText(
    "On the line",
  );
  await page.mouse.move(0, 0);
  await expect(frame.getByRole("button", { name: "End call" })).toHaveCSS(
    "background-color",
    "rgb(250, 82, 82)",
  );
  await expect(frame.locator(".call-button .lucide-phone-off")).toHaveCount(1);
  await expect(frame.getByRole("timer", { name: "Call duration" })).toHaveText(
    /00:0[1-9]/,
  );
  await expect(message).toHaveValue(
    "Keep this unsent text while switching the microphone.",
  );
  await expect(frame.locator(".message.user")).toHaveCount(0);
  const size = await mic.boundingBox();
  const agentAvatar = frame.locator(".call-participants .agent-avatar");
  await expect(agentAvatar).toBeVisible();
  const agentSize = (await agentAvatar.boundingBox())!;
  const arrowSize = (await frame.locator(".call-direction").boundingBox())!;
  expect(arrowSize.x).toBeGreaterThan(agentSize.x + agentSize.width);
  expect(size!.x).toBeGreaterThan(arrowSize.x + arrowSize.width);
  expect(size!.x + size!.width).toBe(
    initialCallButton.x + initialCallButton.width,
  );
  expect(agentSize.width).toBe(40);
  expect(agentSize.height).toBe(40);
  expect(
    Math.abs(agentSize.y + agentSize.height / 2 - size!.y - size!.height / 2),
  ).toBeLessThan(2);
  const inputSize = (await message.boundingBox())!;
  expect(size!.x).toBeGreaterThan(inputSize.x + inputSize.width);
  expect(
    Math.abs(size!.y + size!.height / 2 - inputSize.y - inputSize.height / 2),
  ).toBeLessThan(2);
  expect(size?.width).toBe(inputSize.height);
  expect(size?.height).toBe(inputSize.height);
  await frame.locator("body").evaluate(() => {
    (
      window as unknown as { micTest: { gain: GainNode } }
    ).micTest.gain.gain.value = 0.12;
  });
  await expect(mic).toHaveAttribute("data-speaking", "true");
  await expect(frame.locator(".call-direction")).toHaveAttribute(
    "data-direction",
    "left",
  );
  await expect(frame.locator(".call-direction")).toHaveCSS("opacity", "1");
  await expect(
    frame.locator(".call-direction .lucide-chevron-right"),
  ).toHaveCount(2);
  await expect
    .poll(() =>
      frame
        .getByRole("meter", { name: "Your microphone level" })
        .getAttribute("aria-valuenow")
        .then(Number),
    )
    .toBeGreaterThan(10);
  expect(
    await frame
      .locator(".call-button svg")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("call-vibration");
  await expect(frame.locator(".call-direction-track svg").first()).toHaveCSS(
    "animation-name",
    "call-chevron-flow",
  );
  await page.screenshot({
    path: "artifacts/microphone-button/speaking-mobile.png",
  });
  await frame.locator("body").evaluate(() => {
    (
      window as unknown as { micTest: { gain: GainNode } }
    ).micTest.gain.gain.value = 0;
  });
  await expect(mic).toHaveAttribute("data-speaking", "false");
  await expect(frame.locator(".call-direction")).toHaveAttribute(
    "data-direction",
    "none",
  );
  await expect(frame.locator(".call-direction")).toHaveCSS("opacity", "0.45");
  await expect(frame.locator(".call-direction-track svg").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  const quietArrow = (await frame.locator(".call-direction").boundingBox())!;
  expect(quietArrow.width).toBe(arrowSize.width);
  expect(quietArrow.x).toBe(arrowSize.x);
  await page.screenshot({
    path: "artifacts/call-direction-stability/idle-mobile.png",
  });
  expect((await mic.boundingBox())?.height).toBe(size?.height);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frame.locator("body").evaluate(() => {
    (
      window as unknown as { micTest: { gain: GainNode } }
    ).micTest.gain.gain.value = 0.12;
  });
  await expect(mic).toHaveAttribute("data-speaking", "true");
  await expect(frame.locator(".call-direction")).toHaveAttribute(
    "data-direction",
    "left",
  );
  await expect(frame.locator(".call-direction")).toHaveCSS("opacity", "1");
  await expect(
    frame.locator(".call-direction .lucide-chevron-right"),
  ).toHaveCount(2);
  expect(
    await frame
      .locator(".call-button svg")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await expect(frame.locator(".call-direction-track svg").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await frame.getByRole("button", { name: "End call" }).click();
  await expect(
    frame.getByRole("button", { name: "Start call" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(frame.locator(".call-status")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(frame.getByRole("button", { name: "Start call" })).toHaveCSS(
    "background-color",
    "rgb(64, 192, 87)",
  );
  await expect
    .poll(() =>
      frame
        .locator("body")
        .evaluate(
          () =>
            (window as unknown as { micTest: { track: MediaStreamTrack } })
              .micTest.track.readyState,
        ),
    )
    .toBe("ended");
  await expect(mic).toHaveAttribute("data-speaking", "false");
  await expect(
    frame.getByRole("meter", { name: "Your microphone level" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await frame.getByRole("button", { name: "Start call" }).click();
  await expect(frame.locator(".call-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect(frame.getByRole("timer", { name: "Call duration" })).toHaveText(
    "00:00",
  );
  await frame.getByRole("button", { name: "End call" }).click();
  await expect(frame.locator(".call-status")).toHaveCount(0);
  await frame.locator("body").evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Microphone permission denied", "NotAllowedError");
    };
  });
  await frame.getByRole("button", { name: "Start call" }).click();
  await expect(
    frame.locator(".conversation-controls").getByRole("alert"),
  ).toContainText("Microphone permission denied");
  await expect(frame.locator(".call-status")).toHaveCount(0);
  await expect(frame.getByRole("button", { name: "Start call" })).toBeEnabled();
});
