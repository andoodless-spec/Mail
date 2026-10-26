# Обновить уже работающий «Тихий ящик» с телефона — v28

Эта инструкция обновляет **тот же GitHub-репозиторий** и **тот же работающий Vercel-проект**. Не создавайте новый проект, новую базу и не меняйте `DATABASE_URL`.

> Важно: Vercel должен получить не сам ZIP, а следующий за ним commit от `github-actions[bot]`, в котором ZIP распакован в исходники. Только такой commit содержит визуальные правки.

## Что нужно загрузить

В корень текущего GitHub-репозитория загрузите ровно этот файл:

```text
quiet-mailbox-vercel-v28.zip
```

На телефоне: **Code → Add file → Upload files → выбрать ZIP → Commit changes**.

Если GitHub создаст Pull Request вместо прямого commit, откройте его и нажмите **Merge pull request → Confirm merge**. ZIP должен оказаться в ветке `main`.

## Один короткий шаг с существующим workflow

В этом репозитории уже есть рабочая папка `.github/workflows` и файл `Cunpack-update.yml`. Не загружайте YAML в корень: GitHub Actions его там не увидит.

1. В GitHub откройте:

   ```text
   .github → workflows → Cunpack-update.yml
   ```

2. Нажмите **Edit file**.
3. Удалите старое содержимое.
4. Вставьте весь текст из приложенного файла `Cunpack-update-v28.yml` (внутри ZIP лежит его копия `Cunpack-update-v28.yml`).
5. Нажмите **Commit changes** в `main`. Если опять создаётся Pull Request, его тоже нужно **Merge**.

Новый YAML следит и за ZIP, и за самим собой. Поэтому после merge GitHub сам запустит распаковку — вручную искать кнопку Actions не нужно.

## Что должно произойти

1. В **Actions** появится запуск «Распаковать Тихий ящик v28».
2. Он создаст новый commit от `github-actions[bot]`:

   ```text
   Обновить Тихий ящик до v28
   ```

3. В GitHub → Code в корне появится файл `RELEASE-v28.md`.
4. Vercel увидит именно этот bot-commit и создаст новый **Production** deployment.

Не ориентируйтесь на preview deployment Pull Request или deployment с commit вроде `Update Cunpack-update.yml`: в них может лежать только ZIP/workflow, без распакованных исходников.

## Если Action стала красной

- На шаге **«Проверить ZIP v28»**: в `main` нет файла с точным именем `quiet-mailbox-vercel-v28.zip`. Загрузите ZIP в корень и merge Pull Request, если GitHub его сделал.
- На шаге сохранения в GitHub с `403`: репозиторий → **Settings → Actions → General → Workflow permissions** → **Read and write permissions** → Save, затем откройте неудачный запуск и выберите **Re-run jobs**.

## Данные

`DATABASE_URL` не трогайте. Обновляется текущий Vercel-проект, поэтому остаются прежние ящики, записи, настройки, профили и рекорды.