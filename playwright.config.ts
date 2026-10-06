import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "edge-desktop",
      use: {
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "edge-mobile",
      use: {
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
