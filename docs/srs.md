# Software Requirements Specification (SRS) — Flash-Sale Platform

This document describes what the system must do. It builds on the Vision & Scope
document and goes one level deeper. It is organised in three parts: user
requirements (what users need), functional requirements (what the system does),
and non-functional requirements (how the system must behave).

Each requirement has an ID and a priority:

- **[Core]** — required for the product to work; built first.
- **[Ext]** — extension; built only after the core is complete, and dropped first
  if time runs short.

---

## 1. User Requirements

High-level needs, in the users' own terms. The functional requirements below
exist to satisfy these.

- **UR-1** As a **buyer**, I want to see a product on sale with how much stock is
  left and how much time remains, so I know whether I can still buy it.
- **UR-2** As a **buyer**, I want to try to buy the item with a single action and
  get a clear result (got it / sold out), so I am never left unsure.
- **UR-3** As a **buyer**, I want the stock count and countdown to update live, so
  I do not act on stale information.
- **UR-4** As a **buyer**, I want to never be charged or confirmed for an item that
  is actually out of stock.
- **UR-5** As an **admin**, I want to create a sale event with a product, a stock
  amount, and a start/end time.
- **UR-6** As a **moderator**, I want suspicious orders to be flagged for my review
  before they are treated as final. _(Ext)_
- **UR-7** As a **buyer**, I want a confirmation message about the outcome of my
  order. _(Ext)_

---

## 2. Functional Requirements

What the system does. Grouped by area.

### 2.1 Sale events

- **FR-1 [Core]** An admin can create a sale event with: one product, a stock count
  (a positive integer), a start time, and an end time.
- **FR-2 [Core]** A sale event has a state derived from the current time and stock:
  **upcoming** (before start), **live** (between start and end, stock > 0),
  **ended** (after end or stock = 0).
- **FR-3 [Core]** Buying is allowed only while the event is **live**. Requests
  outside this state are rejected with a clear reason.
- **FR-4 [Core]** An admin can end an event early.

### 2.2 Browsing

- **FR-5 [Core]** A buyer can view an event: product details, current state,
  remaining stock, and time remaining.
- **FR-6 [Core]** A buyer must be authenticated to place an order.

### 2.3 Purchase flow

- **FR-7 [Core]** A buyer places an order with a single action ("Buy").
- **FR-8 [Core]** On "Buy", the system **reserves one unit of stock atomically**
  before accepting the order. If no stock is available, the order is rejected as
  **sold out**.
- **FR-9 [Core]** Once stock is reserved, the request is **accepted immediately**
  and the order is queued for background processing; the buyer is told the order is
  being processed.
- **FR-10 [Core]** Orders are processed **one at a time, in order of acceptance**.
- **FR-11 [Core]** Processing a payment step uses a **simulated (fake) payment**
  that returns success or failure. On success the order becomes **confirmed**; on
  failure the reserved stock is **released** and the order becomes **failed**.
- **FR-12 [Ext]** The payment step may instead use a real payment provider in
  **test mode** (test keys, no real money). The provider's result event drives the
  same confirm/fail outcome as FR-11.
- **FR-13 [Core]** Each order ends in exactly one final state: **confirmed**,
  **sold out**, or **failed**.
- **FR-14 [Core]** **Idempotency**: a repeated or double-submitted "Buy" from the
  same buyer for the same event does not create a second order or reserve a second
  unit.

### 2.4 Stock integrity

- **FR-15 [Core]** The number of **confirmed** orders for an event never exceeds
  its stock count, under any amount of concurrent buying. (No oversell.)
- **FR-16 [Core]** Stock reserved for an order that later fails is returned to the
  available pool so it can be sold to someone else.

### 2.5 Real-time updates

- **FR-17 [Core]** Remaining stock and the countdown are pushed to all connected
  clients of an event in real time.
- **FR-18 [Core]** A buyer receives the final result of their own order in real
  time.
- **FR-19 [Core]** Clients that lose the connection can reconnect and receive the
  current state.

### 2.6 Fraud screening _(Ext)_

- **FR-20 [Ext]** After an order is created, a **background** process screens it for
  suspicious patterns (for example unusual order frequency or account history).
- **FR-21 [Ext]** Screening runs **off the purchase path** and never delays or
  blocks a purchase.
- **FR-22 [Ext]** Orders judged risky are **flagged for moderator review**; the
  screening result and a short reason are stored with the order.

### 2.7 Notifications _(Ext)_

- **FR-23 [Ext]** When an order reaches a final state, the buyer is sent a
  transactional email describing the outcome.
- **FR-24 [Ext]** Email is sent as a **background job** and **retried** on
  provider failure.
- **FR-25 [Ext]** Email is **idempotent**: one email per order outcome, with no
  duplicates on retry.

### 2.8 Search _(Ext)_

- **FR-26 [Ext]** A buyer can search products by meaning, not only exact words
  (semantic search). Search data is prepared in the background.

---

## 3. Non-Functional Requirements

How the system must behave, regardless of feature.

### 3.1 Correctness & consistency

- **NFR-1 [Core]** Stock integrity (no oversell, no duplicate orders) must hold
  under concurrent load — this is the system's primary quality.
- **NFR-2 [Core]** All money-or-stock-changing steps must be safe to retry without
  side effects (idempotent).

### 3.2 Performance & responsiveness

- **NFR-3 [Core]** "Buy" requests are **accepted quickly** even during a spike;
  heavy work is deferred to background processing.
- **NFR-4 [Core]** Real-time stock/countdown updates reach connected clients with
  low, human-imperceptible delay under normal demo load.

### 3.3 Reliability & availability

- **NFR-5 [Core]** Background processing survives transient failures: a failed job
  is retried, and a crash does not lose accepted orders.
- **NFR-6 [Ext]** External integrations (email, payment provider) are treated as
  unreliable and are retried with backoff.

### 3.4 Security

- **NFR-7 [Core]** Buyers and admins are authenticated; admin-only actions
  (creating/ending events) are restricted to admins.
- **NFR-8 [Core]** Secrets (database, cache, API keys) are provided via environment
  configuration and never committed to the repository.
- **NFR-9 [Core]** Input is validated server-side; the client is never trusted for
  stock, price, or authorisation decisions.

### 3.5 Scalability & architecture

- **NFR-10 [Core]** Application services are **stateless** where possible; shared
  state lives in the database and cache, so processing does not depend on which
  instance handles a request.
- **NFR-11 [Core]** Intake and processing are **decoupled** by a queue, so the two
  can be reasoned about and scaled independently.

### 3.6 Constraints

- **NFR-12** The product is a **responsive web application**; there is no native
  mobile client.
- **NFR-13** AI features run **off the main purchase path** and use a text-only LLM
  via a rate-limited free tier; the core purchase flow works fully without them.
- **NFR-14** Embeddings (for semantic search) are computed **in the background**,
  never on the request path.
- **NFR-15** Stateful infrastructure (database, cache/queue) is an external managed
  dependency; only the application services are self-hosted.

---

## 4. Priority Summary

- **Core (build first):** FR-1 to FR-11, FR-13 to FR-19; NFR-1 to NFR-5, NFR-7 to
  NFR-11.
- **Extensions (only after core, dropped first if time is short, in this order):**
  email (FR-23–25), fraud screening (FR-20–22), semantic search (FR-26), real
  payment in test mode (FR-12).
  A complete, working core satisfies the product's purpose on its own. Extensions
  add value but are never built at the expense of the core.
