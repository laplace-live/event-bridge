# LAPLACE Event Bridge SvelteKit Demo

This is a simple SvelteKit demo that connects to the LAPLACE Event Bridge and displays live chat messages and events.

## Features

- Connects to LAPLACE Event Bridge over WebSocket
- Displays different types of events (messages, superchats, gifts, etc.)
- Built with SvelteKit for efficient rendering and state management

## Getting Started

### Prerequisites

- Bun (package manager and runtime)
- LAPLACE Event Bridge server running

### Installation

1. Clone the repository
2. Navigate to the svelte-demo directory
3. Install dependencies:

```bash
bun install
```

### Running the Demo

1. Start the development server:

```bash
bun run dev
```

2. Open your browser and navigate to `http://localhost:5173`

### Building for Production

To build the application for production:

```bash
bun run build
```

## Configuration

The WebSocket connection is configured in `src/lib/services/eventBridge.ts`. By default, it connects to `ws://localhost:9696`. Change this URL to match your LAPLACE Event Bridge server address.
