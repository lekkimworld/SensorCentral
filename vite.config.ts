import { defineConfig, Plugin } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { viteStaticCopy } from "vite-plugin-static-copy";

function serviceWorkerPlugin(): Plugin {
    return {
        name: "service-worker-inject",
        writeBundle() {
            const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));
            let sw = readFileSync(resolve(__dirname, "dev/sw/sensorcentral-sw.js"), "utf-8");
            sw = sw.replace("__APP_NAME__", pkg.name).replace("__APP_VERSION__", pkg.version);
            writeFileSync(resolve(__dirname, "public/sw.js"), sw);
        },
    };
}

export default defineConfig({
    build: {
        outDir: "public",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                bundle: resolve(__dirname, "dev/ts/sensorcentral-index.ts"),
            },
            output: {
                entryFileNames: "js/[name].js",
                chunkFileNames: "js/[name].js",
                assetFileNames: (assetInfo) => {
                    if (assetInfo.names?.[0]?.endsWith(".css")) {
                        return "css/[name][extname]";
                    }
                    return "assets/[name][extname]";
                },
            },
        },
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    plugins: [
        serviceWorkerPlugin(),
        viteStaticCopy({
            targets: [
                { src: "dev/images/*", dest: "images", rename: { stripBase: true } },
                { src: "dev/images/icon-32.png", dest: ".", rename: { stripBase: true, name: "favicon.ico" } },
                { src: "dev/manifest.json", dest: ".", rename: { stripBase: true } },
                { src: "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js", dest: "js", rename: { stripBase: true } },
                { src: "node_modules/eonasdan-bootstrap-datetimepicker/build/js/bootstrap-datetimepicker.min.js", dest: "js", rename: { stripBase: true } },
                { src: "node_modules/moment/min/moment-with-locales.min.js", dest: "js", rename: { stripBase: true } },
                { src: "node_modules/font-awesome/fonts/*", dest: "fonts", rename: { stripBase: true } },
            ],
        }),
    ],
    css: {
        preprocessorOptions: {},
    },
});
