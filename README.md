# Umeed Backend

Express + MongoDB API for Umeed – Rozgaar Sabke Liye.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` to the MongoDB Atlas connection string.
3. Run `npm install`.
4. Run `npm start`.

## Main API

- `GET /api/health` — health check
- `GET /api/jobs?city=Jhansi&category=Driver&search=delivery` — search jobs
- `GET /api/jobs/:id` — job details
- `POST /api/jobs` — post a job
- `POST /api/jobs/:id/apply` — apply for a job
- `POST /api/users` — create/update a basic user profile

OTP authentication, employer/admin authorization, resume upload, notifications and production hardening are planned next. Do not expose MongoDB credentials in source code.
