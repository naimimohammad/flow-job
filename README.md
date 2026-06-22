# Flow — Workflow Orchestration

Full-stack workflow orchestration platform (backend + frontend) using Node.js, TypeScript, Express, MongoDB, BullMQ, React, React Flow, and Tailwind CSS.

Setup

1. Start services with Docker Compose:

```bash
docker-compose up -d
```

2. Backend

```bash
cd backend
npm install
npm run dev
```

3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Environment

- Copy `.env.example` to `.env` in `backend/` and set `MONGO_URI`, `REDIS_URL` if needed.

Seed

Run backend seed to add example workflow:

```bash
cd backend
npm run seed
```

Project Structure

See `backend/` and `frontend/` folders for implementations.
