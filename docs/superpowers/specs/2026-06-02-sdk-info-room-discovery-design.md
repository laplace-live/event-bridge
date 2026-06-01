# SDK `/info` Room Discovery — Design

- **Date:** 2026-06-02
- **Status:** Approved (ready for implementation plan)
- **Package:** `@laplace.live/event-bridge-sdk` (`packages/sdk`)
- **Type:** Backward-compatible feature addition (minor version bump)

## Context

The LAPLACE Event Fetcher (LEF), when run in WebSocket bridge mode, exposes a
`GET /info` HTTP endpoint that lists every configured room plus instance
metadata. The plain Event Bridge server and older fetcher versions do **not**
implement `/info`.

A downstream consumer, `laplace-chat-overlay`, needed to show the user which
rooms are available so they can pick which ones to allow. Because our SDK is
**WebSocket-only and has no HTTP capability**, the overlay had to hand-roll the
entire `/info` client in `src/lib/fetcher-info.ts`:

1. **Redefined the wire types** — `FetcherRoom` and a `FetcherInfoResponse`
   wrapper, by hand, mirroring LEF's schema.
2. **Re-derived the HTTP URL from WS settings** — `buildInfoUrl()` converting
   `ws://`/`wss://` → `http(s)://…/info`, with a comment noting it "mirrors the
   URL handling in `useLaplaceClient`" (i.e. duplicated logic even within the
   overlay).
3. **Implemented fetch + auth + silent fallback** — `GET` with
   `Authorization: Bearer <token>`, returning `FetcherRoom[]` or `null` on any
   failure (old fetcher, plain Event Bridge server, abort, network/parse error).

Every future consumer that wants room discovery would repeat all three steps.
That is the developer-experience gap this design closes.

### What LEF's `/info` returns

```jsonc
{
  "success": true,
  "status": 200,
  "data": {
    "version": "4.0.20",
    "uptime": "2 hours ago",
    "connectedAt": 1717200000000,
    "websocketBridge": true,
    "websocketClients": 3,
    "rooms": [
      { "status": 0,   "uid": 2132180406, "roomId": 25034104, "shortRoomId": 0, "username": "明前奶绿" },
      { "status": 404, "uid": 0,          "roomId": 456117,   "shortRoomId": 0, "username": null }
    ]
  }
}
```

- Auth: `Authorization: Bearer <token>` (also accepts a bare token); only
  required when LEF has `AUTH_KEY` configured.
- `Cache-Control: private, max-age=60` on success.
- `status: 0` on a room means resolved; non-zero (e.g. `404`) means the room
  could not be looked up.

## Goals

- Give the SDK a first-class, typed way to fetch `/info` so consumers stop
  hand-rolling types, URL derivation, and fetch/fallback.
- Work **without an active WebSocket connection** (discovery happens before/while
  the user configures the connection).
- Be a faithful drop-in for the overlay's existing behavior so the overlay can
  delete its hand-rolled module.

## Non-Goals

- Server-side `rooms`/`uids` connection filtering (LEF supports it; deferred to a
  future DX pass — explicitly out of scope here).
- Exporting general-purpose URL utilities or any broader SDK refactor.
- Changes to `@laplace.live/event-types`. The `/info` payload is a *bridge
  protocol* shape, not a chat event, so the types live in the SDK.
- Any change inside `laplace-event-fetcher` (LEF already ships `/info`).

## Design

All additions go in the single SDK module `packages/sdk/index.ts`. The package's
`types` entry already points at `./index.ts`, so new exported types are available
to consumers immediately.

### 1. Exported types

Placed alongside the other exported types (after `ConnectionOptions`). Names use
the `Fetcher*` prefix for parity with the overlay and LEF terminology.

```ts
export interface FetcherRoom {
  /** 0 when the room was resolved, otherwise an error code (e.g. 404). */
  status: number
  uid: number
  /** Canonical room id. Matches the `origin` field on incoming events. */
  roomId: number
  shortRoomId: number
  username: string | null
}

export interface FetcherInfo {
  version: string
  uptime: string
  connectedAt: number
  websocketBridge: boolean
  websocketClients: number
  rooms: FetcherRoom[]
}
```

`FetcherInfo` is the unwrapped `data` payload — the shape consumers actually
care about. The `{ success, status, data }` envelope is an **internal**
interface (`FetcherInfoResponse`), not exported.

### 2. `FetchInfoOptions` + `fetchInfo()` (standalone, exported)

```ts
export interface FetchInfoOptions {
  /** Same ws/wss URL style as ConnectionOptions.url, e.g. 'ws://localhost:9696'. */
  url: string
  /** Auth token; sent as `Authorization: Bearer <token>` when present. */
  token?: string
  /** Optional AbortSignal for cancellation (e.g. a modal closing). */
  signal?: AbortSignal
}

/**
 * Fetch instance/room info from a LAPLACE Event Fetcher `/info` endpoint.
 * Returns `null` (never throws) when info cannot be determined: an old fetcher
 * without `/info`, a plain Event Bridge server, an aborted request, or any
 * network/HTTP/parse error. Callers should treat `null` as "not supported" and
 * fall back to manual entry.
 */
export async function fetchInfo(options: FetchInfoOptions): Promise<FetcherInfo | null>
```

