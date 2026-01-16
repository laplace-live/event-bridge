#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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

import {
  type CliOptions,
  DEFAULT_EVENT_FILTERS,
  type EstablishedEvent,
  type EventFilters,
  type ExtendedEvent,
  type FormattedEvent,
  type InfoResponse,
  type PersistedConfig,
  type RoomInfo,
  type RoomMaps,
} from './types'

// ============================================================================
// Config persistence
// ============================================================================

const CONFIG_DIR = join(homedir(), '.config', 'laplace-tui')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

/**
 * Load persisted config from disk
 */
function loadConfig(): PersistedConfig | null {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(data) as PersistedConfig
    }
  } catch (err) {
    console.warn('Failed to load config:', err)
  }
  return null
}

/**
 * Save config to disk
 */
function saveConfig(config: PersistedConfig): void {
  try {
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch (err) {
    console.warn('Failed to save config:', err)
  }
}

// ============================================================================
// Room info helpers
// ============================================================================

/**
 * Fetch room info from the /info endpoint
 * Converts WS URL to HTTP URL and fetches /info
 */
async function fetchRoomInfo(wsUrl: string): Promise<RoomMaps> {
  const roomMaps: RoomMaps = {
    byIdx: new Map(),
    byRoomId: new Map(),
  }

  try {
    // Convert ws:// or wss:// to http:// or https:// and strip token
    const url = new URL(wsUrl.replace(/^ws/, 'http'))
    url.searchParams.delete('token')
    url.pathname = `${url.pathname.replace(/\/$/, '')}/info`
    const httpUrl = url.toString()

    console.log(`Fetching room info from: ${httpUrl}`)

    const response = await fetch(httpUrl)
    if (!response.ok) {
      console.warn(`Failed to fetch room info: ${response.status} ${response.statusText}`)
      return roomMaps
    }

    const data = (await response.json()) as InfoResponse

    if (data.success && data.data?.rooms && Array.isArray(data.data.rooms)) {
      const rooms = data.data.rooms
      rooms.forEach((baseRoom, idx: number) => {
        const room = baseRoom as RoomInfo
        // API returns 'username' field for streamer name
        const streamerName = room.username
        if (streamerName) {
          // Map by array index (for originIdx lookup)
          roomMaps.byIdx.set(idx, streamerName)
          // Map by roomId (for origin lookup fallback)
          roomMaps.byRoomId.set(room.roomId, streamerName)
        }
      })
      console.log(`Loaded ${roomMaps.byIdx.size} room(s) info:`, [...roomMaps.byIdx.entries()])
    }
  } catch (err) {
    console.warn('Failed to fetch room info:', err)
  }

  return roomMaps
}

// ============================================================================
// Argument parsing (no external libs)
// ============================================================================

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    url: 'ws://localhost:9696',
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
  -t, --token <token>     Authentication token
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

function formatTimestamp(ts?: number): string {
  const now = ts ? new Date(ts) : new Date()
  return `[${now.toLocaleTimeString()}]`
}

function formatEvent(event: ExtendedEvent, roomMaps: RoomMaps): FormattedEvent {
  const timestamp = 'timestampNormalized' in event ? event.timestampNormalized : Date.now()
  const id = 'id' in event ? String(event.id) : `${event.type}-${timestamp}`

  const lines: string[] = []
  let guardType: number | undefined
  let originIdx: number | undefined

  // Handle established event first (internal event type)
  if (event.type === 'established') {
    const est = event as EstablishedEvent
    lines.push(`${formatTimestamp()} [Connected] Client ID: ${est.clientId}, Server v${est.version}`)
    return { id, timestamp, lines, type: event.type }
  }

  // Cast to LaplaceEvent for type safety
  const laplaceEvent = event as LaplaceEvent

  // Get originIdx and streamer name for events that have it
  if ('originIdx' in laplaceEvent) {
    originIdx = laplaceEvent.originIdx
  }

  // Get streamer name from room maps with fallback:
  // 1. Try originIdx (array index) first
  // 2. Try roomId (origin field) as fallback
  // 3. Fall back to showing the raw origin value
  const getStreamerPrefix = () => {
    // First try: lookup by originIdx (array index)
    if (originIdx !== undefined && roomMaps.byIdx.has(originIdx)) {
      return `[${roomMaps.byIdx.get(originIdx)}]`
    }
    // Second try: lookup by roomId (origin field)
    if ('origin' in laplaceEvent) {
      const origin = laplaceEvent.origin
      if (typeof origin === 'number' && roomMaps.byRoomId.has(origin)) {
        return `[${roomMaps.byRoomId.get(origin)}]`
      }
      // Fallback: show the raw origin value
      return `[${origin}]`
    }
    return ''
  }

  const streamerPrefix = getStreamerPrefix()

  switch (laplaceEvent.type) {
    case 'message':
      guardType = laplaceEvent.guardType
      lines.push(`${formatTimestamp(timestamp)} ${streamerPrefix} ${laplaceEvent.username}: ${laplaceEvent.message}`)
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
        `${formatTimestamp(timestamp)} ${streamerPrefix} ${laplaceEvent.username} ${actionMap[laplaceEvent.action] || `action ${laplaceEvent.action}`}`
      )
      break
    }

    case 'superchat':
      guardType = laplaceEvent.guardType
      lines.push(
        `${formatTimestamp(timestamp)} ${streamerPrefix} [SC ¥${laplaceEvent.priceNormalized}] ${laplaceEvent.username}: ${laplaceEvent.message}`
      )
      break

    case 'gift':
      lines.push(
        `${formatTimestamp(timestamp)} ${streamerPrefix} [Gift ¥${laplaceEvent.priceNormalized}] ${laplaceEvent.username}: ${laplaceEvent.message}`
      )
      break

    case 'entry-effect':
      guardType = laplaceEvent.guardType
      lines.push(`${formatTimestamp(timestamp)} ${streamerPrefix} [Entry] ${laplaceEvent.message}`)
      break

    case 'system':
      lines.push(`${formatTimestamp(timestamp)} ${streamerPrefix} [System] ${laplaceEvent.message}`)
      break

    default:
      // Skip unknown event types or show minimal info
      return { id, timestamp, lines: [], type: laplaceEvent.type }
  }

  return { id, timestamp, lines, type: laplaceEvent.type, guardType, originIdx }
}

