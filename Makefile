-include .env
export

.PHONY: dev db backend frontend migrate down install

dev:
	$(MAKE) db
	@$(MAKE) -j2 backend frontend

db:
	docker compose up db -d

backend:
	cd backend && pnpm run start:dev

frontend:
	cd frontend && pnpm run dev

migrate:
	cd backend && pnpm exec prisma migrate dev

migrate-deploy:
	cd backend && pnpm exec prisma migrate deploy

studio:
	cd backend && pnpm exec prisma studio

install:
	cd backend && pnpm install
	cd frontend && pnpm install

down:
	docker compose down
