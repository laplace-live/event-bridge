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

You can run the server in different methods:

- Go server (easy to deploy, recommended)
- `laplace-event-fetcher` bridge mode (recommended for stability)
- Bun server (deprecated, only for reference)
- Source code (for advanced users and developers)

### Bridge Server (Go)

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

### Event Fetcher Bridge Mode

In the latest version of [laplace-event-fetcher](https://subspace.institute/docs/laplace-chat/event-fetcher) (v2.2.0 and above), you can enable the WebSocket bridge mode to run the event fetcher as a bridge server for better stability. With this mode, you do not need to keep the LAPLACE Chat dashboard running as it will run as the event fetcher + bridge server for you.

### Bridge Server (Bun, deprecated)

The original Bun/Node.js implementation lives in `packages/server-bun`. It is feature-equivalent but has been superseded by the Go version for performance and deployment simplicity. It is still shipped for anyone relying on it.

```bash
# Start the Bun server
bun run --cwd packages/server-bun start --debug --auth "your-secure-token"
```

## Server Comparison

| Feature                    | Bridge Server (Go)                      | Event Fetcher Bridge Mode                                                               |
| -------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| **Installation**           | Single binary or Go toolchain           | Requires LAPLACE Event Fetcher v2.2.0+                                                  |
| **Environment**            | Local (standalone binary)               | Container                                                                               |
| **Deployment**             | Easy - single file deployment           | Needs server running                                                                    |
| **LAPLACE Chat Dashboard** | Required                                | Not required                                                                            |
| **Reuse Local Connection** | Yes                                     | No                                                                                      |
| **Configuration**          | Command-line flags                      | Event fetcher config                                                                    |
| **Stability**              | Depends on your local network           | Better stability                                                                        |
| **Best For**               | Hobby projects integration, small scale | Production ready and large scale for MCN agencies, or users already using event fetcher |

## SDK

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
