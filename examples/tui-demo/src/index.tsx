#!/usr/bin/env bun
import { ConnectionState, LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'
import type { LaplaceEvent } from '@laplace.live/event-types'
import {
  ConsolePosition,
  createCliRenderer,
  fg,
  type KeyEvent,
  type MouseEvent,
  TextAttributes,
  t,
} from '@opentui/core'
import { createRoot } from '@opentui/react'
import { useCallback, useEffect, useState } from 'react'

// ============================================================================
// Argument parsing (no external libs)
// ============================================================================

interface CliOptions {
  url: string
  token: string
  reconnect: boolean
  interval: number
  attempts: number
  help: boolean
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    url: 'ws://localhost:9696',
    token: 'laplace',
    reconnect: true,
    interval: 3000,
    attempts: 10,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    switch (arg) {
      case '-u':
      case '--url':
        if (nextArg) {
          options.url = nextArg
          i++
        }
        break
      case '-t':
      case '--token':
        if (nextArg) {
          options.token = nextArg
          i++
        }
        break
      case '-r':
      case '--reconnect':
        options.reconnect = true
        break
      case '--no-reconnect':
        options.reconnect = false
        break
      case '-i':
      case '--interval':
        if (nextArg) {
          options.interval = parseInt(nextArg, 10)
          i++
        }
        break
      case '-a':
      case '--attempts':
        if (nextArg) {
          options.attempts = parseInt(nextArg, 10)
          i++
        }
        break
      case '-h':
      case '--help':
        options.help = true
        break
    }
  }

  return options
}

function showHelp() {
  console.log(`
LAPLACE Event Bridge TUI

Usage: bun run src/index.tsx [options]

Options:
  -u, --url <url>         WebSocket URL (default: ws://localhost:9696)
  -t, --token <token>     Authentication token (default: laplace)
  -r, --reconnect         Enable auto-reconnect (default: true)
  --no-reconnect          Disable auto-reconnect
  -i, --interval <ms>     Reconnect interval in ms (default: 3000)
  -a, --attempts <n>      Max reconnect attempts (default: 10)
  -h, --help              Show this help message
`)
  process.exit(0)
}

// Parse arguments (skip first two: bun and script path)
const options = parseArgs(process.argv.slice(2))

if (options.help) {
  showHelp()
}

// ============================================================================
// Event formatting helpers
// ============================================================================

interface FormattedEvent {
  id: string
  timestamp: number
  lines: string[]
  type: string
  guardType?: number // 0=none, 1=Governor, 2=Admiral, 3=Captain
}

function formatTimestamp(ts?: number): string {
  const now = ts ? new Date(ts) : new Date()
  return `[${now.toLocaleTimeString()}]`
}

// Extended event type to include internal events like 'established'
interface EstablishedEvent {
  type: 'established'
  clientId: string
  version: string
}

type ExtendedEvent = LaplaceEvent | EstablishedEvent

function formatEvent(event: ExtendedEvent): FormattedEvent {
  const timestamp = 'timestampNormalized' in event ? event.timestampNormalized : Date.now()
  const id = 'id' in event ? String(event.id) : `${event.type}-${timestamp}`

  const lines: string[] = []
  let guardType: number | undefined

  // Handle established event first (internal event type)
  if (event.type === 'established') {
    const est = event as EstablishedEvent
    lines.push(`${formatTimestamp()} [Connected] Client ID: ${est.clientId}, Server v${est.version}`)
    return { id, timestamp, lines, type: event.type }
  }

  // Cast to LaplaceEvent for type safety
  const laplaceEvent = event as LaplaceEvent

  switch (laplaceEvent.type) {
    case 'message':
      guardType = laplaceEvent.guardType
      lines.push(
        `${formatTimestamp(timestamp)} [${laplaceEvent.origin}] ${laplaceEvent.username}: ${laplaceEvent.message}`
      )
      break

    case 'interaction': {
      const actionMap: { [key: number]: string } = {
        1: 'entered the room',
        2: 'followed',
        3: 'shared',
        4: 'special followed',
        5: 'mutual followed',
      }
      lines.push(
        `${formatTimestamp(timestamp)} ${laplaceEvent.username} ${actionMap[laplaceEvent.action] || `action ${laplaceEvent.action}`}`
      )
      break
    }

    case 'superchat':
      guardType = laplaceEvent.guardType
      lines.push(
        `${formatTimestamp(timestamp)} [SC ¥${laplaceEvent.priceNormalized}] ${laplaceEvent.username}: ${laplaceEvent.message}`
      )
      break

    case 'gift':
      lines.push(
        `${formatTimestamp(timestamp)} [Gift ¥${laplaceEvent.priceNormalized}] ${laplaceEvent.username}: ${laplaceEvent.message}`
      )
      break

    case 'entry-effect':
      guardType = laplaceEvent.guardType
      lines.push(`${formatTimestamp(timestamp)} [Entry] ${laplaceEvent.message}`)
      break

    case 'system':
      lines.push(`${formatTimestamp(timestamp)} [System] ${laplaceEvent.message}`)
      break

    default:
      // Skip unknown event types or show minimal info
      return { id, timestamp, lines: [], type: laplaceEvent.type }
  }

  return { id, timestamp, lines, type: laplaceEvent.type, guardType }
}

