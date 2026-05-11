import { defineConfig, devices } from "@playwright/test";

<<<<<<< HEAD
/**
 * Playwright E2E test configuration
 * Run tests with: npm run test:e2e
 */
=======
>>>>>>> 4504ffcdf858f3f850d6210db5a5291b0584d44a
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
<<<<<<< HEAD
    baseURL: process.env.E2E_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

=======
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
>>>>>>> 4504ffcdf858f3f850d6210db5a5291b0584d44a
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
<<<<<<< HEAD
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
=======
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
>>>>>>> 4504ffcdf858f3f850d6210db5a5291b0584d44a
