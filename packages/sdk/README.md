# LAPLACE Event Bridge SDK

A framework agnostic SDK for connecting to the LAPLACE Event Bridge server. This SDK allows clients to receive and send events from/to the LAPLACE Event Bridge.

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
  maxReconnectAttempts?: number // Maximum reconnect attempts, default: 10
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
- `on(eventType, handler)`: Register an event handler for a specific event type with automatic type inference.
- `onAny(handler)`: Register a handler for all events.
- `onConnectionStateChange(handler)`: Register a handler for connection state changes.
- `off(eventType, handler)`: Remove an event handler for a specific event type.
- `offAny(handler)`: Remove a handler for all events.
- `offConnectionStateChange(handler)`: Remove a connection state change handler.
- `isConnectedToBridge()`: Check if the client is connected to the bridge. (Deprecated: use `getConnectionState()` instead)
- `getConnectionState()`: Get the current connection state.
- `getClientId()`: Get the client ID assigned by the bridge.
- `send(event)`: Send an event to the bridge.

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
