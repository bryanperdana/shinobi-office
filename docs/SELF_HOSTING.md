# Self-hosting

## Today: static demo

```bash
npm ci && npm run build:web     # web/index.html + web/app.js
npm run serve:web               # local preview on http://127.0.0.1:8080/
```

Upload `web/index.html` and `web/app.js` to any static host. The demo uses sample agents and statuses and has
on-page controls for statuses, sparring and genin. It needs no backend and makes no network calls.

## Planned: live mode

The renderer (`src/scene3d/office.js`) is driven entirely by the pure models. A live web build needs a small
adapter that does the same thing as `src/plugin/live.js`, in this order:

1. Fetch the roster and session state from a Hermes gateway, **read-only**.
2. Feed events and polls into `createLiveModel()` (`src/live/model.js`).
3. Call `office.setStatus(id, status)`, `office.setMissions(scrolls)` and so on.

The design constraints for that bridge:

- **Read-only.** Only the list/read calls documented in [PRIVACY.md](PRIVACY.md).
- **Authenticated.** Never expose a Hermes gateway publicly without auth. Prefer a private network
  (VPN/Tailnet) or localhost.
- **No message content.** It must forward only event *types*, session ids, tool names and statuses.

Contributions toward this adapter are welcome.
