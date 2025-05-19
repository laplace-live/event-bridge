# LAPLACE Event Bridge Server (Deprecated)

A specialized WebSocket bridge server that connects LAPLACE Chat to clients.

## Features

- Acts as a bridge between LAPLACE Chat and clients
- Server-to-clients message broadcasting
- Role-based connection system
- Token-based authentication

## Use Cases

The event bridge enables various use cases:

- Integrate user message events directly with Discord
- Create custom chat layouts in your favorite frontend languages to display chat messages
- Create custom interactions with chat messages in VTube Studio
- Connect to streamer.bot, SAMMI, or other 3rd party services for advanced automation and integrations

## Requirements

- [Bun](https://bun.sh/) v1.0.0 or higher

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/laplace-live/event-bridge
cd event-bridge

# Install dependencies
bun install
```

## Configuration

### Authentication

You can set authentication in order of precedence:

1. Environment variable: `LEB_AUTH="your-secure-token"`
2. Command line: `--auth "your-secure-token"`

```bash
# Example using environment variable
export LEB_AUTH="your-secure-token"

# Example using CLI
bun run start --auth "your-secure-token"
```

If the authentication token is set, all connections including the clients must provide it to connect.

### Network Interface

Control which network interface the server listens on:

1. Environment variable: `HOST="127.0.0.1"`
2. Command line: `--host 127.0.0.1`

```bash
# Listen only on localhost
export HOST="localhost"

# Listen on all interfaces
bun run start --host 0.0.0.0
```

By default, the server listens on `localhost`.

### Debug Mode

Enable detailed debug logging using:

1. Environment variable: `DEBUG=1` or `DEBUG=true`
2. Command line: `--debug`

```bash
# Enable debug mode using environment variable
export DEBUG=1

# Enable debug mode using CLI
bun run start --debug
```

## Usage

### Start the Bridge Server

```bash
# Start the server
bun run start

# Start with CLI options
bun run start --debug --auth "your-secure-token" --host 0.0.0.0

# Or with hot reloading during development
bun run dev
```

The WebSocket bridge server runs on `http://localhost:9696` by default.

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
