import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// A silent fake device exercises browser permissions without recording a real microphone.
mkdirSync("artifacts", { recursive: true });
const pcm = Buffer.alloc(48000 * 2 * 30),
  wav = Buffer.alloc(44 + pcm.length);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(pcm.length, 40);
writeFileSync("artifacts/silent-device.wav", wav);
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${resolve("artifacts/silent-device.wav")}`,
    ],
  },
});

test("voice and text switch inside one browser conversation", async ({
  page,
}) => {
  let sessions = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/sessions")) sessions++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open agent widget" }).click();
  await page.getByRole("button", { name: "Start a chat" }).click();
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("button", { name: "Send message" })).toHaveCount(
    0,
  );
  await expect(frame.locator("form .call-button")).toHaveCount(1);
  await expect(frame.locator(".chat-state")).toContainText(
    /Ready for your message|Agent is responding/i,
    { timeout: 25000 },
  );
  await expect(
    frame.locator(".conversation-header .agent-avatar"),
  ).toHaveAttribute("data-online", "true");
  await expect(
    frame.locator(".conversation-header .agent-avatar-track"),
  ).toHaveCSS("stroke", "rgb(64, 192, 87)");
  await frame.locator("body").evaluate(() => {
    const target = window as unknown as {
      elmaTestPeak: number;
      elmaPhases: string[];
      elmaOpacities: number[];
      elmaDirections: string[];
    };
    target.elmaTestPeak = 0;
    target.elmaPhases = [];
    target.elmaOpacities = [];
    target.elmaDirections = [];
    new MutationObserver(() => {
      target.elmaDirections.push(
        document
          .querySelector(".call-direction")
          ?.getAttribute("data-direction") || "none",
      );
      const meter = document.querySelector('[role="meter"]');
      target.elmaTestPeak = Math.max(
        target.elmaTestPeak,
        Number(meter?.getAttribute("aria-valuenow") || 0),
      );
      const avatar = document.querySelector(".agent-avatar");
      target.elmaPhases.push(avatar?.getAttribute("data-phase") || "");
      const signal = document.querySelector(
        ".call-participants .agent-avatar-signal",
      );
      if (signal && avatar?.getAttribute("data-phase") === "speaking") {
        target.elmaOpacities.push(
          Number((signal as SVGElement).style.strokeOpacity),
        );
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-valuenow",
        "data-phase",
        "data-direction",
        "style",
      ],
    });
  });
  await frame.getByRole("button", { name: "Start call", exact: true }).click();
  await expect(frame.getByRole("button", { name: "End call" })).toBeVisible();
  const initialHeight = (await frame
    .locator(".conversation-header")
    .boundingBox())!.height;
  await expect(frame.locator(".voice-activity")).toHaveCount(0);
  await expect(frame.locator(".call-participants .agent-avatar")).toBeVisible();
  await expect(frame.locator(".call-direction")).toBeVisible();
  const ringSize = await frame
    .locator(".conversation-header .agent-avatar")
    .boundingBox();
  expect(ringSize?.width).toBe(48);
  expect(ringSize?.height).toBe(48);
  await expect(frame.locator(".agent-description")).toContainText("Nordhaus");
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Say hello in one short sentence.");
  await frame
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await expect(frame.locator(".message.assistant")).toHaveCount(2, {
    timeout: 25000,
  });
  await expect(frame.locator(".message.assistant").last()).toContainText(
    /hello|hi|welcome/i,
    { timeout: 25000 },
  );
  await expect
    .poll(() =>
      frame.locator("audio").evaluateAll((elements) =>
        elements.some((e) => {
          const audio = e as HTMLAudioElement;
          return (
            audio.srcObject instanceof MediaStream &&
            audio.srcObject
              .getAudioTracks()
              .some((t) => t.readyState === "live")
          );
        }),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      frame
        .locator("body")
        .evaluate(
          () => (window as unknown as { elmaTestPeak: number }).elmaTestPeak,
        ),
    )
    .toBeGreaterThan(0);
  expect(
    (await frame.locator(".conversation-header").boundingBox())!.height,
  ).toBe(initialHeight);
  const animation = await frame.locator("body").evaluate(() => {
    const target = window as unknown as {
      elmaPhases: string[];
      elmaOpacities: number[];
      elmaDirections: string[];
    };
    return {
      phases: target.elmaPhases,
      directions: target.elmaDirections,
      range:
        Math.max(...target.elmaOpacities) - Math.min(...target.elmaOpacities),
    };
  });
  expect(animation.phases).toContain("busy");
  expect(animation.phases).toContain("speaking");
  expect(animation.range).toBeGreaterThan(0.05);
  expect(animation.directions).toContain("right");
  expect(animation.directions).not.toContain("left");
  await expect(
    frame.locator(".conversation-header .agent-avatar-track"),
  ).toHaveCSS("stroke", "rgb(64, 192, 87)");
  await expect(
    frame.getByRole("meter", { name: "Your microphone level" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await page.screenshot({
    path: "artifacts/voice-feedback.png",
    fullPage: true,
  });
  await frame.getByRole("button", { name: "End call", exact: true }).click();
  await expect(
    frame.getByRole("button", {
      name: "Start call",
      exact: true,
    }),
  ).toBeVisible();
  expect(sessions).toBe(1);
  await expect(frame.locator(".call-participants .agent-avatar")).toHaveCount(
    0,
  );
  await expect(frame.locator(".call-direction")).toHaveCount(0);
  await expect(
    frame.locator(".conversation-header .agent-avatar"),
  ).toHaveAttribute("data-online", "true");
  await expect(
    frame.locator(".conversation-header .agent-avatar-track"),
  ).toHaveCSS("stroke", "rgb(64, 192, 87)");
  await frame.getByRole("button", { name: "Close conversation" }).click();
});
