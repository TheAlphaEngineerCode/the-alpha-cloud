.PHONY: help setup dev test test-e2e lint typecheck build docker-up docker-down db-migrate db-seed db-reset simulator security clean

# Default target
help:
	@echo "The Alpha Cloud — available make targets:"
	@echo "  setup          Install dependencies"
	@echo "  dev            Run all apps in dev mode (web + api + worker)"
	@echo "  test           Run unit + integration tests"
	@echo "  test-e2e       Run end-to-end tests"
	@echo "  lint           Run ESLint across the workspace"
	@echo "  typecheck      Run TypeScript typecheck across the workspace"
	@echo "  build          Build all packages and apps"
	@echo "  docker-up      Start Postgres, Redis and MinIO via docker compose"
	@echo "  docker-down    Stop docker compose stack"
	@echo "  db-migrate     Apply pending database migrations"
	@echo "  db-seed        Seed demo data (Alpha Cloud Labs + Black Friday scenario)"
	@echo "  db-reset       Drop and recreate the database (DESTRUCTIVE)"
	@echo "  simulator      Run the Cloud Simulator in foreground"
	@echo "  security       Run Trivy + Semgrep + Gitleaks locally"
	@echo "  clean          Remove build artifacts and caches"

setup:
	pnpm install

dev:
	pnpm dev

test:
	pnpm test

test-e2e:
	pnpm --filter @cloud/web test:e2e

lint:
	pnpm lint

typecheck:
	pnpm typecheck

build:
	pnpm build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

db-migrate:
	pnpm --filter @cloud/api db:migrate

db-seed:
	pnpm --filter @cloud/api db:seed

db-reset:
	@echo "This will drop the database. Press Ctrl+C to abort."
	@sleep 3
	pnpm --filter @cloud/api db:reset

simulator:
	pnpm --filter @cloud/api simulator

security:
	@command -v trivy >/dev/null 2>&1 && trivy fs . --severity HIGH,CRITICAL || echo "[skip] trivy not installed"
	@command -v semgrep >/dev/null 2>&1 && semgrep scan --config auto . || echo "[skip] semgrep not installed"
	@command -v gitleaks >/dev/null 2>&1 && gitleaks detect --source . --redact || echo "[skip] gitleaks not installed"

clean:
	pnpm clean