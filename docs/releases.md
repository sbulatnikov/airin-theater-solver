# Релизы репозитория

Репозиторий выпускается целиком по календарной схеме JetBrains `YYYY.R[.B]`: `2026.1` — функциональный релиз,
`2026.1.1` — его первый hotfix, `2026.2` — следующий функциональный релиз. SemVer компонентов v1/v2 независим.

В пределах года функциональный номер увеличивается последовательно. При смене календарного года он начинается с
единицы: после `2026.4` следующим функциональным выпуском в 2027 году будет `2027.1`. Hotfix сохраняет год и minor
исправляемой линии, поэтому выпущенный в январе hotfix для `2026.4` называется `2026.4.1`.

![Релизный цикл](images/release-cycle.png)

## Функциональный релиз

1. Рабочие PR в `main` проходят CI и review, но остаются открытыми.
2. Maintainer выполняет `pnpm rc:create` и вручную выбирает состав через `pnpm rc:add <PR>`.
3. Каждый выбранный PR становится одним squash-коммитом с номером исходного PR и contributor.
4. После завершения состава `pnpm release:prepare <next-release>` датирует `Unreleased` и синхронизирует общую версию.
5. RC пушится и открывает единственный PR в `main`.
6. После ручного Code Freeze ветка блокируется, создаётся неизменяемый RC-тег, а RC PR принимается через rebase merge.
7. Обновление `main` создаёт стабильный тег, production build, GitHub Release и GitHub Pages.

Merge документационного PR из `docs/*` или инфраструктурного PR из `ci/*` в `main` не является выпуском: для него не
создаются версия, тег, Release, артефакты и deployment приложения. Эти изменения проходят отдельный flow, описанный в
[`branches.md`](branches.md).

Если текущий стабильный тег `2026.1`, ветка первого кандидата называется `rc/2026.1-rc.1`, а после её принятия
появляется стабильный релиз `2026.2`. Push в одну RC-ветку не увеличивает номер кандидата. Если кандидат отброшен,
создаётся новая ветка с очередным номером; одновременно открыт только один RC PR.

## Code Freeze

Отдельный workflow `.github/workflows/rc.yml` (`Prepare Release Candidate`) появляется только после успешного
push-pipeline `rc/*`. Job
`Code Freeze` ожидает ручного approval в Environment `release-freeze`, затем:

1. проверяет имя ветки, будущую версию, происхождение от стабильного тега и единственный открытый RC PR;
2. включает read-only Branch Protection для точной RC-ветки;
3. создаёт аннотированный тег вида `2026.1-rc.1`.

RC не деплоится. После Freeze любое исправление требует нового кандидата.

## Hotfix

Hotfix не использует RC:

```bash
git switch -c hotfix/short-description origin/main
# изменение, тест и запись в CHANGELOG.md / Unreleased
pnpm release:prepare 2026.1.1
```

Hotfix PR направляется в `main`, проходит approval и все проверки, затем принимается одним squash-коммитом, subject
которого заканчивается номером PR. Release pipeline разрешает только следующий patch; следующий minor из hotfix запрещён.

## CHANGELOG и Change Log

Это два разных представления:

- `CHANGELOG.md` редактируется в рабочих ветках и содержит краткую пользовательскую историю всех стабильных версий;
- `RELEASE_NOTES.md` генерируется pipeline только для текущего релиза из commit range между стабильными тегами.

Для каждого релизного коммита генератор извлекает `#PR`, запрашивает через GitHub API ссылку и contributor и формирует
строку со ссылками на commit, PR и профиль автора. Коммит без `#PR` или явного `Release-Notes: skip` останавливает
pipeline до создания стабильного тега.

GitHub Release получает `RELEASE_NOTES.md` как body. В его assets публикуются production archive, `RELEASE_NOTES.md`,
полный `CHANGELOG.md` и `SHA256SUMS.txt`.

## Pipeline рабочих веток

`.github/workflows/ci.yml` запускается для `dependabot/*`, `feat/*`, `fix/*`, `rc/*` и `hotfix/*`. Job установки
зависимостей наполняет pnpm cache, после чего параллельно выполняются напрямую обязательные `Lint`, `Typecheck`,
`Unit tests`, `Build` и `E2E tests`. Агрегирующей job нет.

## Правила GitHub

- `main` принимает изменения только через PR с approval, разрешёнными review threads, пятью checks и линейной историей;
- force push и удаление `main` запрещены;
- существующие tags нельзя переносить или удалять;
- merge commits отключены; рабочие и hotfix PR используют squash, RC PR — rebase merge;
- Environment `release-freeze` требует reviewer и содержит `REPOSITORY_ADMIN_TOKEN` с Administration: write.

Импортируемые rulesets находятся в `.github/rulesets`. Подробное назначение веток и команды maintainer описаны в
[branches.md](branches.md).
