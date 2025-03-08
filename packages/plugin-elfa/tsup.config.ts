import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    target: "es2022",
    external: [
        "@elizaos/core",
        "axios",
        "zod"
    ],
    dts: {
        resolve: true,
        entry: {
            index: "src/index.ts"
        }
    },
    treeshake: true,
    splitting: false,
    bundle: true
});