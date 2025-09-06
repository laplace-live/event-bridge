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

- [Bun](https://bun.com/) v1.2.0 or higher (required for managing the monorepo and running the SDK / Bun server)
- [Go](https://golang.org/) 1.20 or higher (only if you want to build/run the Go server from source)

## Installation

You can run the server in different methods:

- Pre-compiled binaries (easiest for non-technical users)
- Go server (easy to deploy, recommended)
- `laplace-event-fetcher` bridge mode (recommended for stability)
- Bun server (deprecated, only for reference)
- Source code (for advanced users and developers)

### Pre-compiled Binaries

If you're not familiar with programming or command-line tools, the easiest way to run the LAPLACE Event Bridge server is to download a pre-compiled binary from our GitHub releases:

1. **Download the server**
   - Go to the [GitHub Releases page](https://github.com/laplace-live/event-bridge/releases)
   - Find the latest release with `@laplace.live/event-bridge-server` in the name
   - Download the appropriate file for your operating system:
     - **Windows**: `leb-server-windows-amd64.exe`
     - **macOS**: `leb-server-darwin-arm64`
     - **Linux**: `leb-server-linux-amd64`

2. **Make it executable (macOS/Linux only):**
   - Open Terminal
   - Navigate to your Downloads folder: `cd ~/Downloads`
   - Run: `chmod +x leb-server-*` (replace \* with your actual filename)

3. **Run the server:**
   - **Windows**: Double-click the `.exe` file
   - **macOS/Linux**: In Terminal, run: `./leb-server-darwin-arm64` (replace with your actual filename)

The server will start and display a message when it's ready to accept connections.

### Bridge Server (Go)

The recommended bridge server is now a single-binary Go application located in `packages/server`. Building or running it does **not** require Bun – only the Go tool-chain.

For full documentation see `packages/server/README.md`, but a quick start looks like this:

```bash
# Run from source (requires Go installed)
go run ./packages/server --debug

# Or build a native binary
cd packages/server
go build -o leb-server .
./leb-server --host 0.0.0.0 --auth "your-secure-token"
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

## Development

### SDK Release Process

The SDK (`@laplace.live/event-bridge-sdk`) follows a structured release process using changesets for version management.

1. **Make your changes** to the SDK in `packages/sdk/`

2. **Create a changeset** to document your changes:

   ```bash
   bunx @changesets/cli
   ```

   - Select `@laplace.live/event-bridge-sdk` from the package list
   - Choose the appropriate version bump (patch/minor/major)
   - Write a clear description of the changes

3. **Commit your changes** including the generated changeset file:

   ```bash
   git add .
   git commit -m "feat(sdk): your change description"
   ```

## License

AGPL and MIT
