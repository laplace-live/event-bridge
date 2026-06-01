# SDK `/info` Room Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class, typed `/info` room discovery to `@laplace.live/event-bridge-sdk` so consumers stop hand-rolling the types, ws→http URL derivation, and fetch/fallback.

**Architecture:** A standalone exported `fetchInfo({ url, token, signal })` does a `GET <http-url>/info` (deriving the HTTP URL from the ws/wss URL via an internal `wsToHttp` helper), returns the unwrapped `data` payload as `FetcherInfo`, and returns `null` on any failure (never throws). A thin `client.getInfo()` method delegates to it using the client's configured `url`/`token` — no active connection required.

**Tech Stack:** TypeScript, Bun runtime, `bun:test`, Changesets. The SDK is a single module (`packages/sdk/index.ts`) with zero runtime dependencies; `fetch`/`Response`/`AbortSignal` are standard globals in all target runtimes.

**Spec:** `docs/superpowers/specs/2026-06-02-sdk-info-room-discovery-design.md`

---

## File Structure

All work is in the `packages/sdk` package. No new files in the package source (the SDK is intentionally a single module).

| File | Responsibility | Change |
| --- | --- | --- |
| `packages/sdk/index.ts` | The entire SDK surface | Add `FetcherRoom`/`FetcherInfo`/`FetchInfoOptions` (exported) + `FetcherInfoResponse`/`wsToHttp` (internal) + `fetchInfo()` (exported) + `getInfo()` method |
| `packages/sdk/index.test.ts` | Bun tests | Append `describe('fetchInfo')` and `describe('client.getInfo')` blocks; extend the `./index` import |
| `packages/sdk/README.md` | Public docs | Add `getInfo` to the method list + a "Room Discovery" section |
| `packages/sdk/example.ts` | Runnable example | Add a discovery snippet before `connect()` |
| `.changeset/sdk-info-room-discovery.md` | Release note | New `minor` changeset |

## Conventions & commands (read once)

- **Run tests from the package dir.** `bun test` runs the whole suite, but it includes a ~28s reconnection test. During iteration, filter by name:
  - `cd packages/sdk && bun test -t fetchInfo`
  - `cd packages/sdk && bun test -t getInfo`
  - Full run at the end: `cd packages/sdk && bun test`
- **Type gate for the public API.** `tsc -p tsconfig.json` is permanently red because of the unrelated `references/` folder (a copy of the server with missing deps). Do NOT use it. Instead typecheck the library file in isolation with the project's flags:
  ```bash
  cd packages/sdk && bunx tsc --noEmit --skipLibCheck --strict --noUncheckedIndexedAccess --lib esnext,dom --module preserve --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax index.ts
  ```
  Expected: no output, exit 0.
- **Style notes that will bite you:** `strict` + `noUncheckedIndexedAccess` are on, so array access is `T | undefined` — the tests use `!` (e.g. `spy.mock.calls[0]![0]`). `verbatimModuleSyntax` is on — import values normally, but any type-only import must use `import type`.

---

## Task 1: `fetchInfo()` + types + `wsToHttp()`

**Files:**
- Modify: `packages/sdk/index.ts` (add types after `ConnectionOptions` at line 64; append functions after the class at line 469)
- Test: `packages/sdk/index.test.ts` (extend import on line 3; append a `describe` block after line 228)

- [ ] **Step 1: Write the failing tests**

In `packages/sdk/index.test.ts`, change the import on line 3 from:

```ts
import { ConnectionState, LaplaceEventBridgeClient } from './index'
```

to:

```ts
import { ConnectionState, fetchInfo, LaplaceEventBridgeClient } from './index'
```

Then append this block to the end of the file (after the closing `})` of the top-level `describe('LaplaceEventBridgeClient', …)`):

