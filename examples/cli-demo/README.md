# LAPLACE Event Bridge CLI Demo

A command-line interface that demonstrates how to use the LAPLACE Event Bridge SDK to receive messages from a LAPLACE Event Bridge server.

## Features

- Connect to a LAPLACE Event Bridge server via WebSocket
- Display incoming messages in the terminal
- Color-coded output for better readability
- Command-line options for customizing the connection

## Installation

From the project root:

```bash
# Install dependencies
bun install
```

## Usage

From the project root:

```bash
# Run the CLI demo
bun run --cwd examples/cli-demo start
```

Or from this directory:

```bash
# Run the CLI demo
bun start
```

### Command Line Options

```
Options:
  -V, --version          output the version number
  -u, --url <url>        WebSocket URL (default: "ws://localhost:9696")
  -r, --reconnect        Enable auto-reconnect (default: true)
  -i, --interval <ms>    Reconnect interval in milliseconds (default: "3000")
  -a, --attempts <number> Maximum reconnect attempts (default: "10")
  -h, --help             display help for command
```

### Example

Connect to a custom WebSocket server:

```bash
bun start --url ws://example.com:9696
```

## How It Works

This demo uses the LAPLACE Event Bridge SDK to connect to a WebSocket server and receive message events. It demonstrates:

1. Creating a client instance
2. Connecting to the event bridge server
3. Listening for 'message' events
4. Displaying received messages in the terminal

## License

AGPL-3.0
