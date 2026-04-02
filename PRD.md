# Product Requirements Document

## Product Name

Vendor Tracker

## Problem

An ops team currently coordinates vendor sourcing through WhatsApp. That process makes it hard to compare suppliers consistently, track a final choice, and retain the reasoning behind procurement decisions.

## Goal

Provide a lightweight internal web app that helps the team:

- review vendor quotes in one place
- compare cost and delivery tradeoffs
- persist a final vendor selection
- capture decision rationale for future reference

## Target User

- Internal ops or procurement team members
- Users who need quick, repeatable vendor comparison without complex onboarding

## Core User Journey

1. Open the dashboard and review all available vendor quotes.
2. Search or filter vendors by category.
3. Compare quote price, shipping, total cost, and lead time.
4. Select a vendor from the operational ledger or ranked cards.
5. Open the decision memo modal and save the commercial reasoning.
6. Export all vendors, a filtered subset, the top-ranked shortlist, or only the selected vendor as CSV.

## Functional Requirements

- Display at least 5 vendors with mock data
- Show vendor name, category, contact info, quoted price, shipping cost, total cost, and lead time
- Allow filtering by category
- Allow searching by vendor or contact details
- Highlight best price, fastest delivery, and lowest total cost
- Persist selected vendor across reloads
- Allow weighted scoring between price and delivery speed
- Support CSV export for scoped vendor data
- Allow saving a decision memo for the selected vendor

## Non-Functional Requirements

- Local setup should be fast and evaluator-friendly
- App should run end-to-end without an external database service
- UI should remain usable on laptop-sized screens
- API and UI should stay simple and readable

## Technical Direction

- Frontend: React + Vite
- Backend: Node.js + Express
- Persistence: SQLite

## Notes

- SQLite is used because it satisfies the persistence requirement while keeping setup extremely light.
- The app is intentionally scoped for clarity and evaluator speed rather than enterprise-scale complexity.
