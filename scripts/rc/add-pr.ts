import { parseCandidateTag } from "../release-version.ts";
import { run, succeeds } from "../shared/command.ts";
import { currentGitHubRepository, pullRequest } from "../shared/github.ts";

const [numberArgument] = process.argv.slice(2);
const number = Number(numberArgument);
if (!Number.isSafeInteger(number) || number < 1) {
  throw new Error("Использование: pnpm rc:add <PR>, например pnpm rc:add 42");
}
if (run("git", ["status", "--porcelain=v1"])) {
  throw new Error("Перед добавлением PR рабочее дерево должно быть чистым.");
}

const branch = run("git", ["branch", "--show-current"]);
const candidate = branch.startsWith("rc/") ? parseCandidateTag(branch.slice(3)) : undefined;
if (!candidate)
  throw new Error(`Команда rc:add доступна только в RC-ветке, текущая ветка: ${branch || "detached HEAD"}.`);
if (succeeds("git", ["log", "--fixed-strings", "--grep", `(#${number})`, "-1", "--format=%H"])) {
  const existing = run("git", ["log", "--fixed-strings", "--grep", `(#${number})`, "-1", "--format=%H"]);
  if (existing) throw new Error(`PR #${number} уже представлен коммитом ${existing.slice(0, 7)} в RC.`);
}

const repository = currentGitHubRepository();
const pull = await pullRequest(repository, number, process.env.GITHUB_TOKEN);
if (pull.state !== "open") throw new Error(`PR #${number} закрыт и не может быть добавлен в RC.`);
if (pull.draft) throw new Error(`PR #${number} всё ещё является draft.`);
if (pull.base.ref !== "main") throw new Error(`PR #${number} направлен в ${pull.base.ref}, ожидался main.`);

const fetchedRef = `refs/remotes/origin/pr/${number}`;
run("git", ["fetch", "--force", "origin", `pull/${number}/head:${fetchedRef}`]);
const changedFiles = run("git", ["diff", "--name-only", `origin/main...${fetchedRef}`]).split(/\r?\n/);
if (!changedFiles.includes("CHANGELOG.md")) {
  throw new Error(`PR #${number} не обновляет CHANGELOG.md в разделе Unreleased.`);
}

try {
  run("git", ["merge", "--squash", "--no-commit", fetchedRef]);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Не удалось автоматически squash-ить PR #${number}. Разрешите конфликты, затем создайте commit с суффиксом "(#${number})". ${detail}`
  );
}

if (succeeds("git", ["diff", "--cached", "--quiet"])) {
  throw new Error(`PR #${number} не добавляет новых изменений в текущий RC.`);
}

const title = pull.title.replace(/\s*\(#\d+\)\s*$/, "").trim();
const subject = `${title} (#${number})`;
const author = `${pull.user.login} <${pull.user.id}+${pull.user.login}@users.noreply.github.com>`;
run("git", [
  "commit",
  `--author=${author}`,
  "-m",
  subject,
  "-m",
  `Source-PR: ${pull.html_url}\nSource-Contributor: @${pull.user.login}`
]);

console.log(`PR #${number} добавлен в ${branch} одним squash-коммитом от имени @${pull.user.login}.`);
