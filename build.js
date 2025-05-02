const esbuild = require("esbuild");
const copy = require("esbuild-plugin-copy").default;
const glob = require("glob");

esbuild
  .build({
    entryPoints: glob.sync("src/**/*.js"),
    outdir: "dist",
    bundle: true,
    format: "esm",
    platform: "browser",
    plugins: [
      copy({
        resolveFrom: "cwd",
        assets: [
          { from: ["./src/**/*.html"], to: ["./dist"] },
          { from: ["./src/**/*.css"], to: ["./dist"] },
          { from: ["./src/**/*.{png,jpg,jpeg}"], to: ["./dist"] },
        ],
      }),
    ],
  })
  .catch(() => process.exit(1));
