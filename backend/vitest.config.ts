import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      ADVISOR_TOOL_SECRET: "0000000000000000000000000000000000000000000000000000000000000000",
      AI_SERVICE_URL: "http://ai-service.local",
    },
  },
});
