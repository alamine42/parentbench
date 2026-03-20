# Database Setup

ParentBench uses Neon Postgres with Drizzle ORM.

## Setup

1. Create a Neon account at https://console.neon.tech/
2. Create a new project and database named `parentbench`
3. Copy the connection string and add to `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/parentbench?sslmode=require
```

## Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Push schema directly to database (dev only)
npm run db:push

# Run migrations
npm run db:migrate

# Seed the database with initial data
npm run db:seed

# Open Drizzle Studio to browse data
npm run db:studio
```

## Schema

The database schema includes:

- **providers** - AI providers (OpenAI, Anthropic, etc.)
- **models** - AI models with metadata
- **categories** - The 4 ParentBench evaluation categories
- **test_cases** - Evaluation test prompts
- **evaluations** - Evaluation job records
- **eval_results** - Individual test case results
- **scores** - Historical score records
- **certifications** - Provider certification status
- **users** - User accounts (parents, providers, admins)
- **api_keys** - API key management
- **alerts** - Email subscription alerts
- **submissions** - Community test case submissions

## Development Workflow

1. Make schema changes in `src/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:push` to apply (dev) or `npm run db:migrate` (prod)
