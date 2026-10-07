import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';
export default defineConfig({
  testDir: './e2e', workers: 1, reporter: 'list', timeout: 30000,
  use: { baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined) },
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev`, url: baseURL, reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://smd-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', VITE_DEV_PORT: new URL(baseURL).port },
  },
});