```ts
describe('fetchInfo', () => {
  const realFetch = globalThis.fetch

  // Minimal valid `/info` payload — the `data` object fetchInfo returns.
  const sampleInfo = {
    version: '4.0.20',
    uptime: '2 hours ago',
    connectedAt: 1717200000000,
    websocketBridge: true,
    websocketClients: 3,
    rooms: [
      { status: 0, uid: 2132180406, roomId: 25034104, shortRoomId: 0, username: '明前奶绿' },
      { status: 404, uid: 0, roomId: 456117, shortRoomId: 0, username: null },
    ],
  }

  const okResponse = (data: unknown) =>
    new Response(JSON.stringify({ success: true, status: 200, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('derives an http URL from a ws URL and appends /info', async () => {
    const spy = jest.fn(async () => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe('http://localhost:9696/info')
  })

  test('derives an https URL from a wss URL', async () => {
    const spy = jest.fn(async () => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'wss://event-fetcher.laplace.cn' })

    expect(spy.mock.calls[0]![0]).toBe('https://event-fetcher.laplace.cn/info')
  })

  test('does not double up a trailing slash on the base URL', async () => {
    const spy = jest.fn(async () => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696/' })

    expect(spy.mock.calls[0]![0]).toBe('http://localhost:9696/info')
  })

  test('sends an Authorization bearer header when a token is provided', async () => {
    const spy = jest.fn(async () => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696', token: 'secret' })

    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })

  test('omits the Authorization header when no token is provided', async () => {
    const spy = jest.fn(async () => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696' })

    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  test('returns the data payload on success', async () => {
    globalThis.fetch = (async () => okResponse(sampleInfo)) as unknown as typeof fetch

    const info = await fetchInfo({ url: 'ws://localhost:9696' })

    expect(info).toEqual(sampleInfo)
    expect(info?.rooms).toHaveLength(2)
  })

  test('returns null without fetching when url is empty', async () => {
    const spy = jest.fn()
    globalThis.fetch = spy as unknown as typeof fetch

    const info = await fetchInfo({ url: '' })

    expect(info).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  test('returns null on a non-ok response (e.g. 403)', async () => {
    globalThis.fetch = (async () => new Response('', { status: 403 })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when the envelope success flag is false', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false, status: 403, message: 'Unauthorized' }), {
        status: 200,
      })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when rooms is not an array', async () => {
    globalThis.fetch = (async () => okResponse({ ...sampleInfo, rooms: undefined })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null on a network error', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null on invalid JSON', async () => {
    globalThis.fetch = (async () => new Response('not json', { status: 200 })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when the signal is already aborted', async () => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      return okResponse(sampleInfo)
    }) as unknown as typeof fetch

    const controller = new AbortController()
    controller.abort()

    expect(await fetchInfo({ url: 'ws://localhost:9696', signal: controller.signal })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/sdk && bun test -t fetchInfo`
Expected: FAIL — the test file fails to load because `./index` does not yet export `fetchInfo` (Bun reports a missing-export error like `export 'fetchInfo' not found in './index'`).

- [ ] **Step 3: Add the types**

In `packages/sdk/index.ts`, find (lines 62-66):

```ts
  pingTimeout?: number
}

export class LaplaceEventBridgeClient {
```

Replace with:

```ts
  pingTimeout?: number
}

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

export interface FetchInfoOptions {
  /** Same ws/wss URL style as ConnectionOptions.url, e.g. 'ws://localhost:9696'. */
  url: string
  /** Auth token; sent as `Authorization: Bearer <token>` when present. */
  token?: string
  /** Optional AbortSignal for cancellation (e.g. a modal closing). */
  signal?: AbortSignal
}

/** The `/info` response envelope. Internal — callers receive the unwrapped `data` (FetcherInfo). */
interface FetcherInfoResponse {
  success: boolean
  status: number
  data: FetcherInfo
}

export class LaplaceEventBridgeClient {
```

- [ ] **Step 4: Add `wsToHttp()` and `fetchInfo()`**

In `packages/sdk/index.ts`, find the end of the class (lines 463-469):

```ts
  private stopPingMonitoring(): void {
    if (this.pingMonitorTimer) {
      clearInterval(this.pingMonitorTimer)
      this.pingMonitorTimer = null
    }
  }
}
```

