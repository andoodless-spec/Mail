# Обновить текущий «Тихий ящик» до v29 с телефона

Это обновляет **тот же GitHub-репозиторий**, **тот же Vercel-проект** и прежнюю базу. Не создавайте другой Vercel-проект, не используйте Vercel Drop и не меняйте `DATABASE_URL`.

## 1. Сначала загрузите один ZIP

В корень текущего GitHub-репозитория загрузите:

```text
quiet-mailbox-vercel-v29.zip
```

На телефоне: **Code → Add file → Upload files → выбрать ZIP → Commit changes**.

Если GitHub создаёт Pull Request, сделайте **Merge pull request → Confirm merge**: ZIP обязан оказаться в `main`.

## 2. Обновите существующий workflow

Откройте в репозитории:

```text
.github → workflows → Cunpack-update.yml
```

Нажмите **Edit file**, удалите старый текст и вставьте весь текст из `Cunpack-update-v29.yml`. Commit должен попасть в `main` (PR при необходимости тоже merge).

## 3. Запустите вручную — это надёжнее автозапуска

1. Откройте вкладку **Actions** в этом же репозитории.
2. Выберите **«Распаковать Тихий ящик v29»**.
3. Нажмите **Run workflow** → ветка `main` → **Run workflow**.
4. Дождитесь зелёной галочки.

После успеха GitHub создаст commit от `github-actions[bot]`:

```text
Обновить Тихий ящик до v29
```

Только этот bot-commit содержит распакованные исходники и вызывает нужный Production deployment в прежнем Vercel-проекте.

## Если workflow не видно в Actions

Не редактируйте YAML повторно. Проверьте только два условия:

1. В **Code** сверху выбрана ветка `main`, а файл действительно лежит по пути `.github/workflows/Cunpack-update.yml`.
2. Репозиторий → **Settings → Actions → General**: Actions разрешены. Там же в **Workflow permissions** включите **Read and write permissions** → Save.

Затем обновите вкладку Actions. Если запуск красный, откройте его и смотрите первую красную строку:

- `test -f ...v29.zip`: ZIP не в `main` или имя отличается;
- `403` на `git push`: не включены **Read and write permissions**.

## Данные

`DATABASE_URL` не трогайте. Сохраняются существующие ящики, записи, темы, порядок вкладок, профили и игровые рекорды.
