# AS Metal Dies & Nakas Commerce

React storefront and staff dashboard with a Node.js/Express API and MongoDB persistence.

## Project layout

- `frontend/` — React 18 and Vite customer storefront (`/`) and staff dashboard (`/staff/`).
- `backend/` — Express API and Mongoose MongoDB connection.
- MongoDB stores the shared commerce state (catalog, metal prices, customers, and orders) in one document. This keeps the existing demo data model intact and shares updates across browsers/devices connected to the same API.

## Run locally

Requirements: Node.js 18+ and MongoDB (local or Atlas).

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` plus `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from your Cloudinary console.
2. From the project root run `npm install`, `npm --prefix frontend install`, and `npm --prefix backend install`.
3. Run `npm run dev` from the project root.
4. Open `http://localhost:5173/` for the storefront and `http://localhost:5173/staff/` for the staff dashboard.
5. Check `http://localhost:3000/api/health` for API/database status.
6. Create a production frontend bundle with `npm run build`.

## Razorpay online payments

The checkout offers Cash on Delivery when enabled in shop settings, Manual UPI, and Razorpay Checkout. To enable Razorpay, add your **Test Mode** `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `backend/.env` (the key secret must stay on the backend), then restart the API. The backend calculates the checkout amount, creates the Razorpay order, verifies the returned signature and captured payment, and records the commerce order only after verification. Configure automatic capture in Razorpay for this flow. Test success, failure, cancellation, stock changes, and COD before switching to live credentials.

Vite proxies `/api` requests to `http://127.0.0.1:3000` during development. The backend binds to localhost by default. Set `HOST` only when configuring a trusted deployment network.

If startup reports `ECONNREFUSED 127.0.0.1:27017`, MongoDB is not running. On macOS with Homebrew, install and start it:

```sh
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb-community@8.0
```

Then restart `npm run dev` and reload the browser. For MongoDB Atlas, set `MONGODB_URI` to your Atlas connection string instead.

## Data migration

On first startup, if MongoDB has no commerce state yet, the frontend imports the current browser's saved state (including recognized legacy `asdn1`/`asdm2` formats) into MongoDB. The first browser to initialize an empty database seeds it. Back up/export existing browser data before switching browsers. Staff JSON import/export remains available.

## Product image uploads

The staff product form resizes selected images to JPEG, sends them to the backend, and stores them in Cloudinary under `as-commerce/products`. The backend stores the Cloudinary URL in the product record; the API secret stays in the backend environment. Image upload returns a setup error until all three Cloudinary values are configured.

## Security and production limits

This remains a demo application. The staff panel has no authentication, and the API currently exposes the shared state to callers that can reach it. Keep the backend on a trusted local network until server-side staff authentication/authorization, per-customer order access, rate limiting, and production payment reconciliation are added. Do not expose customer records publicly. Razorpay is implemented with server-side amount calculation and payment verification, but it has not been verified with live or test credentials in this environment.

## Notes

The storefront and dashboard retain the original UI and workflows. The browser cache remains as a startup/migration cache, while MongoDB is the shared source of truth after the API loads. If MongoDB is unavailable, the app displays a backend connection error instead of silently writing only to one browser.
