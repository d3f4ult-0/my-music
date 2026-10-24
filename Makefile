# MyMusic Task Runner

.PHONY: help dev build test seed docker-up docker-down

help:
	@echo "MyMusic Development Commands:"
	@echo "  make dev         - Run development servers (API & Web)"
	@echo "  make build       - Build frontend for production"
	@echo "  make test        - Run backend test verification suite"
	@echo "  make seed        - Generate sample artists, albums, songs, and playlists"
	@echo "  make docker-up   - Run complete platform via Docker Compose"
	@echo "  make docker-down - Stop Docker Compose containers"

build:
	cd web && npm run build

test:
	PYTHONPATH=server python server/tests/test_platform.py

seed:
	PYTHONPATH=server python server/app/services/seed.py

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
