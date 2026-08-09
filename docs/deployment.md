# Сборка и публикация

## Автономные HTML-файлы

```bash
pnpm build
```

Vite собирает `apps/v2`. Плагин single-file встраивает JavaScript и CSS внутрь HTML, после чего `scripts/assemble-dist.ts` формирует:

- `dist/v2/index.html`;
- `dist/index.html` с переходом на v2;
- `dist/.nojekyll`.

Каталог `dist` — воспроизводимый артефакт и не хранится в Git.

## GitHub Pages

Workflow `.github/workflows/release.yml` запускается только после принятого pull request, когда обновился `main`.

Этапы workflow:

1. классификация всего невыпущенного диапазона от последнего стабильного тега;
2. автоматический выбор functional/patch версии и, если требуется, защищённый release-коммит в `main`;
3. создание неизменяемого стабильного тега на release-коммите;
4. checkout созданного тега, установка pnpm, Node.js 24 и зависимостей;
5. production-сборка и упаковка `dist` в архив GitHub Release;
6. генерация `RELEASE_NOTES.md`, публикация GitHub Release с SHA-256 и deployment Pages.

Тесты не повторяются после merge: Ruleset уже потребовал успешные Biome, TypeScript, unit, production build и
Playwright E2E jobs на точном head commit Pull Request. Продуктовый PR не меняет календарную версию вручную: release
workflow синхронизирует `package.json`, README и `CHANGELOG.md` атомарным bot-коммитом перед созданием тега.

После первого push откройте **Settings → Pages** и выберите **Source: GitHub Actions**.

Для репозитория, опубликованного по адресу `https://user.github.io/repository/`, приложение доступно по адресу:

- `https://user.github.io/repository/v2/`.

Относительные пути и `base: "./"` позволяют тем же файлам работать как в подпапке GitHub Pages, так и локально через `file://`.

Все сторонние Actions закреплены по полным commit SHA. Права выдаются отдельно: только job подготовки релиза получает
`contents: write`, а `pages: write` и OIDC-токен доступны только короткому заданию публикации. Ruleset разрешает
официальному GitHub Actions App отправить исключительно необходимый линейный release-коммит; обычный direct push в
`main` остаётся запрещён. Dependabot еженедельно предлагает обновления зависимостей и закреплённых Actions.