Behavior:

- Return `null` immediately if `url` is empty.
- Build the request URL as `wsToHttp(url) + '/info'`.
- Set `Authorization: Bearer <token>` only when `token` is non-empty.
- `GET` with the provided `signal`.
- Return `null` if the response is not OK, if `success` is not `true`, or if
  `data.rooms` is not an array; otherwise return `data` as `FetcherInfo`.
- Wrap everything in `try/catch` and return `null` on any thrown error.

`fetch` and `AbortSignal` are standard globals in all target runtimes (modern
browsers, Bun, Node ≥ 18); no polyfill or new dependency is required.

### 3. `wsToHttp()` (internal helper)

A private module-level function (not exported — keeps the surface minimal per the
focused scope):

```ts
function wsToHttp(url: string): string
```

- `wss://host[:port]` → `https://host[:port]`
- `ws://host[:port]` → `http://host[:port]`
- `http://…` / `https://…` → unchanged
- bare host (no scheme) → `https://` if it contains `:443`, else `http://`
- strip any trailing slash(es) before the caller appends `/info`

This becomes the SDK's single source of truth for ws→http derivation, replacing
the overlay's `buildInfoUrl`.

### 4. `client.getInfo()` (instance method, thin delegate)

Added to `LaplaceEventBridgeClient` near the other status accessors
(`getConnectionState`, `getClientId`). Requires **no** prior `connect()`:

```ts
/**
 * Fetch `/info` (rooms + instance metadata) using this client's configured
 * url/token. Returns null when unsupported/unreachable (see fetchInfo).
 */
getInfo(signal?: AbortSignal): Promise<FetcherInfo | null> {
  return fetchInfo({ url: this.options.url, token: this.options.token, signal })
}
```

### Failure semantics (decided)

Return `null`, never throw — covering old/unsupported servers, network errors,
non-OK status (incl. 403), aborts, and bad JSON uniformly. This is the overlay's
proven contract and the lowest-friction drop-in. Distinguishing failure causes
(e.g. surfacing 403) is intentionally not done here.

## Files changed (SDK)

| File | Change |
| --- | --- |
| `packages/sdk/index.ts` | Add `FetcherRoom`, `FetcherInfo`, `FetchInfoOptions` (exported); `FetcherInfoResponse` + `wsToHttp` (internal); `fetchInfo()` (exported); `getInfo()` method. |
| `packages/sdk/index.test.ts` | Add tests (below). |
| `packages/sdk/README.md` | Add a "Room discovery" section documenting `fetchInfo` / `getInfo`, the `null` = unsupported contract, and the `FetcherInfo`/`FetcherRoom` shapes. |
| `packages/sdk/example.ts` | Add a discovery snippet: call `fetchInfo`/`getInfo` before `connect()` and log available rooms. |
| `packages/sdk/package.json` | Version bump to `1.1.0` via changeset (not edited by hand). |
| `.changeset/*.md` | New `minor` changeset for `@laplace.live/event-bridge-sdk`. |

## Testing

Bun tests in `packages/sdk/index.test.ts`, mocking the global `fetch`:

- **URL derivation** (observed via the URL passed to the mocked `fetch`):
  - `ws://localhost:9696` → `http://localhost:9696/info`
  - `wss://event-fetcher.laplace.cn` → `https://event-fetcher.laplace.cn/info`
  - port preserved; trailing slash on the base URL does not double up.
- **Auth header:** `Authorization: Bearer <token>` present when a token is given;
  absent when token is empty/omitted.
- **Success:** valid envelope → returns `data` (`FetcherInfo`) with `rooms`.
- **Null fallbacks (each returns `null`, no throw):** empty `url`; `res.ok ===
  false` (e.g. 403/404); `success !== true`; `data.rooms` not an array; `fetch`
  rejects (network error); `res.json()` rejects (bad JSON); aborted signal.
- **`getInfo()` delegation:** a client constructed with `{ url, token }` (no
  `connect()`) calls `fetch` with the derived URL and bearer header.

## Versioning

Backward-compatible additions only → **minor** bump `1.0.24 → 1.1.0` via a new
changeset (the repo's release flow handles the actual version/publish).

## Validating consumer change (separate repo — follow-up, NOT in the SDK plan)

After the SDK ships, `laplace-chat-overlay` proves the gap is closed:

- `src/lib/fetcher-info.ts` collapses to
  `import { fetchInfo, type FetcherRoom } from '@laplace.live/event-bridge-sdk'`
  (or is deleted, with call sites importing the SDK directly); the hand-rolled
  types, `buildInfoUrl`, and fetch/fallback are removed (~90 lines).
- `src/components/settings-modal.tsx` swaps `fetchAvailableRooms(host, port,
  password, signal)` for `fetchInfo({ url, token, signal })` (reading
  `info?.rooms`), building `url` the same way `useLaplaceClient` already does.

This is tracked as a follow-up so the SDK implementation plan stays scoped to
this repository.

## Open questions

None — scope, API shape (standalone `fetchInfo` + delegating `getInfo`),
naming (`Fetcher*`), and failure semantics (`null`, never throw) are all decided.