Replace with (same code, then the two module-level functions appended after the class):

```ts
  private stopPingMonitoring(): void {
    if (this.pingMonitorTimer) {
      clearInterval(this.pingMonitorTimer)
      this.pingMonitorTimer = null
    }
  }
}

/**
 * Convert a ws/wss URL to its http/https origin (preserving host and port) so we
 * can reach HTTP endpoints like `/info`. http(s) URLs pass through; a bare host
 * with no scheme defaults to http (or https when it targets port 443). Any
 * trailing slash is stripped so callers can append a path.
 */
function wsToHttp(url: string): string {
  let httpUrl: string
  if (url.startsWith('wss://')) {
    httpUrl = `https://${url.slice('wss://'.length)}`
  } else if (url.startsWith('ws://')) {
    httpUrl = `http://${url.slice('ws://'.length)}`
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    httpUrl = url
  } else {
    httpUrl = `${url.includes(':443') ? 'https' : 'http'}://${url}`
  }
  return httpUrl.replace(/\/+$/, '')
}

/**
 * Fetch instance/room info from a LAPLACE Event Fetcher `/info` endpoint.
 *
 * Returns `null` (never throws) whenever the info cannot be determined: an old
 * fetcher without `/info`, a plain Event Bridge server, an aborted request, or
 * any network/HTTP/parse error. Callers should treat `null` as "not supported"
 * and fall back to manual entry.
 *
 * @example
 * const info = await fetchInfo({ url: 'ws://localhost:9696', token })
 * info?.rooms.forEach(room => console.log(room.roomId, room.username))
 */
