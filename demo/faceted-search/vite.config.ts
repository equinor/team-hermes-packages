import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    printWidth: 119,
  },
  test: {
    include: ["frontend/src/**/*.test.ts"],
  },
});
