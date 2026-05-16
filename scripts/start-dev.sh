#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_PY="$BACKEND_DIR/.venv/bin/python"

BACKEND_PID=""
FRONTEND_PID=""

log() {
  printf "\033[1;36m[dev]\033[0m %s\n" "$1"
}

fail() {
  printf "\033[1;31m[dev]\033[0m %s\n" "$1" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Не найдена команда '$1'. Установите её и повторите запуск."
}

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

backend_deps_ready() {
  [[ -x "$VENV_PY" ]] || return 1
  "$VENV_PY" - <<'PY' >/dev/null 2>&1
import corsheaders
import django
import dj_database_url
import mlx_audio
import mlx_lm
import mlx_qwen3_asr
import psycopg
import rest_framework
import soundfile
PY
}

ensure_backend_deps() {
  if backend_deps_ready; then
    log "Python-зависимости уже установлены."
    return
  fi

  log "Готовлю backend/.venv и ставлю недостающие Python-зависимости."
  cd "$BACKEND_DIR"
  if [[ ! -x "$VENV_PY" ]]; then
    python3 -m venv .venv
  fi
  "$VENV_PY" -m pip install -r requirements.txt
}

ensure_frontend_deps() {
  if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Frontend-зависимости уже установлены."
    return
  fi

  log "Ставлю frontend-зависимости."
  cd "$FRONTEND_DIR"
  npm install
}

ensure_docker() {
  need_command docker
  docker info >/dev/null 2>&1 || fail "Docker не запущен или недоступен. Запустите Docker Desktop и повторите команду."
}

start_database() {
  log "Поднимаю PostgreSQL."
  cd "$ROOT_DIR"
  docker compose up -d postgres
}

run_migrations() {
  log "Применяю Django migrations."
  cd "$BACKEND_DIR"
  "$VENV_PY" manage.py migrate
}

start_backend() {
  log "Запускаю backend: http://127.0.0.1:8000/api"
  cd "$BACKEND_DIR"
  "$VENV_PY" manage.py runserver 127.0.0.1:8000 &
  BACKEND_PID="$!"
}

start_frontend() {
  log "Запускаю frontend: http://127.0.0.1:5173"
  cd "$FRONTEND_DIR"
  npm run dev &
  FRONTEND_PID="$!"
}

main() {
  need_command python3
  need_command node
  need_command npm
  ensure_docker
  ensure_backend_deps
  ensure_frontend_deps
  start_database
  run_migrations
  start_backend
  start_frontend

  log "Проект запущен. Остановить всё можно через Ctrl+C."
  wait "$BACKEND_PID" "$FRONTEND_PID"
}

main "$@"
