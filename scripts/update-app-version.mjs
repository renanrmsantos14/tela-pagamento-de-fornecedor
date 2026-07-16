import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const packagePath = resolve(root, "package.json");
const lockPath = resolve(root, "package-lock.json");
const buildInfoPath = resolve(root, "src", "build-info.js");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const packageLock = JSON.parse(await readFile(lockPath, "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version || "");

if (!match) {
  throw new Error(`Versão inválida em package.json: ${packageJson.version}`);
}

const version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date());
const label = `v${version} ${date}`;

packageJson.version = version;
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;

await Promise.all([
  writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8"),
  writeFile(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8"),
  writeFile(
    buildInfoPath,
    `// Gerado por scripts/update-app-version.mjs. Não editar manualmente.\nexport const APP_VERSION_LABEL = ${JSON.stringify(label)};\n`,
    "utf8",
  ),
]);

console.log(`[version] ${label}`);
