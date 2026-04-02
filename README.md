# Vendor Tracker

Vendor Tracker is a full-stack internal procurement tool for comparing vendor quotes, selecting the best supplier, saving decision context, and exporting procurement data quickly.

## Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- Persistence: SQLite
- Data: 30 seeded demo vendors

## Features

- Vendor ledger with name, category, contact info, quoted price, shipping cost, total cost, and lead time
- Search and category filters
- Ranked comparison cards with weighted scoring
- Auto-highlights for best price, fastest delivery, and lowest total cost
- Persisted vendor selection
- Decision memo modal for final procurement reasoning
- Scoped CSV export for all vendors, filtered vendors, top-ranked vendors, or selected vendor only

## Workflow

1. Review vendors in the operational ledger.
2. Filter or search the list.
3. Compare ranked recommendation cards.
4. Select a vendor.
5. Open the decision memo and save the final rationale.
6. Export the required CSV scope if needed.

## Functionality

- The ledger is the primary working surface for procurement review.
- The ranked cards help users compare shortlisted vendors more quickly.
- Vendor selection is stored persistently and survives reloads.
- The decision memo stores why a vendor was selected.
- CSV export supports partial data export instead of forcing a full dump every time.

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Run locally

```bash
git clone https://github.com/AniketAslaliya/vendor_tracker_assignment.git
cd vendor_tracker_assignment
npm install
npm run dev
```

If you already cloned the repo earlier, run:

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

## Project Documents

- [PRD.md](./PRD.md): product requirements document for scope, workflow, and feature intent
- [macurban-context.md](./macurban-context.md): development context and implementation notes
- [skills.md](./skills.md): project skill checklist covering backend, frontend, persistence, documentation, and verification

## Data Model

The app seeds 30 vendors with:

- vendor name
- category
- contact name
- contact phone
- contact email
- quoted price
- shipping cost
- lead time
- notes

The selected vendor and decision memo are persisted in the `app_state` table.

## Tradeoffs

- SQLite was chosen to keep setup lightweight and evaluator-friendly.
- The schema is intentionally small and readable instead of over-engineered.
- Weighted scoring, scoped CSV export, and decision memo support were added because they improve the end-to-end procurement workflow with low complexity.

## AI Usage

### Which tools did I use and for what specifically?

- ChatGPT Codex was used to scaffold the project, speed up backend and frontend implementation, and iterate on the UI structure.

### Where did AI output work well, and where did I have to correct it?

- AI worked well for scaffolding, repetitive boilerplate, and first-pass implementation speed.
- I corrected product structure, requirement alignment, persistence logic, layout decisions, and README quality to make the final result more intentional and submission-ready.

### One thing the AI got wrong that I had to override

- Early UI directions were too generic, so I reworked the product into a more task-focused procurement flow with a stronger operational layout.