// ============================================================================
// Main App Component
// ============================================================================

interface AppProps {
  client: LaplaceEventBridgeClient
  options: CliOptions
  renderer: Awaited<ReturnType<typeof createCliRenderer>>
}

function App({ client, renderer }: AppProps) {
  const [events, setEvents] = useState<FormattedEvent[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [, setShowLogs] = useState(false)

  // Calculate visible area
  const visibleHeight = renderer.height - 6 // Account for header and footer
  const maxEvents = 1000 // Keep last N events

  // Calculate total content height
  const totalLines = events.reduce((sum, e) => sum + e.lines.length, 0)
  const maxScroll = Math.max(0, totalLines - visibleHeight)

  // Subscribe to events
  useEffect(() => {
    const handleEvent = (event: LaplaceEvent) => {
      const formatted = formatEvent(event)
      // Skip events with no displayable lines (unknown types)
      if (formatted.lines.length === 0) return

      setEvents(prev => {
        const newEvents = [...prev, formatted]
        // Keep only last maxEvents
        if (newEvents.length > maxEvents) {
          return newEvents.slice(-maxEvents)
        }
        return newEvents
      })
    }

    const handleStateChange = (state: ConnectionState) => {
      setConnectionState(state)
    }

    client.onAny(handleEvent)
    client.onConnectionStateChange(handleStateChange)

    // Connect
    client.connect().catch(err => {
      console.error('Failed to connect:', err)
    })

    return () => {
      client.offAny(handleEvent)
      client.offConnectionStateChange(handleStateChange)
    }
  }, [client])

  // Auto-scroll when new events arrive (maxScroll changes when events change)
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxScroll)
    }
  }, [autoScroll, maxScroll])

  // Keyboard handling
  useEffect(() => {
    const handleKeypress = (key: KeyEvent) => {
      // Toggle logs with 'l' key
      if (key.name === 'l') {
        setShowLogs(prev => !prev)
        renderer.console.toggle()
        return
      }

      // Scroll with arrow keys or j/k
      if (key.name === 'up' || key.name === 'k') {
        setAutoScroll(false)
        setScrollOffset(prev => Math.max(0, prev - 1))
        return
      }

      if (key.name === 'down' || key.name === 'j') {
        setScrollOffset(prev => {
          const newOffset = Math.min(maxScroll, prev + 1)
          // Re-enable auto-scroll if at bottom
          if (newOffset >= maxScroll) {
            setAutoScroll(true)
          }
          return newOffset
        })
        return
      }

      // Page up/down
      if (key.name === 'pageup') {
        setAutoScroll(false)
        setScrollOffset(prev => Math.max(0, prev - visibleHeight))
        return
      }

      if (key.name === 'pagedown') {
        setScrollOffset(prev => {
          const newOffset = Math.min(maxScroll, prev + visibleHeight)
          if (newOffset >= maxScroll) {
            setAutoScroll(true)
          }
          return newOffset
        })
        return
      }

      // Home/End
      if (key.name === 'home') {
        setAutoScroll(false)
        setScrollOffset(0)
        return
      }

      if (key.name === 'end') {
        setAutoScroll(true)
        setScrollOffset(maxScroll)
        return
      }

      // Quit with q or Ctrl+C
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        client.disconnect()
        process.exit(0)
      }
    }

    renderer.keyInput.on('keypress', handleKeypress)

    return () => {
      renderer.keyInput.off('keypress', handleKeypress)
    }
  }, [renderer, client, maxScroll, visibleHeight])

  // Mouse scroll handler for the main content area
  const handleMouseScroll = useCallback(
    (event: MouseEvent) => {
      if (event.scroll) {
        const delta = event.scroll.delta || 1
        if (event.scroll.direction === 'up') {
          setAutoScroll(false)
          setScrollOffset(prev => Math.max(0, prev - delta * 3))
        } else if (event.scroll.direction === 'down') {
          setScrollOffset(prev => {
            const newOffset = Math.min(maxScroll, prev + delta * 3)
            if (newOffset >= maxScroll) {
              setAutoScroll(true)
            }
            return newOffset
          })
        }
      }
    },
    [maxScroll]
  )

  // Get visible lines
  const getVisibleContent = useCallback(() => {
    const allLines: { text: string; type: string; guardType?: number }[] = []

    for (const event of events) {
      for (const line of event.lines) {
        allLines.push({ text: line, type: event.type, guardType: event.guardType })
      }
    }

    // Apply scroll offset
    const startIdx = Math.max(0, scrollOffset)
    const endIdx = Math.min(allLines.length, startIdx + visibleHeight)

    return allLines.slice(startIdx, endIdx)
  }, [events, scrollOffset, visibleHeight])

  const visibleLines = getVisibleContent()

  // Connection state color
  const getStateColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return '#00FF00'
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return '#FFFF00'
      case ConnectionState.DISCONNECTED:
        return '#FF0000'
      default:
        return '#888888'
    }
  }

  // Event type color based on type and guard level
  // Guard levels: 0=none, 1=Governor(总督), 2=Admiral(提督), 3=Captain(舰长)
  const getTypeColor = (type: string, guardType?: number) => {
    switch (type) {
      case 'message':
        // Color based on guard level (1 is highest)
        switch (guardType) {
          case 1: // Governor (总督) - highest tier, gold/red
            return '#FF4444'
          case 2: // Admiral (提督) - purple
            return '#AA44FF'
          case 3: // Captain (舰长) - blue
            return '#4488FF'
          default: // No guard - neutral gray for visibility on both themes
            return '#888888'
        }
      case 'interaction':
        return '#666666'
      case 'superchat':
        return '#FFD700'
      case 'gift':
        return '#FF69B4'
      case 'entry-effect':
        return '#00BFFF'
      case 'system':
      case 'established':
        return '#00CC00'
      default:
        return '#888888'
    }
  }

  return (
    <box flexDirection='column' width='100%' height='100%'>
      {/* Header */}
      <box
        borderStyle='single'
        borderColor='#4444FF'
        paddingLeft={1}
        paddingRight={1}
        flexDirection='row'
        justifyContent='space-between'
        width='100%'
      >
        <text content={t`LAPLACE Event Bridge TUI`} fg='#4488FF' attributes={TextAttributes.BOLD} />
        <text content={t`${fg(getStateColor())(connectionState.toUpperCase())}`} />
      </box>

      {/* Main content area */}
      <box
        borderStyle='single'
        borderColor='#333333'
        flexGrow={1}
        flexDirection='column'
        width='100%'
        overflow='hidden'
        onMouseScroll={handleMouseScroll}
      >
        {visibleLines.length === 0 ? (
          <text content='Waiting for events...' fg='#666666' />
        ) : (
          visibleLines.map((line, idx) => (
            <text key={`line-${scrollOffset + idx}`} content={line.text} fg={getTypeColor(line.type, line.guardType)} />
          ))
        )}
      </box>

      {/* Footer / Status bar */}
      <box
        borderStyle='single'
        borderColor='#333333'
        paddingLeft={1}
        paddingRight={1}
        flexDirection='row'
        justifyContent='space-between'
        width='100%'
      >
        <text content={t`Events: ${events.length} | Lines: ${totalLines}`} fg='#888888' />
        <text
          content={t`${autoScroll ? fg('#00FF00')('AUTO-SCROLL') : fg('#888888')(`Scroll: ${scrollOffset}/${maxScroll}`)}`}
        />
        <text content={t`[↑↓/jk] Scroll [PgUp/Dn] Page [Home/End] Jump [L] Logs [Q] Quit`} fg='#666666' />
      </box>
    </box>
  )
}

