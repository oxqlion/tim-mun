.DEFAULT_GOAL := help
.PHONY: fe be emulator setup-be setup-fe dev commit push hooks help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Frontend ---
fe: ## Start frontend dev server
	cd frontend && npm run dev

setup-fe: ## Install frontend dependencies
	cd frontend && npm install

# --- Backend ---
be: ## Start backend dev server
	cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

setup-be: ## Install backend dependencies + setup venv
	cd backend && rm -rf .venv && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp -n .env.example .env

# --- Firebase Emulator ---
emulator: ## Start Firestore emulator
	firebase emulators:start --only firestore

# --- Run all ---
dev: ## Start emulator + backend + frontend
	@echo "Starting emulator, backend, and frontend..."
	@firebase emulators:start --only firestore & \
	sleep 3 && cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000 & \
	cd frontend && npm run dev & \
	wait

# --- Git ---
commit: ## Stage all, show status, and commit with prompt
	@git add .
	@git status
	@read -p "Commit message: " msg; \
	git commit -m "$$msg"

push: ## Push to remote (auto set upstream on first push)
	@BRANCH=$$(git rev-parse --abbrev-ref HEAD); \
	if git config --get branch.$$BRANCH.remote > /dev/null 2>&1; then \
		git push; \
	else \
		echo "First push for branch '$$BRANCH', setting upstream..."; \
		git push -u origin $$BRANCH; \
	fi

# --- Hooks ---
hooks: ## Copy global Kiro hooks to this project
	@mkdir -p .kiro/hooks
	@cp -r ~/.kiro/hooks/*.kiro.hook .kiro/hooks/ 2>/dev/null && \
		echo "✓ Hooks copied to .kiro/hooks/" || \
		echo "✗ No global hooks found at ~/.kiro/hooks/"
