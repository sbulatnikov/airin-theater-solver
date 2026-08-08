# Сборка и публикация

## Автономные HTML-файлы

```bash
pnpm build
```

Vite отдельно собирает `apps/v1` и `apps/v2`. Плагин single-file встраивает JavaScript и CSS внутрь HTML, после чего `scripts/assemble-dist.mjs` формирует:

- `dist/v1/index.html`;
- `dist/v2/index.html`;
- `dist/index.html` с переходом на v2.

Каталог `dist` — воспроизводимый артефакт и не хранится в Git.

## GitHub Pages

Workflow `.github/workflows/pages.yml` запускается при push в `main` и вручную через `workflow_dispatch`.

Этапы workflow:

1. checkout репозитория;
2. установка pnpm и Node.js 24;
3. `pnpm install --frozen-lockfile --ignore-scripts`;
4. `pnpm test`;
5. загрузка `dist` как Pages artifact;
6. публикация artifact в environment `github-pages`.

После первого push откройте **Settings → Pages** и выберите **Source: GitHub Actions**.

Для репозитория, опубликованного по адресу `https://user.github.io/repository/`, версии будут доступны как:

- `https://user.github.io/repository/v1/`;
- `https://user.github.io/repository/v2/`.

Относительные пути и `base: "./"` позволяют тем же файлам работать как в подпапке GitHub Pages, так и локально через `file://`.

Все сторонние Actions закреплены по полным commit SHA. Права выдаются отдельно: сборка получает только чтение
репозитория, а `pages: write` и OIDC-токен доступны только короткому заданию публикации. Dependabot еженедельно
предлагает обновления npm-зависимостей и закреплённых Actions.
