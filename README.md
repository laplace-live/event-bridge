# LAPLACE Event Bridge

A WebSocket bridge connecting LAPLACE Chat to clients

## Monorepo Structure

This repository contains multiple packages:

- **Server (Go)** (`packages/server`): Standalone Go implementation of the WebSocket bridge (recommended)
- **Server (Bun, deprecated)** (`packages/server-bun`): Original Bun/Node.js implementation kept for reference
- **SDK** (`packages/sdk`): TypeScript/JavaScript client for connecting to the bridge
- **Examples** (`examples/`): Usage examples for the SDK

## Features

- Role-based connection system (server/client)
- Server-to-clients message broadcasting
- Token-based authentication
- Reconnection support

## Requirements

- [Bun](https://bun.sh/) v1.2.0 or higher (required for managing the monorepo and running the SDK / Bun server)
- [Go](https://golang.org/) 1.20 or higher (only if you want to build/run the Go server from source)

## Installation

```bash
# Clone the repository
git clone https://github.com/laplace-live/event-bridge
cd event-bridge

# Install dependencies for all packages
bun install
```

## Server Package (Go)

The recommended bridge server is now a single-binary Go application located in `packages/server`. Building or running it does **not** require Bun – only the Go tool-chain.

For full documentation see `packages/server/README.md`, but a quick start looks like this:

```bash
# Run from source (requires Go installed)
go run ./packages/server --debug

# Or build a native binary
cd packages/server
go build -o leb-server .
./leb-server --auth "your-secure-token" --host 0.0.0.0
```

The server listens on `http://localhost:9696` by default.

---

## Server Package (Bun, deprecated)

The original Bun/Node.js implementation lives in `packages/server-bun`. It is feature-equivalent but has been superseded by the Go version for performance and deployment simplicity. It is still shipped for anyone relying on it.

```bash
# Start the Bun server
bun run --cwd packages/server-bun start --debug --auth "your-secure-token"
```

All configuration flags and WebSocket protocols are identical between the two servers.

## Event Fetcher Bridge Mode

In the latest version of [laplace-event-fetcher](https://subspace.institute/docs/laplace-chat/event-fetcher) (v2.2.0 and above), you can enable the WebSocket bridge mode to run the event fetcher as a bridge server for better stability.

## SDK Package

The SDK provides a client for connecting to the event bridge.

### Installation

```bash
# Install from npm
bun add @laplace.live/event-bridge-sdk
```

### Usage

```typescript
import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

const client = new LaplaceEventBridgeClient({
  url: 'ws://localhost:9696',
  token: 'your-auth-token', // If auth is enabled
})

// Connect to the bridge
await client.connect()

// Listen for specific events
client.on('message', event => {
  console.log('Received message:', event)
})

// Listen for all events
client.onAny(event => {
  console.log('Received event:', event.type)
})
```

## `LaplaceEvent`

`LaplaceEvent` is the core type of the event bridge system, representing events exchanged between LAPLACE Chat and connected clients. Each event contains standardized data for various chat streams from Bilibili Live.

All events share a common `type` field that identifies the event category and additional fields specific to each event type.

You can read more about the event types in the [Event Types documentation](https://chat.laplace.live/event-types/).

## Use Cases

- Integrate with Discord, OBS, VTube Studio
- Create custom chat layouts in your preferred frontend
- Connect to 3rd party services like streamer.bot or SAMMI
- ...any other use case you can think of

## License

AGPL and MIT
