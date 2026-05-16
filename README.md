# Negotiation English Trainer

Локальное веб-приложение для тренировки переговорного английского с ИИ-собеседником. Backend использует локальные MLX-модели: LLM для сценариев, графа и диалога, STT для голосового ввода и TTS для озвучки сообщений.

## Требования

- macOS / Apple Silicon
- Python 3
- Node.js
- Docker Desktop
- PostgreSQL поднимается через `docker-compose` из образа `postgres:12.9`
- Доступ к Hugging Face для первой загрузки весов

## Быстрый запуск

```bash
cp .env.example .env
make setup
make db-up
make migrate
make backend
make frontend
```

Backend будет доступен на `http://localhost:8000/api`, frontend — на `http://localhost:5173`.

Можно запустить всё одной командой:

```bash
make start
```

Она проверит наличие `python3`, `node`, `npm`, доступность Docker, поставит отсутствующие зависимости, поднимет PostgreSQL, применит migrations и запустит backend вместе с frontend. Если зависимости уже установлены, команда их не обновляет.

## ENV

Создайте локальный `.env`:

```bash
cp .env.example .env
```

По умолчанию используются MLX-провайдеры:

- `LLM_PROVIDER=mlx`
- `LLM_MODEL=mlx-community/Qwen3.5-9B-OptiQ-4bit`
- `STT_PROVIDER=mlx`
- `STT_MODEL=Qwen/Qwen3-ASR-0.6B`
- `TTS_PROVIDER=mlx`
- `TTS_MODEL=mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16`

Модели скачиваются из Hugging Face стандартными механизмами пакетов, без изменения `HF_HOME` или `HF_HUB_CACHE`.

## Backend

Зависимости Python ставятся только в `backend/.venv`:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Миграции:

```bash
make db-up
make migrate
```

Запуск:

```bash
make backend
```

Проверка:

```bash
curl http://localhost:8000/api/health/
```

## Frontend

Установка зависимостей:

```bash
cd frontend
npm install
```

Запуск:

```bash
make frontend
```

## Команды Makefile

```bash
make setup     # backend/.venv + Python deps, frontend npm deps
make start     # проверить окружение и запустить весь проект одной командой
make db-up     # поднять PostgreSQL 12.9
make db-down   # остановить PostgreSQL
make migrate   # применить Django migrations
make backend   # Django dev server
make frontend  # Vite dev server
```

## AI Services

`apps/ai_services` содержит сервисный слой:

- `LLMService.generate_random_scenario`
- `LLMService.generate_graph`
- `LLMService.evaluate_user_reply`
- `LLMService.generate_counterparty_reply`
- `LLMService.generate_ideal_answer`
- `STTService.transcribe`
- `TTSService.synthesize`

Архитектура разделена на фасады `LLMService`/`STTService`/`TTSService`, провайдеры `mlx` и `mock`, prompt builder-ы и JSON-нормализацию. Провайдер `mlx` загружает модели лениво при первом запросе и держит их в памяти процесса Django; отдельный модельный сервер не нужен.

Для тестового режима можно явно вернуть заглушки:

```env
LLM_PROVIDER=mock
STT_PROVIDER=mock
TTS_PROVIDER=mock
```

В frontend есть голосовой ввод через WAV-запись в браузере и кнопка озвучки для сообщений собеседника/тренера. Сгенерированные TTS-файлы сохраняются в `backend/media/tts/` и отдаются Django в `DEBUG`-режиме.
