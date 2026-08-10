# Документация

Документация разделена по задачам:

- [architecture.md](architecture.md) — границы пакетов и направление зависимостей;
- [scoring.md](scoring.md) — известные правила мини-игры и примеры расчёта;
- [turn-effects-requirements-and-test-runs.md](turn-effects-requirements-and-test-runs.md) — проект требований и
  тест-ранов для ходов ИИ и непрознесённых реплик;
- [development.md](development.md) — установка, команды и проверка изменений;
- [branches.md](branches.md) — назначение веток, Pull Requests и сборка release candidate;
- [versioning.md](versioning.md) — политика SemVer для двух поколений;
- [releases.md](releases.md) — календарные релизы и неизменяемые Git-теги репозитория;
- [debug-snapshots.md](debug-snapshots.md) — состав и расшифровка диагностического файла;
- [deployment.md](deployment.md) — автономная сборка и публикация на GitHub Pages.

Если наблюдение из игры противоречит документации, сохраните debug-снепшот, добавьте запись партии в `tests/fixtures` и создайте issue или pull request.
