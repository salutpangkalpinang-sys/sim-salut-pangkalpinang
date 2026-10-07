import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
if (!BASE_URL.includes("localhost") && !BASE_URL.includes("127.0.0.1")) {
  throw new Error(`SECURITY_ALERT: Playwright test target must strictly be localhost or 127.0.0.1. Attempted: ${BASE_URL}`);
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: BASE_URL,
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
