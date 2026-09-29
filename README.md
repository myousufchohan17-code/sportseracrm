# SportsEra Sports Shop CRM

Production-style CRM for a sports shop. The dashboard, orders, customers, catalog, inventory, deliveries, marketing, and reports all read and write a real SQLite database. The app starts empty — no sample customers, products, or sales figures.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). The dashboard opens immediately — there is no login or sign-up screen. All records you add persist in `data/sports.db`.

## Stack

- React + Vite + Tailwind CSS
- Lucide icons + Recharts
- Express API
- SQLite via Node’s built-in `node:sqlite`

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API on port 4000 + Vite on 5173 |
| `npm run build` | Production frontend build |
| `npm start` | Serve API (and `dist/` if you have built) |

## Deploy

The repo is set up for [Vercel](https://vercel.com): the Vite app is the static frontend, and Express runs as a serverless function at `/api`. On Vercel the SQLite file lives in a temporary directory, so records can reset when instances recycle. Use `npm start` on a persistent host if you need the database to last.

## Notes

- Confirming an order deducts stock. Cancelling restores it.
- Overselling is blocked unless **Allow backorder** is enabled in Settings.
- Customers with orders cannot be deleted. Products used on orders should be deactivated instead.
