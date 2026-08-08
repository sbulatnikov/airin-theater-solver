import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const v1Html = await readFile(resolve(root, ".build/v1/index.html"), "utf8");
const v2Html = await readFile(resolve(root, ".build/v2/index.html"), "utf8");
const v1Version = JSON.parse(await readFile(resolve(root, "apps/v1/package.json"), "utf8")).version;
const v2Version = JSON.parse(await readFile(resolve(root, "apps/v2/package.json"), "utf8")).version;

const builds = [
  { name: "v1", html: v1Html, version: v1Version, marker: "classic", foreignMarker: "strategy-tree" },
  { name: "v2", html: v2Html, version: v2Version, marker: "strategy-tree", foreignMarker: "classic" }
];

for (const build of builds) {
  if (
    !build.html.includes(build.version) ||
    !build.html.includes(build.marker) ||
    build.html.includes(build.foreignMarker)
  ) {
    throw new Error(`Сборка ${build.name} содержит код или метаданные другого поколения.`);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "v1"), { recursive: true });
await mkdir(resolve(dist, "v2"), { recursive: true });
await copyFile(resolve(root, ".build/v1/index.html"), resolve(dist, "v1/index.html"));
await copyFile(resolve(root, ".build/v2/index.html"), resolve(dist, "v2/index.html"));
await writeFile(resolve(dist, ".nojekyll"), "", "utf8");
await writeFile(
  resolve(dist, "index.html"),
  `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=./v2/">
    <title>Суфлёр</title>
  </head>
  <body><p><a href="./v2/">Открыть актуальную версию Суфлёра</a></p></body>
</html>
`,
  "utf8"
);

console.log("Собрано: dist/v1/index.html и dist/v2/index.html");
