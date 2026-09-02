# Lead Manager – Frontend

Professional Next.js frontend for the **Lead Manager API** (OpenAPI 2.1.0).

## Stack

- **Next.js 15** (App Router)
- **React 19** + TypeScript
- **Tailwind CSS 4**
- **shadcn/ui** (Radix primitives)
- **TanStack Query** (React Query)
- **React Hook Form**
- **Sonner** toasts
- **next-themes** (dark mode)

## Features (full OpenAPI coverage)

| Area | Capabilities |
|------|----------------|
| **Dashboard** | Live stats for leads & imports |
| **Leads** | Advanced filters (all operators), search, hasEmail/Phone/LinkedIn, cursor + page pagination, dynamic sort, field metadata, view/edit/delete, bulk delete, export |
| **Imports** | CSV preview, column → identity mapping, duplicate strategies, progress polling |
| **Exports** | Filtered CSV download with column selection & row limit |
| **Match & Enrich** | Upload CSV, match on email/phone/linkedin/website, download enriched file |

## Quick start

```bash
# 1. Install
npm install

# 2. Configure API URL (optional – defaults to http://localhost:4000/api)
cp .env.example .env.local
# edit NEXT_PUBLIC_API_URL if needed

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Make sure the Lead Manager API is running on port 4000 (or update the env var).

## Project structure

```
src/
├── app/                  # App Router pages
│   ├── page.tsx          # Dashboard
│   ├── leads/            # Lead list + filters
│   ├── imports/          # CSV import wizard
│   ├── exports/          # Export builder
│   └── matching/         # Match & enrich
├── components/
│   ├── ui/               # shadcn primitives
│   ├── layout/           # Sidebar + mobile nav
│   └── leads/            # Lead detail / edit dialogs
├── lib/
│   ├── api.ts            # Typed API client
│   └── utils.ts
├── hooks/
└── types/
    └── api.ts            # OpenAPI-derived types
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Backend base URL |

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – start production server
- `npm run lint` – ESLint
