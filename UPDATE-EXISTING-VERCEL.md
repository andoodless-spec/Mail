# Обновить текущий «Тихий ящик» до v29 — с телефона

Используйте один и тот же GitHub-репозиторий и уже подключённый Vercel-проект.

- Не создавайте новый Vercel-проект или новую базу.
- Не меняйте и не удаляйте `DATABASE_URL`.
- Не используйте Vercel Drop, Git CLI или токены.

1. Загрузите `quiet-mailbox-vercel-v29.zip` в корень GitHub-репозитория и убедитесь, что он в `main`.
2. Замените содержимое `.github/workflows/Cunpack-update.yml` текстом из `Cunpack-update-v29.yml`.
3. В **Actions** вручную запустите «Распаковать Тихий ящик v29» для ветки `main`.
4. Дождитесь bot-commit `Обновить Тихий ящик до v29` и нового Production deployment на прежнем Vercel-адресе.

Полные короткие шаги и диагностика: [`GITHUB-PHONE-SETUP.md`](./GITHUB-PHONE-SETUP.md).
