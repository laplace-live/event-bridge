# LAPLACE Event Bridge SDK

A framework agnostic SDK for connecting to the LAPLACE Event Bridge server. This SDK allows clients to receive and send events from/to the LAPLACE Event Bridge.

This package has zero external dependencies.

## Installation

```bash
# Using npm
npm install @laplace.live/event-bridge-sdk

# Using Yarn
yarn add @laplace.live/event-bridge-sdk

# Using Bun
bun add @laplace.live/event-bridge-sdk
```

## Usage

### Basic Usage

```typescript
import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

// Create a new client
const client = new LaplaceEventBridgeClient({
  url: 'ws://localhost:9696',
  token: 'your-auth-token', // Optional
  reconnect: true,
})

// Connect to the bridge
await client.connect()

client.on('message', event => {
  console.log(`${event.username}: ${event.message}`)
})

client.on('system', event => {
  console.log(`System: ${event.message}`)
})

// Listen for any event
client.onAny(event => {
  console.log(`Received event of type: ${event.type}`)
})

// Monitor connection state changes
client.onConnectionStateChange(state => {
  console.log(`Connection state changed to: ${state}`)

  // Handle different connection states
  switch (state) {
    case 'connected':
      console.log('Connected to the server!')
      break
    case 'reconnecting':
      console.log('Attempting to reconnect...')
      break
    case 'disconnected':
      console.log('Disconnected from the server')
      break
    case 'connecting':
      console.log('Establishing connection...')
      break
  }
})

// Disconnect when done
client.disconnect()
```

### Connection Options

```typescript
interface ConnectionOptions {
  url?: string // WebSocket URL, default: 'ws://localhost:9696'
  token?: string // Authentication token, default: ''
  reconnect?: boolean // Auto reconnect on disconnect, default: true
  reconnectInterval?: number // Milliseconds between reconnect attempts, default: 3000
  maxReconnectAttempts?: number // Maximum reconnect attempts, default: 1000
}
```

### Connection States

The SDK provides a `ConnectionState` enum that represents the current state of the connection:

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
}
```

### API Reference

#### Methods

- `connect()`: Connect to the event bridge. Returns a Promise that resolves when connected.
- `disconnect()`: Disconnect from the event bridge.
- `on(eventType, handler)`: Register an event handler for a specific event type with automatic type inference. Returns an unsubscribe function.
- `onAny(handler)`: Register a handler for all events. Returns an unsubscribe function.
- `onConnectionStateChange(handler)`: Register a handler for connection state changes. Returns an unsubscribe function.
- `off(eventType, handler)`: Remove an event handler for a specific event type.
- `offAny(handler)`: Remove a handler for all events.
- `offConnectionStateChange(handler)`: Remove a connection state change handler.
- `isConnectedToBridge()`: Check if the client is connected to the bridge. (Deprecated: use `getConnectionState()` instead)
- `getConnectionState()`: Get the current connection state.
- `getClientId()`: Get the client ID assigned by the bridge.
- `getInfo(signal?)`: Fetch `/info` (configured rooms + instance metadata) from a LAPLACE Event Fetcher, using the client's url/token. No active connection required. Resolves to `null` when discovery is unsupported.
- `send(event)`: Send an event to the bridge.

## Room Discovery

When the server is a [LAPLACE Event Fetcher](https://subspace.institute/docs/laplace-chat/event-fetcher) in bridge mode, it exposes a `/info` HTTP endpoint listing the configured rooms. The SDK can fetch it without an active WebSocket connection — useful for letting users pick which rooms to receive.

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

Both resolve to `null` (never throw) when `/info` is unavailable — an old fetcher, a plain Event Bridge server, an aborted request, or any network/parse error — so callers can silently fall back to manual room entry.

The returned shapes are `FetcherInfo` and `FetcherRoom`. Both are exported from the SDK, so import them directly rather than redeclaring your own:

```typescript
import type { FetcherInfo, FetcherRoom } from '@laplace.live/event-bridge-sdk'
```

## Type Inference

The SDK automatically infers the event type based on the event.type property. This means you don't need to use explicit type parameters or type guards when setting up event handlers.

For example:

```typescript
// This will infer that 'event' is of type 'Message'
client.on('message', event => {
  // TypeScript knows these properties exist
  console.log(event.username)
  console.log(event.message)
})

// This will infer that 'event' is of type 'Gift'
client.on('gift', event => {
  // TypeScript knows these properties exist
  console.log(event.giftName)
  console.log(event.giftCount)
})
```

## Event Types

Event types are imported from `@laplace.live/event-types` package. See the [documentation](https://chat.laplace.live/event-types) for available event types.

## License

MIT
