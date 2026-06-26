# Skill: Add a Socket.IO event

How to add a real-time event.

## Steps

1. Sockets live in **api** only. The worker never emits to sockets directly — it
   publishes to Redis pub/sub, and api relays. Keep this separation.
2. Use the **Redis adapter** so broadcasts work across instances. Do not hold
   broadcast state in process memory.
3. Define the event name and payload type in `packages/shared` so the frontend and
   api agree.
4. On the client: handle **reconnect**, and on reconnect re-fetch current state so
   the user never sees stale data (FR-19).
5. Scope broadcasts to the relevant event/room (per sale), not globally.

## Typical events

- stock update (broadcast to everyone watching a sale),
- order result (to the specific buyer).
