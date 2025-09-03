This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database: Drizzle ORM + Neon Postgres

This project uses Drizzle ORM with Neon Postgres via the HTTP driver, which is ideal for serverless and Edge runtimes in Next.js. The setup follows current Drizzle guidance and Neon best practices.

### 1) Install dependencies

Already added to this repo. For reference:

```
npm i drizzle-orm @neondatabase/serverless
npm i -D drizzle-kit
```

### 2) Environment variables

- Set `DATABASE_URL` in `.env` to your Neon pooled connection string (pgBouncer). This repo already includes the variable for local dev.
- If you need unpooled connections (long transactions, LISTEN/NOTIFY), use `DATABASE_URL_UNPOOLED` and a compatible driver (e.g., Neon websockets or node-postgres). The default setup here uses HTTP + pooling.

Never expose `DATABASE_URL` to the client; only use it in server code.

### 3) Drizzle config and schema

- Config: `drizzle.config.ts` uses the `postgresql` dialect and reads `DATABASE_URL` from `.env`. Migration SQL is output to `./drizzle`.
- Schema: define tables in `lib/db/schema.ts`. Example tables included: `users` and `sessions`.

### 4) DB client

The Neon HTTP driver is initialized once and exported from `lib/db/index.ts`.

```
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function createUser(email: string, name?: string) {
  await db.insert(users).values({ email, name });
}
```

Use `db` only in server code (server components, route handlers, server actions, or `app` API routes).

### 5) Migrations and tools

Common scripts are available:

```
# Generate SQL migration files from your schema
npm run db:generate

# Apply migrations to the database
npm run db:migrate

# (Optional) Push schema directly without files (quick dev only)
npm run db:push

# Visualize your schema and data
npm run db:studio
```

Typical flow:

1. Edit tables in `lib/db/schema.ts`.
2. Run `npm run db:generate` to produce SQL under `./drizzle`.
3. Run `npm run db:migrate` to apply changes to the Neon database.

### 6) Notes and best practices

- For most Next.js serverless/Edge workloads, the Neon HTTP driver (`drizzle-orm/neon-http`) is recommended.
- Keep migrations in Git; avoid editing generated SQL by hand.
- Use pooled connection strings in prod for better scalability.
- For long-lived transactions or features like `LISTEN/NOTIFY`, prefer unpooled connections with websockets or node `pg`.
- Avoid `defaultRandom()` UUIDs unless you’ve enabled the required Postgres extension; this schema defaults to serial IDs to stay portable.
