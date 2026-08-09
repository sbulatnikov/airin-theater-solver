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

1. определение версии из `package.json` и создание неизменяемого стабильного тега;
2. checkout созданного тега, установка pnpm, Node.js 24 и зависимостей;
3. production-сборка `dist`;
4. упаковка того же `dist` в архив GitHub Release;
5. генерация текущего `RELEASE_NOTES.md` по PR/contributor и публикация GitHub Release с SHA-256;
6. загрузка `dist` как Pages artifact и его публикация в environment `github-pages`.

Тесты не повторяются после merge: Branch Rules уже потребовали успешные Biome, TypeScript, unit, production build и
Playwright E2E jobs на точном head commit pull request. Каждый merge в `main` обязан изменить общую
версию: следующий функциональный релиз или следующий patch hotfix. Иначе release pipeline остановится до создания тега.

После первого push откройте **Settings → Pages** и выберите **Source: GitHub Actions**.

Для репозитория, опубликованного по адресу `https://user.github.io/repository/`, приложение доступно по адресу:

- `https://user.github.io/repository/v2/`.

Относительные пути и `base: "./"` позволяют тем же файлам работать как в подпапке GitHub Pages, так и локально через `file://`.

Все сторонние Actions закреплены по полным commit SHA. Права выдаются отдельно: сборка получает только чтение
репозитория, а `pages: write` и OIDC-токен доступны только короткому заданию публикации. Dependabot еженедельно
предлагает обновления npm-зависимостей и закреплённых Actions.