// ============================================================================
// Main entry point
// ============================================================================

async function main() {
  // Create renderer with console support and mouse enabled
  const renderer = await createCliRenderer({
    useMouse: true,
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 30,
      colorInfo: '#00FFFF',
      colorWarn: '#FFFF00',
      colorError: '#FF0000',
      startInDebugMode: false,
    },
  })

  // Log startup info
  console.log('LAPLACE Event Bridge TUI')
  console.log('========================')
  console.log(`Connecting to: ${options.url}`)
  console.log(`Token: ${options.token ? '***' : 'none'}`)
  console.log(`Reconnect: ${options.reconnect}`)
  console.log(`Interval: ${options.interval}ms`)
  console.log(`Max attempts: ${options.attempts}`)

  // Create the event bridge client
  const client = new LaplaceEventBridgeClient({
    url: options.url,
    token: options.token,
    reconnect: options.reconnect,
    reconnectInterval: options.interval,
    maxReconnectAttempts: options.attempts,
  })

  // Handle process exit
  process.on('SIGINT', () => {
    console.log('Shutting down...')
    client.disconnect()
    renderer.stop()
    process.exit(0)
  })

  // Start renderer and mount app
  renderer.start()
  createRoot(renderer).render(<App client={client} options={options} renderer={renderer} />)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
