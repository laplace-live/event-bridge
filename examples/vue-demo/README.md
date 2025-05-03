# Vue.js Demo for LAPLACE Event Bridge

This is a simple Vue.js application that demonstrates how to use the LAPLACE Event Bridge SDK to receive messages from a LAPLACE Event Bridge server.

## Features

- Connect to a LAPLACE Event Bridge server
- Display incoming messages in real-time
- Handle connection status (connected/disconnected)

## Running the Demo

From the project root:

```bash
# Install dependencies
bun install

# Start the Vue demo
bun run dev:vue-demo
```

Or from this directory:

```bash
# Install dependencies
bun install

# Start the development server
bun run dev
```

## How It Works

This demo uses the LAPLACE Event Bridge SDK to connect to a WebSocket server and receive message events. It demonstrates:

1. Creating a client instance
2. Connecting to the event bridge server
3. Listening for 'message' events
4. Displaying received messages in the UI
5. Handling connection states

## Implementation Details

The main SDK implementation can be found in `src/App.vue`. Key parts include:

```typescript
// Initialize client
client.value = new LaplaceEventBridgeClient({
  url: connectionUrl.value,
  reconnect: true,
})

// Listen for message events
client.value.on('message', (event) => {
  messages.value.push(event)
  // Keep only latest 50 messages
  if (messages.value.length > 50) {
    messages.value = messages.value.slice(-50)
  }
})

// Connect to the bridge
await client.value.connect()
```
