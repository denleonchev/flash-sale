# Flash-Sale Platform — Vision & Scope

## 1. Vision

A web platform for **flash sales**: short, time-limited drops where one product is
sold with limited stock, and many users try to buy it at the same time. The whole
product is built around that one hard moment — a crowd of buyers fighting for a few
items. The system must get it right: never sell more than the stock, handle orders
in a clear order, and show everyone the live stock in real time.

## 2. Users

- **Buyers** — they watch the live stock and a countdown, and try to buy before the
  item is gone.
- **Admins** — they create a drop: one product, a stock count, a start and end time.
- **Moderators** — they review orders that the system marks as suspicious.

## 3. Scope — In

- **Events** — an admin creates a drop (one product, stock, start/end). A drop has
  three states: upcoming, live, ended.
- **Buying** — a buyer clicks "Buy". The system accepts the request right away and
  handles it in the background. The result is **confirmed** or **sold out**.
- **Correctness** — three rules that must always hold:
  - **No overselling**: confirmed orders never go above the stock.
  - **Ordered processing**: requests are handled one at a time, in order.
  - **Idempotency**: a repeated or double-clicked request makes no extra order.
- **Real-time** — the stock and the countdown update live for all users. Each buyer
  gets their own result in real time. Clients can reconnect if they drop.
- **Fraud screening** — a background process checks each order for suspicious
  behavior and marks risky ones for a moderator. It runs off the buying path, so it
  never slows a purchase.
- **Notifications** — one email per order result, sent in the background and retried
  if it fails.

## 4. Non-Goals

This is not a full online shop. There are no real payments, no shipping, no taxes,
no product catalog, and no user accounts beyond what an order needs. There is also
no analytics, no translations, and no multi-currency. **One drop = one product, one
stock counter** — no multiple products, bundles, variants, discounts, or coupons.

## 5. Success Criteria

In a test with many buyers and a small stock, the number of confirmed orders is
**exactly equal** to the stock — no oversell and no duplicates. All users see the
stock reach zero at the same time. Every buyer gets a final, correct result. Emails
are delivered even after a short failure of the email provider.

## 6. Constraints

- Web app only, built to work on any screen size. No native mobile app.
- The database and the cache/queue are external managed services. The app's own
  services stay stateless where possible.
- AI features (fraud screening) are secondary. The main buying flow works fully
  without them.
