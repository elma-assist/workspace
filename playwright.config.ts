import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 90000,
  projects: [
    { name: "desktop", testIgnore: "**/mobile.spec.ts" },
    {
      name: "mobile-chromium",
      testMatch: "**/mobile.spec.ts",
      grep: /small-android|android/,
      use: { browserName: "chromium" },
    },
    {
      name: "mobile-webkit",
      testMatch: "**/mobile.spec.ts",
      grep: /iphone|tablet/,
      use: { browserName: "webkit" },
    },
    {
      name: "forms-webkit",
      testMatch: "**/forms.spec.ts",
      grep: /mobile form/,
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "sharing-webkit",
      testMatch: "**/sharing.spec.ts",
      grep: /public agent page and sharing QR/,
      use: {
        browserName: "webkit",
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-voice",
      testMatch: "**/voice-ui.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  use: {
    actionTimeout: 15000,
    baseURL: "http://localhost:8180",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:8180",
          localStorage: [
            {
              name: "elma-site-privacy-v1",
              value: "accepted",
            },
          ],
        },
      ],
    },
  },
  reporter: [["list"]],
});
