# Trip'n Touille — Booking App

A room booking app for the Trip'n Touille guest house in Vendenesse-les-Charolles, France.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Database**: Neon (serverless Postgres) via `@neondatabase/serverless`
- **Payments**: Stripe Checkout
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Language**: TypeScript
- **Testing**: Vitest + PGlite (in-memory Postgres)
- **Deployment**: Vercel
- **CI**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) database
- A [Stripe](https://dashboard.stripe.com/apikeys) account (test keys are fine for development)

### Environment Variables

Create a `.env.local` file at the project root:

```
DATABASE_URL=postgres://...your-neon-connection-string...
STRIPE_SECRET_KEY=sk_test_...
```

### Install & Run

```sh
npm install
npm run dev
```

The dev server seeds the database automatically on startup, then starts at [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Seed DB + start dev server |
| `npm run build` | Production build |
| `npm start` | Seed DB + start production server |
| `npm run seed` | Seed the database (idempotent) |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Run ESLint |

## Project Structure

- `app`: NextJS App Router pages and layouts
- `components`: Reusable React components for the booking flow
- `components/ui`: shadcn/ui components
- `lib`: Shared utilities, database helpers, and business logic
- `scripts`: Database seeding and migration scripts
- `public`: Static assets

## Booking Flow

1. Select guests (constrained by room capacity)
2. Pick a date range on the calendar (minimum 1 night)
3. Review price and enter contact info in the confirmation dialog
4. Pay via Stripe Checkout
5. Redirected back to the room page with a success/cancellation dialog

## Testing

```sh
npm test
```

Tests use:
- **Vitest** as test runner
- **PGlite** as in-memory Postgres Db for integration tests
- a **mocked Stripe** for the checkout flow

## CI

GitHub Actions runs on every push/PR to `main`
