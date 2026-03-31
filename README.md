# CodeBattle

Monorepo scaffold for a real-time competitive coding platform with Next.js (App Router) frontend, Express + Socket.io backend, shared TypeScript types, Prisma ORM, and Judge0 sandbox integration. This is a production-minded foundation following the requirements in `codebattle_build_prompt.md`.

## Stack
- Frontend: Next.js 14, TypeScript, Tailwind CSS, Zustand, Socket.io client, Yjs, Monaco, shadcn/ui, Framer Motion, Recharts
- Backend: Express 5, Socket.io server, Bull queue, Prisma (PostgreSQL), Redis, Judge0 worker integration
- Monorepo: Turborepo, workspaces for apps and shared package
- Infra: Docker Compose for Postgres, Redis, Judge0; env validation via Zod

## Quickstart
1. Install deps (per workspace): `npm install` at repo root installs dev deps; run `npm install` inside `apps/web`, `apps/server`, and `packages/shared` for app deps.
2. Copy `.env.example` to `.env` and fill values.
3. Start services: `docker compose up -d`.
4. Generate Prisma client: `npx prisma generate` (from repo root).
5. Run dev:
   - Frontend: `npm run dev --workspace apps/web`
   - Backend: `npm run dev --workspace apps/server`

## Workspaces
- `apps/web`: Next.js app router UI and API routes
- `apps/server`: Express + Socket.io realtime backend and workers
- `packages/shared`: Shared TS types, events, and Zod schemas
- `prisma`: Schema and seed scripts

## Notes
- Socket.io events are namespaced under `/battle` and typed via the shared package.
- Prisma models, scoring primitives, matchmaking, and placeholders are scaffolded; fill in business logic and question seeding.
- Do not commit `.md` files other than this README per instruction.
