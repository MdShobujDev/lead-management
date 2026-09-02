# Lead Manager Backend v2.1

NestJS + Drizzle + **pg-boss** (no Redis). Fully dynamic CSV leads.

## Features

| Feature | Details |
|---------|---------|
| Dynamic schema | Any CSV columns → `leads.data` jsonb |
| Dedup on import | email / phone / linkedin strategies |
| **Advanced filters** | eq, neq, contains, startsWith, endsWith, isNull, in, gt, … |
| Simple filters | `fields={"Company":"Acme"}` contains |
| Full-text | `search` across all jsonb values |
| Date range | `createdFrom` / `createdTo` |
| **Pagination** | Cursor (keyset) **or** page/offset |
| **Sort** | Any data column + identity + createdAt |
| Facets | `/leads/fields/facets?field=Company` |
| Field meta | `/leads/fields/meta` for filter UI |
| Export | Filter + sort → CSV (no DB record) |
| Matching | Enrich CSV from DB → download |
| CRUD | Get / patch / delete / bulk-delete |

## Quick start

```bash
cp .env.example .env   # set DATABASE_URL
pnpm install
pnpm db:push
pnpm start:dev         # API :4000
pnpm start:worker      # import jobs
```

Swagger: http://localhost:4000/api/docs  
OpenAPI file: `openapi.yaml`

## Filter examples

```
# Simple contains
GET /api/leads?fields={"Company":"Acme"}&hasEmail=true

# Advanced operators (URL-encode the JSON)
GET /api/leads?filters=[{"field":"Company","op":"eq","value":"Acme"},{"field":"Email","op":"isNotNull"}]

# Sort + cursor
GET /api/leads?sortBy=Company&sortOrder=asc&limit=50

# Page mode
GET /api/leads?page=2&limit=50&includeTotal=true

# Date range
GET /api/leads?createdFrom=2026-01-01&createdTo=2026-12-31
```