// ============================================================================
// Main App Component
// ============================================================================

interface AppProps {
  client: LaplaceEventBridgeClient
  options: CliOptions
  renderer: Awaited<ReturnType<typeof createCliRenderer>>
  roomMaps: RoomMaps
  initialConfig: PersistedConfig | null
}

function App({ client, renderer, roomMaps, initialConfig }: AppProps) {
  const [events, setEvents] = useState<FormattedEvent[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [, setShowLogs] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // Initialize event filters from persisted config or defaults
  const [eventFilters, setEventFilters] = useState<EventFilters>(() => {
    return initialConfig?.eventFilters ?? DEFAULT_EVENT_FILTERS
  })

  const [configSelectedIdx, setConfigSelectedIdx] = useState(0)

  // Streamer filters: Set of enabled origin indices
  // Initialize from persisted config (disabled streamers stored by roomId)
  const [enabledStreamers, setEnabledStreamers] = useState<Set<number>>(() => {
    const allStreamers = new Set(roomMaps.byIdx.keys())
    if (initialConfig?.disabledStreamers) {
      // Convert disabled roomIds back to origin indices
      for (const roomId of initialConfig.disabledStreamers) {
        // Find the originIdx for this roomId
        for (const [idx, _name] of roomMaps.byIdx.entries()) {
          const storedRoomId = [...roomMaps.byRoomId.entries()].find(([, n]) => n === roomMaps.byIdx.get(idx))?.[0]
          if (storedRoomId === roomId) {
            allStreamers.delete(idx)
            break
          }
        }
      }
    }
    return allStreamers
  })

  // Save config when filters change
  useEffect(() => {
    // Convert disabled streamer indices to roomIds for persistence
    const disabledStreamers: number[] = []
    for (const [idx, _name] of roomMaps.byIdx.entries()) {
      if (!enabledStreamers.has(idx)) {
        // Find the roomId for this idx
        const roomId = [...roomMaps.byRoomId.entries()].find(([, n]) => n === roomMaps.byIdx.get(idx))?.[0]
        if (roomId !== undefined) {
          disabledStreamers.push(roomId)
        }
      }
    }

    const config: PersistedConfig = {
      eventFilters,
      disabledStreamers,
    }
    saveConfig(config)
  }, [eventFilters, enabledStreamers, roomMaps])

  // Calculate visible area
  const visibleHeight = renderer.height - 6 // Account for header and footer
  const maxEvents = 1000 // Keep last N events

  // Filter events based on event type configuration
  const shouldShowEventType = useCallback(
    (type: string): boolean => {
      switch (type) {
        case 'interaction':
          return eventFilters.showInteractions
        case 'message':
          return eventFilters.showMessages
        case 'superchat':
          return eventFilters.showSuperchats
        case 'gift':
          return eventFilters.showGifts
        case 'entry-effect':
          return eventFilters.showEntryEffects
        case 'system':
        case 'established':
          return eventFilters.showSystem
        default:
          return true
      }
    },
    [eventFilters]
  )

  // Filter events based on streamer (origin)
  const shouldShowStreamer = useCallback(
    (originIdx?: number): boolean => {
      // System events without origin are always shown
      if (originIdx === undefined) return true
      // Check if this streamer is enabled
      return enabledStreamers.has(originIdx)
    },
    [enabledStreamers]
  )

  // Get filtered events and calculate scroll bounds
  const filteredEvents = events.filter(e => shouldShowEventType(e.type) && shouldShowStreamer(e.originIdx))
  const filteredTotalLines = filteredEvents.reduce((sum, e) => sum + e.lines.length, 0)
  const maxScroll = Math.max(0, filteredTotalLines - visibleHeight)

  // Subscribe to events
  useEffect(() => {
    const handleEvent = (event: LaplaceEvent) => {
      const formatted = formatEvent(event, roomMaps)
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
  }, [client, roomMaps])

  // Auto-scroll when new events arrive (maxScroll changes when events change)
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxScroll)
    }
  }, [autoScroll, maxScroll])

  // Config filter options for keyboard navigation
  type ConfigOption =
    | { type: 'header'; label: string }
    | { type: 'eventFilter'; key: keyof EventFilters; label: string }
    | { type: 'streamer'; originIdx: number; label: string }

  const configOptions: ConfigOption[] = [
    { type: 'header', label: '── Event Types ──' },
    { type: 'eventFilter', key: 'showMessages', label: 'Messages' },
    { type: 'eventFilter', key: 'showInteractions', label: 'Interactions (enter/follow/share)' },
    { type: 'eventFilter', key: 'showSuperchats', label: 'Superchats' },
    { type: 'eventFilter', key: 'showGifts', label: 'Gifts' },
    { type: 'eventFilter', key: 'showEntryEffects', label: 'Entry Effects' },
    { type: 'eventFilter', key: 'showSystem', label: 'System Messages' },
    { type: 'header', label: '── Streamers ──' },
    // Add streamers from roomMaps
    ...Array.from(roomMaps.byIdx.entries()).map(([idx, name]) => ({
      type: 'streamer' as const,
      originIdx: idx,
      label: name,
    })),
  ]

  // Get only selectable options (non-headers) for navigation
  const selectableOptions = configOptions.filter(opt => opt.type !== 'header')

  // Toggle a specific event filter
  const toggleEventFilter = useCallback((key: keyof EventFilters) => {
    setEventFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Toggle a specific streamer
  const toggleStreamer = useCallback((originIdx: number) => {
    setEnabledStreamers(prev => {
      const next = new Set(prev)
      if (next.has(originIdx)) {
        next.delete(originIdx)
      } else {
        next.add(originIdx)
      }
      return next
    })
  }, [])

  // Keyboard handling
  useEffect(() => {
    const handleKeypress = (key: KeyEvent) => {
      // Toggle config with 'c' key
      if (key.name === 'c' && !showConfig) {
        setShowConfig(true)
        setConfigSelectedIdx(0)
        return
      }

      // Close config with Escape or 'c'
      if (showConfig && (key.name === 'escape' || key.name === 'c')) {
        setShowConfig(false)
        return
      }

      // Config dialog navigation
      if (showConfig) {
        if (key.name === 'up' || key.name === 'k') {
          setConfigSelectedIdx(prev => Math.max(0, prev - 1))
          return
        }
        if (key.name === 'down' || key.name === 'j') {
          setConfigSelectedIdx(prev => Math.min(selectableOptions.length - 1, prev + 1))
          return
        }
        if (key.name === 'space' || key.name === 'return') {
          const option = selectableOptions[configSelectedIdx]
          if (option) {
            if (option.type === 'eventFilter') {
              toggleEventFilter(option.key)
            } else if (option.type === 'streamer') {
              toggleStreamer(option.originIdx)
            }
          }
          return
        }
        // Block other keys when config is open
        return
      }

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
  }, [
    renderer,
    client,
    maxScroll,
    visibleHeight,
    showConfig,
    configSelectedIdx,
    selectableOptions,
    toggleEventFilter,
    toggleStreamer,
  ])

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

    for (const event of filteredEvents) {
      for (const line of event.lines) {
        allLines.push({ text: line, type: event.type, guardType: event.guardType })
      }
    }

    // Apply scroll offset
    const startIdx = Math.max(0, scrollOffset)
    const endIdx = Math.min(allLines.length, startIdx + visibleHeight)

    return allLines.slice(startIdx, endIdx)
  }, [filteredEvents, scrollOffset, visibleHeight])

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
        <text
          content={t`Events: ${filteredEvents.length}/${events.length} | Lines: ${filteredTotalLines}`}
          fg='#888888'
        />
        <text
          content={t`${autoScroll ? fg('#00FF00')('AUTO-SCROLL') : fg('#888888')(`Scroll: ${scrollOffset}/${maxScroll}`)}`}
        />
        <text content={t`[↑↓/jk] Scroll [C] Config [L] Logs [Q] Quit`} fg='#666666' />
      </box>

      {/* Configuration Dialog Overlay */}
      {showConfig && (
        <box
          position='absolute'
          top={Math.max(2, Math.floor(renderer.height / 2) - Math.floor((configOptions.length + 5) / 2))}
          left={Math.floor(renderer.width / 2) - 25}
          width={50}
          height={Math.min(renderer.height - 4, configOptions.length + 5)}
          borderStyle='double'
          borderColor='#4488FF'
          backgroundColor='#1a1a1a'
          flexDirection='column'
          paddingLeft={1}
          paddingRight={1}
          overflow='hidden'
        >
          <text content={t`Filters`} fg='#4488FF' attributes={TextAttributes.BOLD} />
          <text content={t`─────────────────────────────────────────────`} fg='#333333' />
          {(() => {
            let selectableIdx = -1
            return configOptions.map(option => {
              if (option.type === 'header') {
                // Header row (non-selectable)
                return <text key={`header-${option.label}`} content={t`${option.label}`} fg='#4488FF' />
              }

              selectableIdx++
              const isSelected = selectableIdx === configSelectedIdx

              if (option.type === 'eventFilter') {
                const isEnabled = eventFilters[option.key]
                const checkbox = isEnabled ? '[✓]' : '[ ]'
                const prefix = isSelected ? '▶ ' : '  '
                const color = isSelected ? '#FFFFFF' : '#888888'
                return <text key={option.key} content={t`${prefix}${checkbox} ${option.label}`} fg={color} />
              }

              if (option.type === 'streamer') {
                const isEnabled = enabledStreamers.has(option.originIdx)
                const checkbox = isEnabled ? '[✓]' : '[ ]'
                const prefix = isSelected ? '▶ ' : '  '
                const color = isSelected ? '#FFFFFF' : '#888888'
                return (
                  <text
                    key={`streamer-${option.originIdx}`}
                    content={t`${prefix}${checkbox} ${option.label}`}
                    fg={color}
                  />
                )
              }

              return null
            })
          })()}
          <text content={t`─────────────────────────────────────────────`} fg='#333333' />
          <text content={t`[↑↓] Navigate  [Space] Toggle  [Esc] Close`} fg='#666666' />
        </box>
      )}
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

  // Load persisted config
  const initialConfig = loadConfig()
  console.log(`Config file: ${CONFIG_FILE}`)
  console.log(`Config loaded: ${initialConfig ? 'yes' : 'no (using defaults)'}`)

  // Log startup info
  console.log('LAPLACE Event Bridge TUI')
  console.log('========================')
  console.log(`Connecting to: ${options.url}`)
  console.log(`Token: ${options.token ? '***' : 'none'}`)
  console.log(`Reconnect: ${options.reconnect}`)
  console.log(`Interval: ${options.interval}ms`)
  console.log(`Max attempts: ${options.attempts}`)

  // Fetch room info from /info endpoint
  const roomMaps = await fetchRoomInfo(options.url)

  // Create the event bridge client
  const client = new LaplaceEventBridgeClient({
    url: options.url,
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
  createRoot(renderer).render(
    <App client={client} options={options} renderer={renderer} roomMaps={roomMaps} initialConfig={initialConfig} />
  )
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
