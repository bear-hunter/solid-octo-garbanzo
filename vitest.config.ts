import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ test: { environment: "node" }, resolve: { alias: { "@acme/credentials": fileURLToPath(new URL("./packages/credentials/src/index.ts", import.meta.url)) } } });