export async function fetchInfo(options: FetchInfoOptions): Promise<FetcherInfo | null> {
  const { url, token, signal } = options
  if (!url) {
    return null
  }

  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers.authorization = `Bearer ${token}`
    }

    const response = await fetch(`${wsToHttp(url)}/info`, {
      method: 'GET',
      headers,
      signal,
    })

    if (!response.ok) {
      return null
    }

    const json = (await response.json()) as FetcherInfoResponse
    if (!json?.success || !Array.isArray(json?.data?.rooms)) {
      return null
    }

    return json.data
  } catch {
    // Silent fallback: old fetcher without /info, plain Event Bridge server,
    // aborted request, network failure, or a non-JSON response.
    return null
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/sdk && bun test -t fetchInfo`
Expected: PASS — 13 tests pass, 0 fail.

- [ ] **Step 6: Verify the public types still typecheck**

Run:
```bash
cd packages/sdk && bunx tsc --noEmit --skipLibCheck --strict --noUncheckedIndexedAccess --lib esnext,dom --module preserve --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax index.ts
```
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/index.ts packages/sdk/index.test.ts
git commit -m "feat(sdk): add fetchInfo() for /info room discovery"
```

---

## Task 2: `client.getInfo()` method

**Files:**
- Modify: `packages/sdk/index.ts` (insert method between `getClientId` at line 346 and `send` at line 348)
- Test: `packages/sdk/index.test.ts` (append a second `describe` block)

- [ ] **Step 1: Write the failing test**

Append this block to the end of `packages/sdk/index.test.ts` (after the `describe('fetchInfo', …)` block from Task 1). No import change is needed — `LaplaceEventBridgeClient` is already imported.

```ts
describe('client.getInfo', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('fetches /info using the client url and token without connecting', async () => {
    const data = {
      version: '4.0.20',
      uptime: '',
      connectedAt: 0,
      websocketBridge: true,
      websocketClients: 0,
      rooms: [],
    }
    const spy = jest.fn(async () =>
      new Response(JSON.stringify({ success: true, status: 200, data }), { status: 200 })
    )
    globalThis.fetch = spy as unknown as typeof fetch

    const client = new LaplaceEventBridgeClient({ url: 'wss://example.com', token: 'tok' })
    const info = await client.getInfo()

    expect(spy.mock.calls[0]![0]).toBe('https://example.com/info')
    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(info?.rooms).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/sdk && bun test -t getInfo`
Expected: FAIL — `client.getInfo is not a function`.

- [ ] **Step 3: Add the `getInfo` method**

In `packages/sdk/index.ts`, find (lines 341-351):

```ts
  /**
   * Get the client ID assigned by the bridge
   */
  public getClientId(): string | null {
    return this.clientId
  }

  /**
   * Send an event to the bridge
   * @param event The event to send
   */
```

Replace with:

```ts
  /**
   * Get the client ID assigned by the bridge
   */
  public getClientId(): string | null {
    return this.clientId
  }

  /**
   * Fetch `/info` (configured rooms + instance metadata) from the connected
   * LAPLACE Event Fetcher, using this client's configured url and token. Does
   * NOT require connect(). Resolves to null when discovery is unsupported (a
   * plain Event Bridge server or an older fetcher) — see {@link fetchInfo}.
   * @param signal Optional AbortSignal to cancel the request.
   */
  public getInfo(signal?: AbortSignal): Promise<FetcherInfo | null> {
    return fetchInfo({ url: this.options.url, token: this.options.token, signal })
  }

  /**
   * Send an event to the bridge
   * @param event The event to send
   */
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/sdk && bun test -t getInfo`
Expected: PASS — 1 test passes, 0 fail.

- [ ] **Step 5: Verify types and the full suite**

Run:
```bash
cd packages/sdk && bunx tsc --noEmit --skipLibCheck --strict --noUncheckedIndexedAccess --lib esnext,dom --module preserve --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax index.ts && bun test
```
Expected: tsc — no output, exit 0; `bun test` — all tests pass (the pre-existing 5 + 13 fetchInfo + 1 getInfo = 19), 0 fail. (Full run takes ~30s due to the reconnection test.)

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/index.ts packages/sdk/index.test.ts
git commit -m "feat(sdk): add client.getInfo() delegating to fetchInfo"
```

---

## Task 3: Docs — README + example

**Files:**
- Modify: `packages/sdk/README.md`
- Modify: `packages/sdk/example.ts`

- [ ] **Step 1: Add `getInfo` to the README method list**

In `packages/sdk/README.md`, find:

```markdown
- `getClientId()`: Get the client ID assigned by the bridge.
- `send(event)`: Send an event to the bridge.
```

Replace with:

```markdown
- `getClientId()`: Get the client ID assigned by the bridge.
- `getInfo(signal?)`: Fetch `/info` (configured rooms + instance metadata) from a LAPLACE Event Fetcher, using the client's url/token. No active connection required. Resolves to `null` when discovery is unsupported.
- `send(event)`: Send an event to the bridge.
```

- [ ] **Step 2: Add a "Room Discovery" section to the README**

In `packages/sdk/README.md`, find the start of the type-inference section:

```markdown
## Type Inference
```

Replace with (new section inserted before it):

```markdown
## Room Discovery

When the server is a [LAPLACE Event Fetcher](https://chat.laplace.live) in bridge mode, it exposes a `/info` HTTP endpoint listing the configured rooms. The SDK can fetch it without an active WebSocket connection — useful for letting users pick which rooms to receive.

Use the `client.getInfo()` method (reuses the client's `url`/`token`):

```typescript
const client = new LaplaceEventBridgeClient({ url: 'ws://localhost:9696', token })

const info = await client.getInfo()
if (info) {
  console.log(`Fetcher v${info.version} exposes ${info.rooms.length} room(s)`)
  for (const room of info.rooms) {
    console.log(`${room.roomId}: ${room.username ?? 'unknown'}`)
  }
} else {
  // Plain Event Bridge server or an older fetcher — fall back to manual entry.
}
```

Or the standalone `fetchInfo()` function (no client object needed):

```typescript
import { fetchInfo } from '@laplace.live/event-bridge-sdk'

const info = await fetchInfo({ url: 'ws://localhost:9696', token, signal })
```

Both resolve to `null` (never throw) when `/info` is unavailable — an old fetcher, a plain Event Bridge server, an aborted request, or any network/parse error — so callers can silently fall back to manual room entry. The returned shapes are `FetcherInfo` and `FetcherRoom`:

```typescript
interface FetcherRoom {
  status: number // 0 = resolved, else an error code (e.g. 404)
  uid: number
  roomId: number // canonical room id; matches the `origin` field on events
  shortRoomId: number
  username: string | null
}

interface FetcherInfo {
  version: string
  uptime: string
  connectedAt: number
  websocketBridge: boolean
  websocketClients: number
  rooms: FetcherRoom[]
}
```

## Type Inference
```

- [ ] **Step 3: Add a discovery snippet to the example**

In `packages/sdk/example.ts`, find (lines 10-13):

```ts
})

// Connect to the LAPLACE Event Bridge
client
```

Replace with:

```ts
})

