# Technical Design Document — Flash-Sale Platform

This document describes **how** the system is built, answering the requirements in
the SRS: where the SRS says _what_ must happen (e.g. FR-15: no oversell), this says
_how_ it is achieved. References like `(FR-15)` point to the requirement a decision
satisfies. It does not repeat the requirements — see the SRS for those.

Each section lives in its own file. Section numbers are stable — a reference like
"§4" anywhere in the code or rules means the file starting with `04-`.

| §   | Section                                                    | File                                                     |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Architecture Overview                                      | [01-architecture.md](01-architecture.md)                 |
| 2   | Repository Structure                                       | [02-repository-structure.md](02-repository-structure.md) |
| 3   | Components & Responsibilities                              | [03-components.md](03-components.md)                     |
| 4   | Purchase Flow — the core (canonical concurrency reference) | [04-purchase-flow.md](04-purchase-flow.md)               |
| 5   | Data Model                                                 | [05-data-model.md](05-data-model.md)                     |
| 6   | Real-Time Design                                           | [06-real-time.md](06-real-time.md)                       |
| 7   | Background Jobs (Ext)                                      | [07-background-jobs.md](07-background-jobs.md)           |
| 8   | Deployment                                                 | [08-deployment.md](08-deployment.md)                     |
| 9   | Key Decisions & Trade-offs                                 | [09-key-decisions.md](09-key-decisions.md)               |
| 10  | Order Lifecycle — unfinished orders and reserved stock     | [10-order-lifecycle.md](10-order-lifecycle.md)           |
