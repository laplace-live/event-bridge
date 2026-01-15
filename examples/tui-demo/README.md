# LAPLACE Event Bridge TUI Demo

A terminal user interface for viewing LAPLACE Event Bridge events in real-time using [OpenTUI](https://github.com/anomalyco/opentui).

## Features

- Real-time event streaming from LAPLACE Event Bridge
- Scrollable event list with keyboard and mouse support
- Auto-scroll with visual indicator when at the bottom
- Toggleable debug console/logs
- Command-line argument parsing (no external libraries)
- Color-coded event types

## Installation

```bash
bun install
```

## Usage

```bash
# Start with default settings
bun run dev

# Connect to a specific server
bun run dev -- --url wss://event-fetcher.laplace.cn/?token=laplace

# All available options
bun run dev -- --help
```

## Command-Line Options

| Option            | Short | Description              | Default               |
| ----------------- | ----- | ------------------------ | --------------------- |
| `--url <url>`     | `-u`  | WebSocket URL            | `ws://localhost:9696` |
| `--token <token>` | `-t`  | Authentication token     | `laplace`             |
| `--reconnect`     | `-r`  | Enable auto-reconnect    | `true`                |
| `--no-reconnect`  |       | Disable auto-reconnect   |                       |
| `--interval <ms>` | `-i`  | Reconnect interval in ms | `3000`                |
| `--attempts <n>`  | `-a`  | Max reconnect attempts   | `10`                  |
| `--help`          | `-h`  | Show help message        |                       |

## Keyboard Shortcuts

| Key            | Action                              |
| -------------- | ----------------------------------- |
| `↑` / `k`      | Scroll up                           |
| `↓` / `j`      | Scroll down                         |
| `Page Up`      | Scroll up one page                  |
| `Page Down`    | Scroll down one page                |
| `Home`         | Jump to top                         |
| `End`          | Jump to bottom (enable auto-scroll) |
| `L`            | Toggle debug logs/console           |
| `Q` / `Ctrl+C` | Quit                                |

## Mouse Support

- **Scroll wheel up**: Scroll up (disables auto-scroll)
- **Scroll wheel down**: Scroll down (re-enables auto-scroll when at bottom)

## Event Types

The TUI displays events with color-coded indicators:

- **White**: Chat messages
- **Gray**: Interactions (follows, enters, etc.)
- **Gold**: Super chats
- **Pink**: Gifts
- **Cyan**: Entry effects
- **Green**: System messages and connection status

## Auto-Scroll Indicator

When scrolling manually, the status bar shows the current scroll position. When you scroll to the bottom (or press `End`), auto-scroll is re-enabled and the status bar shows a green "AUTO-SCROLL" indicator.

## Built With

- [OpenTUI](https://github.com/anomalyco/opentui) - Terminal UI framework
- [Bun](https://bun.sh) - JavaScript runtime
- [React](https://react.dev) - UI library (via @opentui/react)