// Discover which rooms the server exposes (LAPLACE Event Fetcher /info).
// Resolves to null on a plain Event Bridge server or an older fetcher.
client.getInfo().then(info => {
  if (info) {
    console.log(`Fetcher v${info.version} exposes ${info.rooms.length} room(s):`)
    for (const room of info.rooms) {
      console.log(`  - ${room.username ?? `Room ${room.roomId}`} (${room.roomId})`)
    }
  } else {
    console.log('Room discovery not available; rooms must be entered manually.')
  }
})

// Connect to the LAPLACE Event Bridge
client
```

- [ ] **Step 4: Verify the example still typechecks**

Run:
```bash
cd packages/sdk && bunx tsc --noEmit --skipLibCheck --strict --noUncheckedIndexedAccess --lib esnext,dom --module preserve --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax index.ts example.ts
```
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/README.md packages/sdk/example.ts
git commit -m "docs(sdk): document /info room discovery"
```

---

## Task 4: Changeset

**Files:**
- Create: `.changeset/sdk-info-room-discovery.md`

- [ ] **Step 1: Create the changeset**

Create `.changeset/sdk-info-room-discovery.md` with:

```markdown
---
"@laplace.live/event-bridge-sdk": minor
---

Add `/info` room discovery: a standalone `fetchInfo({ url, token })` and a `client.getInfo()` method that fetch the LAPLACE Event Fetcher `/info` endpoint and return the configured rooms plus instance metadata (`FetcherInfo` / `FetcherRoom`). Returns `null` when discovery is unsupported (a plain Event Bridge server or an older fetcher), so callers can fall back to manual entry. No active connection required.
```

- [ ] **Step 2: Verify the changeset is well-formed**

Run: `bunx changeset status`
Expected: reports `@laplace.live/event-bridge-sdk` to be bumped at **Minor**, exit 0.

- [ ] **Step 3: Commit**

```bash
git add .changeset/sdk-info-room-discovery.md
git commit -m "chore(sdk): add changeset for /info room discovery"
```

---

## Final Verification

- [ ] Run the full suite and type gate together:
  ```bash
  cd packages/sdk && bun test && bunx tsc --noEmit --skipLibCheck --strict --noUncheckedIndexedAccess --lib esnext,dom --module preserve --moduleResolution bundler --allowImportingTsExtensions --verbatimModuleSyntax index.ts example.ts index.test.ts
  ```
  Expected: `bun test` → all pass (19 tests), 0 fail; `tsc` → no output, exit 0.
- [ ] `git log --oneline -4` shows the four commits (feat fetchInfo, feat getInfo, docs, changeset).

---

## Out of Scope / Follow-up (NOT part of this plan)

- **`laplace-chat-overlay` migration** (separate repo): once this SDK ships, replace `src/lib/fetcher-info.ts`'s hand-rolled types/`buildInfoUrl`/fetch with `import { fetchInfo, type FetcherRoom } from '@laplace.live/event-bridge-sdk'`, and swap the `fetchAvailableRooms(...)` call in `src/components/settings-modal.tsx` for `fetchInfo({ url, token, signal })`. This is the real-world proof the DX gap is closed, tracked separately so this plan stays within the SDK repo.
- **Server-side `rooms`/`uids` connection filtering** — deferred to a future DX pass (explicitly out of scope per the spec).
