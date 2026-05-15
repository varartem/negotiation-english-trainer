# Negotiation English Trainer

Локальное веб-приложение для тренировки переговорного английского с ИИ-собеседником. В MVP приложение работает в `mock`-режиме: сценарии, граф переговоров, оценка реплик, ответы контрагента, STT и TTS не требуют внешней LLM.

## Требования

- macOS / Apple Silicon
- Python 3
- Node.js
- Docker Desktop
- PostgreSQL поднимается через `docker-compose` из образа `postgres:12.9`

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

## ENV

Создайте локальный `.env`:

```bash
cp .env.example .env
```

По умолчанию используются:

- `LLM_PROVIDER=mock`
- `STT_PROVIDER=mock`
- `TTS_PROVIDER=mock`

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
make db-up     # поднять PostgreSQL 12.9
make db-down   # остановить PostgreSQL
make migrate   # применить Django migrations
make backend   # Django dev server
make frontend  # Vite dev server
```

## Mock LLM/STT/TTS

`apps/ai_services` содержит сервисный слой:

- `LLMService.generate_random_scenario`
- `LLMService.generate_graph`
- `LLMService.evaluate_user_reply`
- `LLMService.generate_counterparty_reply`
- `LLMService.generate_ideal_answer`
- `STTService`
- `TTSService`

В `mock`-режиме приложение генерирует предсказуемый переговорный граф, оценивает реплику эвристиками и возвращает текстовый ответ контрагента. Основной ввод в MVP — текстовый.

## Подключение локальной LLM позже

Оставьте тот же интерфейс `LLMService`, но добавьте provider для локального HTTP endpoint или Ollama. Настройки уже есть в `.env`:

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen3:8b
```

Новый provider должен возвращать evaluation строго в формате из ТЗ, чтобы API и frontend не менялись.
