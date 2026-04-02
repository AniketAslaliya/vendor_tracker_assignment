# Vendor Tracker

Vendor Tracker is a full-stack internal tool for ops teams to compare supplier quotes, filter vendors quickly, and persist a selected vendor across reloads.

## Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- Persistence: SQLite
- Data: Seeded mock vendor records

## Features

- Vendor listing with name, category, contact info, quoted price, shipping cost, lead time, and total cost
- Search and category filtering
- Operational vendor ledger with quick selection actions
- Ranked comparison cards with auto-highlights for best price, fastest delivery, and lowest total cost
- Persisted vendor selection stored in SQLite
- Weighted scoring slider for price versus speed
- CSV export for vendor comparison data
- Persisted decision memo for the selected vendor so the team can keep the final reasoning attached to the choice

## Why SQLite

SQLite is the best fit for this assignment over MongoDB or another external database because:

- it satisfies the persistence requirement directly
- it keeps setup minimal for the evaluator
- it avoids running a separate database service for a very small dataset
- it still gives us real durability instead of in-memory state

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Run locally

```bash
npm install
npm run dev
```

This starts:

- Express API on `http://localhost:4000`
- React app on `http://localhost:5173`

### Production-style run

```bash
npm run build
npm start
```

## API Overview

- `GET /api/health`
- `GET /api/vendors`
- `GET /api/selection`
- `POST /api/selection`
- `POST /api/decision-memo`
- `GET /api/vendors/export.csv`

## Data Model

The app seeds 6 vendors into SQLite with:

- vendor name
- category
- contact name
- contact phone
- contact email
- quoted price
- shipping cost
- lead time
- notes

The selected vendor is persisted in an `app_state` table so it survives reloads.

## Tradeoffs

- I chose a simple two-table SQLite schema instead of a larger relational model to keep the app readable and easy to run.
- Weighted scoring, CSV export, and the persisted decision memo were included because they add real evaluator value without introducing unnecessary complexity.
- I did not build the raw quote AI parsing stretch goal because I prioritized the mandatory end-to-end workflow and wanted the shipped version to stay polished and dependable.

## AI Usage

### Which tools did I use and for what specifically?

- ChatGPT Codex was used to scaffold the project, generate the initial API and React structure, and speed up UI/CSS iteration.

### Where did AI output work well, and where did I have to correct it?

- AI worked well for turning the assignment requirements into a first-pass full-stack structure and for drafting repetitive UI and API boilerplate.
- I corrected the implementation details around persistence, route design, evaluator setup flow, and requirement coverage to make sure selection persistence, comparison logic, and README expectations all matched the prompt.

### One thing the AI got wrong that I had to override

- The initial direction leaned toward a more generic starter layout; I overrode that with a purpose-built vendor comparison dashboard and made SQLite the persistence choice so the project better matched the assignment and stayed lightweight.
