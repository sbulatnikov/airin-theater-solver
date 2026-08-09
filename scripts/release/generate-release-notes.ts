import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { requireEnvironment } from "../shared/command.ts";
import { generateReleaseNotes } from "./release-notes.ts";

const [previousTag, target, outputPath] = process.argv.slice(2);
if (!previousTag || !target || !outputPath) {
  throw new Error("Использование: tsx scripts/release/generate-release-notes.ts <previous-tag> <target> <output-path>");
}

const notes = await generateReleaseNotes(
  previousTag,
  target,
  requireEnvironment("GITHUB_REPOSITORY"),
  requireEnvironment("GITHUB_TOKEN")
);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, notes, "utf8");
console.log(`Сформирован Change Log для ${previousTag}..${target}: ${outputPath}`);
