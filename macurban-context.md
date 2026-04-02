# Macurban Context

This file captures the running implementation context for the Vendor Tracker project.

## Project Goal

Build a full-stack Vendor Tracker mini app for an ops team using:

- Backend: Node.js + Express
- Frontend: React JS
- Persistence: SQLite
- Data: Mock seeded vendor quotes

## Assignment Requirements Checklist

- Vendor listing with name, category, and contact info
- Current quoted price and lead time per vendor
- Search and category filter
- Side-by-side vendor comparison
- Auto-highlight best price and fastest delivery
- Persist vendor selection across page reloads
- REST API backend
- Lightweight persistent database
- At least 5 seeded vendors
- README with setup, local run steps, and AI usage section

## Architecture Direction

- `server/` for Express API and SQLite persistence
- `client/` for React UI
- Shared mock seed data stored in backend seed flow
- Selection persisted in SQLite so reloads survive

## Command Log

- Initialized project planning and selected SQLite over MongoDB for evaluator-friendly setup
- Scaffolded a Vite React client and Express server structure
- Installed runtime dependencies for Express, SQLite, and local development
- Added seeded vendor data, selection persistence, search/filter APIs, and CSV export
- Replaced the starter frontend with a comparison dashboard and weighted scoring controls
