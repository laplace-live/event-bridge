# LAPLACE Event Bridge

A specialized WebSocket bridge server that connects LAPLACE Chat to clients.

## Features

- Acts as a bridge between LAPLACE Chat and clients
- Server-to-clients message broadcasting
- Role-based connection system
- Token-based authentication

## Use Cases

The event bridge enables various use cases:

- Integrate user message events directly with Discord
- Create custom danmakus layouts in your favorite frontend languages to display chat messages
- Create custom interactions with chat messages in VTube Studio
- Connect to streamer.bot, SAMMI, or other 3rd party services for advanced automation and integrations

## Requirements

- [Bun](https://bun.sh/) v1.0.0 or higher

## Installation

```bash
# Clone the repository
git clone https://github.com/laplace-live/event-bridge
cd event-bridge

# Install dependencies
bun install
```

## Configuration

The bridge supports authentication via an environment variable:

```bash
# Set authentication token (optional but recommended)
export LAPLACE_EVENT_BRIDGE_AUTH="your-secure-token"
```

If the authentication token is set, all connections including the clients must provide it to connect.

## Usage

### Start the Bridge Server

```bash
# Start the server
bun run start

# Or with hot reloading during development
bun run dev
```

The WebSocket bridge server runs on `http://localhost:9696`.

### Connection Types

The bridge supports two types of connections:

1. **LAPLACE Chat** - Connects with the special protocol `laplace-event-bridge-role-server` and broadcasts messages to all clients
2. **Clients** - Regular connections that receive broadcasts from the server

### Authentication

When authentication is enabled, clients must provide the auth token in the WebSocket protocol:

- For clients: `['laplace-event-bridge-role-client', 'your-auth-token']`

### Message Flow

- Messages from the LAPLACE Chat are broadcast to all connected clients
- Messages from clients are acknowledged but not relayed to other clients or the server

## Client Demo

A simple HTML client demo is included for testing (`client-demo.html`):

1. Open the file in your web browser
2. Configure connection settings (URL, authentication)
3. Connect to the bridge
4. Receive broadcasts from the LAPLACE Chat

## License

AGPL
