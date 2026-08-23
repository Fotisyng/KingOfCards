# KingOfCards

A flashcard app where the **spaced-repetition scheduler is the product, not the CRUD around it**.
Decks and cards are the minimum scaffolding needed to generate real review data; the actual
deliverable is a faithful SM-2 implementation (Anki's algorithm), a differentiator half-life-style
algorithm built on top, and a simulation-backed comparison of the two.

React frontend, Fastify/tRPC API, Turso (libSQL) as the only datastore. v1 was single-user with no
auth; accounts (public signup, email+password, per-user data) were added afterward.

## Where to go next

- **[Architecture](architecture.md)**: start here if you just want to know what runs where (ports,
  services, diagrams for local dev and Docker).
- **[Getting Started](getting-started.md)**: install dependencies and run the app locally.
- **[Docker](docker.md)**: run the whole stack in containers, including horizontal scaling.
- **[Scheduler Algorithms](scheduler.md)**: how SM-2 and the HLR-style scheduler actually work.
- **[SM-2 vs. HLR Comparison](comparison.md)**: the simulation results comparing them.
- **[Design Decisions](design-decisions.md)**: the deeper "why" behind the stack, data model, and
  offline strategy.
