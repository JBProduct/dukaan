# Dukaan — your e-commerce store

A working online store: catalog, search & filters, cart, checkout, user accounts, order history,
and an admin dashboard to manage products and orders — all in plain HTML/CSS/JS on the frontend,
with a small Node.js backend. **No npm install needed**, it runs with just Node.js.

## Run it

```bash
cd backend
node server.js
```

Then open **http://localhost:3000** in your browser.

- Shop as a customer: sign up at `/signup.html`, browse, add to cart, checkout.
- Manage the store: go to **http://localhost:3000/admin** and log in with:
  - Email: `admin@dukaan.test`
  - Password: `admin123`
  - **Change this password** before you let anyone else near the admin panel (see "Security" below).

## What's included

- **Storefront**: home page with categories, search, sort, product cards
- **Product page**: details, quantity picker, add to cart / buy now
- **Cart**: quantity updates, remove items, free delivery over ₹999
- **Accounts**: signup/login, order history per customer
- **Checkout**: delivery address form, payment method choice (COD / UPI / Card — see "Payments" below)
- **Admin dashboard**: revenue/order/stock overview, add/edit/delete products, update order status

## How data is stored

There's no database server to install — data lives in JSON files under `backend/data/`
(`products.json`, `users.json`, `orders.json`, `carts.json`, `sessions.json`). This is genuinely fine
for a small store with light traffic. When you outgrow it (hundreds of orders a day, multiple people
editing at once), swap `backend/lib/db.js` for a real database — Postgres or MySQL are the usual
choices, and the rest of the code barely needs to change since all reads/writes already go through
that one file.

## Payments — important

Checkout currently uses a **mock payment step** (see `processPayment()` in `backend/server.js`) so
the whole flow works without a merchant account. It always "succeeds" — no real money moves.

To accept real payments, you need a payment gateway account. Popular choices in India: **Razorpay**,
**Cashfree**, **PayU**; internationally, **Stripe**. The general steps are the same for any of them:

1. Sign up for a merchant account and complete KYC (they'll ask for business/bank details).
2. Get your API keys from their dashboard.
3. Install their SDK (e.g. `npm install razorpay`) and replace `processPayment()` with a real call
   to create an order/charge, then verify the payment signature they send back before marking the
   order as paid.
4. Never put secret API keys in frontend code — they belong only in the backend.

I didn't wire this up because it needs your real business/bank details, which I obviously don't have
and shouldn't be guessing at — happy to help you wire in a specific gateway once you've picked one.

## Taking this live (a real domain, real visitors)

1. Pick a host that runs Node.js: Render, Railway, Fly.io, a VPS, etc.
2. Set the `PORT` environment variable if your host requires a specific port.
3. Put the site behind HTTPS (most hosts do this automatically).
4. Swap in a real database once you're past the JSON-file stage (see above).
5. Connect a real payment gateway (see above).
6. Change the default admin password immediately — open `backend/data/users.json` and either
   delete that account and sign up fresh then manually flip `"isAdmin": true`, or ask me to add a
   "change password" admin screen.

## Security notes for a real launch

- Sessions are simple tokens stored in a cookie — fine for a starter site, but for serious scale
  consider expiring old sessions and rotating tokens on login.
- Add HTTPS in production (see above) so login/cart cookies aren't sent in plain text.
- Validate file uploads if you later add real product photos instead of emoji icons.

## Extending it

Some natural next steps, roughly in order of usefulness:
- Real product photos (swap the emoji+color placeholder for an `<img>` and an uploads folder)
- Product reviews/ratings from real customers
- Email confirmations on order placement
- Discount codes / coupons
- Multiple admin accounts with different permission levels

Want any of these next? Just ask.
