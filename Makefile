.PHONY: setup db-up db-down migrate backend frontend

setup:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt
	cd frontend && npm install

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

migrate:
	cd backend && . .venv/bin/activate && python manage.py migrate

backend:
	cd backend && . .venv/bin/activate && python manage.py runserver 127.0.0.1:8000

frontend:
	cd frontend && npm run dev
