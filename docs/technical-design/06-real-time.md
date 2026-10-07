# 6. Real-Time Design

- **Socket.IO** for browser connections, with the **Redis adapter** so broadcasts
  reach clients regardless of which `api` instance they hit. (NFR-10)
- The `worker` never touches sockets: it publishes results to Redis pub/sub, and the
  `api` (which owns the sockets) relays them. This keeps the worker free of
  connection state.
- Clients reconnect and, on reconnect, re-fetch current event state, so a dropped
  connection never leaves stale data. (FR-19)
