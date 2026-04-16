# CarNest

 CarNest is a premium vehicle marketplace scaffold built with Next.js, Tailwind CSS, Firebase Authentication, Firestore, and Firebase Storage.

## Phase 1 Included

- Public pages: home, inventory, vehicle detail, login, register
- Buyer, seller, and admin role placeholders
- Mock inventory for `warehouse` and `private` listing types
- Reusable listing UI that distinguishes `Warehouse Vehicle` and `Online Listing`
- Firebase config helpers plus starter Firestore and Storage rules

## Setup

1. Copy `.env.example` to `.env.local`
2. Add your Firebase project values
3. Run `npm install --cache .npm-cache`
4. Run `npm run dev`

## Planned Collections

- `users`
- `vehicles`
- `enquiries`
- `offers`
- `viewing_requests`
- `change_requests`

## Notes

- Without Firebase env values, the app falls back to demo-safe mock data for browsing and UI development.
- Public inventory clearly separates warehouse and private online listing presentation rules.
- Workflow pages, offers, enquiries, viewing requests, and admin CRUD are intentionally deferred to the next phase.
