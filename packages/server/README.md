# LAPLACE Event Bridge Server

This package provides a standalone Go implementation of the [LAPLACE Event Bridge](../server) that was originally written for Bun / Node.js.

## Features

- Broadcast-driven WebSocket bridge identical to the original Bun implementation
- Role-based connections (`laplace-event-bridge-role-server` vs clients)
- Optional token-based authentication (env vars or CLI flags)
- Rich debug logging controllable via `DEBUG` flag / env
- Single, statically-linked binary (no external runtime); easy to deploy
- Cross-compilation script for **macOS**, **Linux**, and **Windows** (`amd64` and `arm64`) architectures

## Getting Started

```bash
# Navigate to the package
cd packages/server-go

# Run in development
go run . --debug

# Or compile native binary for your platform
go build -o leb-go
./leb-go --auth "my-secret" --host 0.0.0.0
```

### Flags & Environment Variables

| Purpose              | Env var(s)                                | CLI flag         | Default     |
| -------------------- | ----------------------------------------- | ---------------- | ----------- |
| Enable debug output  | `DEBUG=1` or `DEBUG=true`                 | `--debug`        | disabled    |
| Authentication token | `LEB_AUTH` or `LAPLACE_EVENT_BRIDGE_AUTH` | `--auth <token>` | none        |
| Network interface    | `HOST`                                    | `--host <ip>`    | `localhost` |
| Port                 | –                                         | `--port <port>`  | `9696`      |

## Cross-platform Build

A helper script is provided under `scripts/build`.

```bash
# From packages/server-go
./scripts/build
```

Resulting binaries will appear in `packages/server-go/dist` with names such as:

```
leb-go-darwin-arm64
leb-go-linux-amd64
leb-go-windows-amd64.exe
```

These binaries are fully static (`CGO_ENABLED=0`) and have **no runtime dependencies** other than the standard C library on Windows.

## License

AGPL-3.0
