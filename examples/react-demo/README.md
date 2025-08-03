# LAPLACE Event Bridge React Demo

A real-time event streaming demo application built with React, Bun, and the LAPLACE Event Bridge SDK. This application demonstrates how to connect to the LAPLACE Event Bridge service to receive and display livestream events.

## Features

- 🚀 Built with Bun runtime for fast performance
- ⚛️ React 19 with TypeScript
- 🎨 Tailwind CSS for styling
- 🔄 Real-time event streaming via WebSocket
- 📦 State management with Zustand
- 🎯 Automatic reconnection handling
- 💫 Smooth animations with Motion library

## Prerequisites

- [Bun](https://bun.sh) v1.2.10 or later

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

## Build

Build the application for deployment:

```bash
bun run build
```

The build script supports various options:

- `--outdir <path>` - Output directory (default: "dist")
- `--minify` - Enable minification
- `--sourcemap <type>` - Sourcemap type (none|linked|inline|external)
- `--help` - Show all available options

## Development Notes

- The project uses Bun's HTML imports feature instead of traditional bundlers
- Tailwind CSS is integrated via `bun-plugin-tailwind`

## License

AGPL-3.0
