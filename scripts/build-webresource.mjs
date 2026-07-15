import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const vite = resolve(root, "node_modules", "vite", "bin", "vite.js");

execFileSync(process.execPath, [vite, "build"], {
  cwd: root,
  stdio: "inherit",
});

const indexPath = resolve(dist, "index.html");
const readAsset = (assetUrl) => {
  if (!assetUrl.startsWith("/assets/")) {
    throw new Error(`Asset inesperado no webresource: ${assetUrl}`);
  }
  return readFileSync(resolve(dist, assetUrl.slice(1)), "utf8");
};

let html = readFileSync(indexPath, "utf8");
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*href="(\/assets\/[^"?]+\.css)"[^>]*>/g,
  (_, assetUrl) => `<style>${readAsset(assetUrl)}</style>`,
);
html = html.replace(
  /<script\s+type="module"[^>]*src="(\/assets\/[^"?]+\.js)"[^>]*><\/script>/g,
  (_, assetUrl) => `<script type="module">${readAsset(assetUrl)}</script>`,
);

if (/\b(?:src|href)="\/assets\//.test(html)) {
  throw new Error("Build ainda contém referência externa em /assets.");
}

writeFileSync(indexPath, html, "utf8");
console.log("[webresource] dist/index.html pronto para Dataverse: JS, CSS e fontes incorporados.");
