# LAPLACE Event Bridge React Demo

A real-time event streaming demo application built with React, Bun, and the LAPLACE Event Bridge SDK. This application demonstrates how to connect to the LAPLACE Event Bridge service to receive and display livestream events.

https://github.com/user-attachments/assets/92e07ddf-ec87-439f-a8b3-55c2407f36d4

## Features

- 🚀 Built with Bun runtime for fast performance
- ⚛️ React 19 with TypeScript
- 🎨 Tailwind CSS for styling
- 🔄 Real-time event streaming via WebSocket
- 📦 State management with Zustand
- 🎯 Automatic reconnection handling
- 💫 Smooth animations with Motion library

## Prerequisites

- [Bun](https://bun.com) v1.2.10 or later

## Installation

```bash
bun install
```

## Development

Start the development server with hot reload:

```bash
bun dev
```

The application will be available at http://localhost:4000

## Production

Run in production mode:

```bash
bun start
# or
NODE_ENV=production bun src/index.tsx
```

## Build (single-file executable)

Compile the demo into standalone single-file executables. Each binary embeds the
Bun runtime, the server, and the fully-bundled React SPA (HTML/JS/CSS) — no
`bun install`, `node_modules`, or separate assets are needed to run it.

```bash
bun run build
```

This produces one executable per target in `dist/`:

- `leb-react-demo-darwin-arm64` — macOS (Apple Silicon)
- `leb-react-demo-linux-x64` — Linux x64
- `leb-react-demo-linux-arm64` — Linux arm64
- `leb-react-demo-windows-x64.exe` — Windows x64

To build only specific targets, pass their keys (run with `--help` to list them):

```bash
bun run build.ts darwin-arm64            # just macOS arm64
bun run build.ts linux-x64 linux-arm64   # a couple of Linux targets
```

Run a binary directly; it serves the app on port 4000, or set `PORT` to override:

```bash
./dist/leb-react-demo-darwin-arm64
PORT=8080 ./dist/leb-react-demo-darwin-arm64
```

> The build uses Bun's `Bun.build()` JS API (see `build.ts`) rather than the
> `bun build --compile` CLI, because Tailwind (`bun-plugin-tailwind`) only runs
> for the embedded frontend build through the JS API.

## Development Notes

- The project uses Bun's HTML imports feature instead of traditional bundlers
- Tailwind CSS is integrated via `bun-plugin-tailwind`

## License

AGPL-3.0
