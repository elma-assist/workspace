# Elma: локальная платформа AI-сотрудников

Рабочая версия: организации, знания, агенты, текст и голос, сайт-виджет, формы, заявки со статусами и учёт расходов.

Запуск: `./scripts/start.sh` или `Start Elma.command`. Интерфейс: http://localhost:8180.

[Инструкция запуска, доступ и проверки](docs/local-mvp.md) · [Требования](docs/mvp-system-requirements.md) · [Формы и заявки](docs/forms-design.md) · [Публикация и QR-коды](docs/sharing.md)

[Стандарты интерфейса](docs/ui-standards.md) · [Правила для разработки](AGENTS.md)

[GitHub CI/CD и сервер](docs/deployment.md)

---

## Исходный консольный эксперимент

# Голосовой помощник LiveKit + Mistral

> Проект развивается в платформу виртуальных сотрудников. Актуальные
> [требования к MVP](./docs/mvp-system-requirements.md) и
> [видение продукта с обзором рынка](./docs/product-vision-and-market.md)
> находятся в каталоге `docs`.

Локальный тест через микрофон и динамики Mac. LiveKit Agents управляет разговором;
Voxtral распознаёт речь, Mistral Small формирует ответ, Voxtral TTS озвучивает его.
Silero VAD локально определяет начало и конец речи. Для этого режима нужен только
ключ Mistral, аккаунт LiveKit и отдельный медиасервер не требуются.

## Запуск

1. Откройте `.env.local` и заполните `MISTRAL_API_KEY=` своим ключом из
   [Mistral Studio](https://console.mistral.ai/).
2. В Terminal выполните:

   ```sh
   cd /Users/anton/projects/gpt_live
   ./start.command
   ```

   Также можно открыть `start.command` двойным щелчком в Finder.
3. Разрешите Terminal доступ к микрофону, если macOS спросит. Для первого теста
   используйте наушники, чтобы помощник не слышал собственный голос.
4. Говорите после приветствия. Для выхода нажмите Ctrl+C.

Ключ хранится в `.env.local`, который исключён из Git. Запросы распознавания,
ответов и озвучки отправляются в Mistral и используют квоты вашего API-аккаунта.

## Язык и голос

По умолчанию `ASSISTANT_LANGUAGE=auto`: помощник отвечает на английском или
немецком, подстраиваясь под язык последней реплики. Язык можно менять прямо
во время разговора или попросить помощника переключиться. Приветствие — на английском.
Чтобы закрепить один язык, укажите `ASSISTANT_LANGUAGE=English` или
`ASSISTANT_LANGUAGE=German` в `.env.local`.

`MISTRAL_VOICE=en_paul_neutral` — стандартный голос. Другие варианты:
`gb_jane_neutral`, `gb_oliver_neutral`, `fr_marie_neutral`.
Модели также меняются через `.env.local`.

## Устройства и неполадки

```sh
uv run --frozen python agent.py console --list-devices
uv run --frozen python agent.py console --help
```

Параметры выбора устройств можно передать в `./start.command`.
При ошибке 401 проверьте ключ, при 403/429 — доступ к моделям и квоты в Mistral.
Если нет микрофона, проверьте «Системные настройки → Конфиденциальность и
безопасность → Микрофон» и выбранное устройство ввода.

## Подключение через LiveKit Cloud (необязательно)

Создайте проект в [LiveKit Cloud](https://cloud.livekit.io/), заполните
`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` в `.env.local`, затем:

```sh
uv run --frozen python agent.py dev
```

В Agent Console своего проекта укажите имя агента `mistral-voice` и начните сессию.
Работающий процесс агента должен оставаться запущенным.

## Восстановление окружения

```sh
uv sync --frozen
uv run --frozen python agent.py download-files
```

Зависимости зафиксированы в `uv.lock`. Python-команда `console` ещё доступна в
установленной версии LiveKit, хотя разработчики рекомендуют новый `lk agent console`.

## Документация

- [LiveKit: Mistral STT](https://docs.livekit.io/agents/models/stt/mistralai/)
- [LiveKit: Mistral LLM](https://docs.livekit.io/agents/models/llm/mistralai/)
- [LiveKit: Mistral TTS](https://docs.livekit.io/agents/models/tts/mistralai/)
- [Voxtral TTS и поддерживаемые языки](https://mistral.ai/news/voxtral-tts/)
