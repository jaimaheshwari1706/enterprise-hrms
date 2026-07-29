# Enterprise HRMS (MERN)

A portfolio-grade Enterprise HRMS built with the MERN stack (MongoDB, Express, React, Node).

> This README is a placeholder for Phase 2. A full README (features, architecture,
> setup, demo credentials, API overview) will be written in Phase 12.

## Project status: Phase 2 — Project Foundation ✅

- `server/` — Express + MongoDB API scaffolding, all 14 Mongoose models, JWT/refresh-token
  utilities, RBAC middleware, error handling, Redis/Cloudinary wrappers (safe no-ops when disabled).
- `client/` — React 19 + Vite app, Tailwind CSS v4, Redux Toolkit store (auth/theme/notifications
  slices), React Router with protected/role-based route wrappers, a dashboard shell (sidebar +
  navbar + dark mode) and a placeholder login page.

## Quick start

### Backend
```bash
cd server
cp .env.example .env      # edit MONGO_URI etc. if needed
npm install
npm run dev                # http://localhost:5000/api/health
```

### Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Requires a running MongoDB instance (local `mongod` or MongoDB Atlas) reachable at the
`MONGO_URI` in `server/.env`. Redis, Cloudinary, and Email are all optional in development —
leave them disabled in `.env` and the app degrades gracefully.
