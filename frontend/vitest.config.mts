import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The pages read these off process.env at runtime. Next inlines them at
    // build time, so the test run has to supply them itself.
    env: {
      NEXT_PUBLIC_API_URL: "http://api.test",
    },
    include: ["app/**/*.test.{ts,tsx}"],
    // Undo vi.stubGlobal / vi.spyOn between tests so a stubbed fetch cannot
    // leak into the next case.
    unstubGlobals: true,
    restoreMocks: true,
  },
});
