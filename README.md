# refactored-octo-garbanzo

A Google Drive clone: upload, organize, and share files, with S3-backed storage and JWT authentication.

## Features

- Email/password authentication (JWT, httpOnly cookies)
- File upload via S3 pre-signed URLs (direct browser-to-S3 upload)
- Browse, download, favorite, and trash/restore files
- Share files with other users, or generate public share links
- Recent files, favorites, and trash views
- Scheduled cleanup of trashed files

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Backend**: NestJS 11, Prisma, PostgreSQL
- **Storage**: AWS S3 (`@aws-sdk/client-s3`, presigned uploads/downloads)
- **Auth**: Passport JWT

## Project Structure

```
backend/    NestJS API (auth, files, sharing, S3 integration)
frontend/   Next.js app (dashboard, login/signup, shared-link pages)
```

## Getting Started

### Prerequisites

- Node.js
- Docker (for PostgreSQL, or run your own instance)
- An AWS S3 bucket and credentials

### Setup

1. Copy the environment files and fill in your own values:
   ```
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Backend requires `DATABASE_URL`, `JWT_SECRET`, and AWS credentials (`AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
   Frontend requires `NEXT_PUBLIC_API_URL`.

2. Install dependencies:
   ```
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Run database migrations:
   ```
   cd backend && npx prisma migrate deploy
   ```

4. Start both apps in development mode from the repo root:
   ```
   npm run dev
   ```
   This runs the frontend (`localhost:3000`) and backend (`localhost:3001`) concurrently.

### Running with Docker

```
docker-compose up --build
```

This starts PostgreSQL, the backend, and the frontend together.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run frontend and backend together (from repo root) |
| `npm run dev:backend` | Run only the backend in watch mode |
| `npm run dev:frontend` | Run only the frontend dev server |
