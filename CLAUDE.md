# CLAUDE.md

## Project Overview

LAPLACE Event Bridge is a WebSocket-based bridge system that connects LAPLACE Chat to multiple client applications. It enables real-time event streaming from Bilibili Live chat streams to various frontend frameworks and applications.

### Core Purpose

- **Bridge Server**: Acts as a relay between LAPLACE Chat dashboard and multiple connected clients
- **Event Distribution**: Broadcasts chat events (messages, gifts, subscriptions, etc.) from the streaming platform to all connected clients
- **Multi-Framework Support**: Provides examples for React, Vue, Svelte, Solid, and CLI applications

### Architecture

```
LAPLACE Chat (Server) → Event Bridge/LEF Bridge Mode → SDK → Client Applications
```

The system uses a role-based WebSocket connection where:

- LAPLACE Chat connects as a "server" role and broadcasts events
- Client applications connect as "client" role and receive events
- Only server-to-client broadcasting is supported (not client-to-client)

## Technology Stack

- **Runtime**: Bun (v1.2.0+) for JavaScript/TypeScript
- **Languages**: TypeScript (primary), Go (server implementation)
- **Package Manager**: Bun (workspace mode) / pnpm
- **Monorepo Structure**: Managed via workspaces
- **Event Types**: `@laplace.live/event-types` package

## Project Structure

```
laplace-event-bridge/
├── packages/           # Core packages
│   ├── sdk/           # TypeScript client SDK
│   ├── server/        # Go server (recommended)
│   └── server-bun/    # Bun server (deprecated)
└── examples/          # Framework examples
    ├── cli-demo/      # CLI example
    ├── react-demo/    # React example
    ├── solid-demo/    # Solid.js example
    ├── svelte-demo/   # Svelte example
    └── vue-demo/      # Vue example
```

## Key Components

### Event Bridge SDK (`packages/sdk/`)

The SDK provides a TypeScript client for connecting to the event bridge:

```typescript
import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

const client = new LaplaceEventBridgeClient({
  url: 'ws://localhost:9696',
  token: 'auth-token', // Optional authentication
  reconnect: true, // Auto-reconnect support
})
```

**Key Features:**

- Type-safe event handling with automatic inference
- Connection state management
- Automatic reconnection with backoff
- Event filtering by type

### Server Implementations

#### Go Server (`packages/server/`) - RECOMMENDED

- Single binary deployment
- High performance
- Minimal dependencies
- CLI flags for configuration

```bash
go run ./packages/server --auth "token" --host 0.0.0.0 --debug
```

#### Bun Server (`packages/server-bun/`) - DEPRECATED

- Original TypeScript implementation
- Kept for backward compatibility
- Uses Bun runtime

### Event Types

Events follow the `LaplaceEvent` interface from `@laplace.live/event-types`:

- `message` - Chat messages
- `gift` - Gift events
- `super-chat` - Super chat donations
- `guard` - Guard subscriptions
- `like` - Like interactions
- And many more...

## Development Guidelines

### Setting Up Development

```bash
# Install dependencies
bun install

# Run Go server (recommended)
go run ./packages/server --debug

# Or run Bun server
bun run --cwd packages/server-bun start --debug
```

### Working with the SDK

When modifying the SDK:

- Maintain backward compatibility
- Update TypeScript types in sync with event-types package
- Test with multiple framework examples
- Build before publishing: `bun run build:sdk`

### Adding New Event Types

1. Event types are defined in the external `@laplace.live/event-types` package
2. SDK automatically picks up new types via TypeScript inference
3. No SDK changes needed for new event types

### Creating New Examples

When adding a new framework example:

1. Create folder in `examples/`
2. Add to workspace in root `package.json`
3. Import SDK: `@laplace.live/event-bridge-sdk`
4. Follow existing patterns for event handling

### Code Conventions

- **TypeScript**: Use strict mode, explicit types for public APIs
- **Imports**: Prefer named imports, use type imports where applicable
- **Async/Await**: Use for all async operations
- **Error Handling**: Always handle WebSocket errors gracefully
- **Logging**: Use console.log for client apps, structured logging for servers

### Authentication

- Token passed via WebSocket subprotocol
- Format: `role, token` (e.g., `laplace-event-bridge-role-client, mytoken`)
- Server validates token before accepting connections

### Testing Approach

Currently no automated tests. When testing:

1. Start server with `--debug` flag
2. Connect LAPLACE Chat dashboard as server
3. Connect example clients
4. Verify event flow from dashboard → server → clients

### Building & Publishing

```bash
# Build SDK
bun run build:sdk

# Publish SDK (requires npm access)
bun run publish:sdk

# Build Go server
cd packages/server && go build
```

## Common Patterns

### Client Connection Pattern

```typescript
const client = new LaplaceEventBridgeClient(options)
await client.connect()

client.on('message', event => {
  // Handle specific event type
})

client.onAny(event => {
  // Handle all events
})

client.onConnectionStateChange(state => {
  // Handle connection states
})
```

### Store Integration Pattern

Most examples use a store (Zustand, Pinia, etc.) to manage events:

```typescript
client.onAny(event => {
  store.addMessage(event)
})
```

### onnection State UI Pattern

Examples typically show connection status:

- Green: Connected
- Yellow: Connecting/Reconnecting
- Red: Disconnected

## Important Notes

1. **No Client-to-Client Communication**: The bridge only supports server-to-client broadcasting
2. **Single Server Connection**: Only one LAPLACE Chat instance should connect as server
3. **Event Source**: All events originate from LAPLACE Chat, not from clients
4. **WebSocket Protocol**: Uses standard WebSocket with optional subprotocol for auth
5. **Bun Runtime**: Required for TypeScript packages, not for Go server

## Debugging Tips

1. Enable debug mode on server: `--debug`
2. Check browser DevTools for WebSocket frames
3. Verify authentication token matches
4. Ensure LAPLACE Chat is connected as server role
5. Monitor connection state changes in client

## Future Considerations

- The Bun server is deprecated; use Go server for production
- Event types may expand based on platform updates
- Consider implementing client-to-server events if needed
- May add built-in persistence layer for event history
