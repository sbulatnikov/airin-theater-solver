import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const v1Html = await readFile(resolve(root, ".build/v1/index.html"), "utf8");
const v2Html = await readFile(resolve(root, ".build/v2/index.html"), "utf8");
const v1Version = JSON.parse(await readFile(resolve(root, "apps/v1/package.json"), "utf8")).version;
const v2Version = JSON.parse(await readFile(resolve(root, "apps/v2/package.json"), "utf8")).version;

if (!v1Html.includes(v1Version) || v1Html.includes(v2Version)) {
  throw new Error("Сборка v1 содержит неверную версию или зависимость v2.");
}
if (!v2Html.includes(v2Version) || v2Html.includes(v1Version)) {
  throw new Error("Сборка v2 содержит неверную версию или зависимость v1.");
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
