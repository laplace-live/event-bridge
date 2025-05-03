# LAPLACE Event Bridge

A WebSocket bridge connecting LAPLACE Chat to clients

## Monorepo Structure

This repository contains two packages:

- **Server** (`packages/server`): WebSocket server that routes events between LAPLACE Chat and clients
- **SDK** (`packages/sdk`): TypeScript/JavaScript client for connecting to the bridge
- **Examples** (`examples/`): Examples of how to use the SDK

## Features

- Role-based connection system (server/client)
- Server-to-clients message broadcasting
- Token-based authentication
- Reconnection support

## Requirements

- [Bun](https://bun.sh/) v1.0.0 or higher

## Installation

```bash
# Clone the repository
git clone https://github.com/laplace-live/event-bridge
cd event-bridge

# Install dependencies for all packages
bun install
```

## Server Package

### Configuration

Set authentication via environment variable:

```bash
export LAPLACE_EVENT_BRIDGE_AUTH="your-secure-token"
```

### Usage

```bash
# Start the server in development mode
bun run dev:server

# Start the server in production mode
bun run start:server
```

The server runs on `http://localhost:9696`.

## SDK Package

The SDK provides a client for connecting to the event bridge.

### Installation

```bash
# Install from npm
bun add @laplace.live/event-bridge-sdk
```

### Usage

```typescript
import { LaplaceEventClient } from '@laplace.live/event-bridge-sdk'

const client = new LaplaceEventClient({
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

## Use Cases

- Integrate with Discord, OBS, VTube Studio
- Create custom chat layouts in your preferred frontend
- Connect to 3rd party services like streamer.bot or SAMMI
- ...any other use case you can think of

## License

AGPL
