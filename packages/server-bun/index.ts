import { parseArgs } from 'node:util'
import type { LaplaceEvent } from '@laplace.live/event-types'
import type { ServerWebSocket } from 'bun'

import pkg from './package.json' with { type: 'json' }

// Parse command line arguments properly
const { values } = parseArgs({
  args: Bun.argv,
  options: {
    debug: {
      type: 'boolean',
    },
    auth: {
      type: 'string',
    },
    host: {
      type: 'string',
    },
  },
  strict: false,
})

// Get authentication token from environment variable or CLI
const AUTH_TOKEN = process.env.LEB_AUTH || process.env.LAPLACE_EVENT_BRIDGE_AUTH || values.auth || ''

// Debug mode configuration
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.DEBUG?.toLowerCase() === 'true' || !!values.debug

// Network interface configuration
const HOST = process.env.HOST || (values.host as string) || 'localhost'

// Keepalive/backpressure tuning — keep in sync with the Go server
// (packages/server/main.go: pongWait, slow-client drop). Bun pings
// automatically and buffers outbound writes per connection.
const IDLE_TIMEOUT = 60 // seconds without a message or pong before a peer is considered dead
const BACKPRESSURE_LIMIT = 1024 * 1024 // bytes queued to a stalled client before it is dropped

interface Client {
  id: string
  isServer: boolean // Flag to identify if this client is the laplace-chat server
}

const clients = new Map<ServerWebSocket<Client>, Client>()
let nextClientId = 1

const server = Bun.serve<Client, never>({
  port: 9696,
  hostname: HOST,
  fetch(req, server) {
    // Check if this is the laplace-chat server connecting
    // Format: "laplace-event-bridge-role-server, password123"
    const protocol = req.headers.get('sec-websocket-protocol')
    const protocolParts = protocol ? protocol.split(',') : []
    const role = protocolParts[0]?.trim()
    const password = protocolParts[1]?.trim() // Password for verification

    const isServer = role === 'laplace-event-bridge-role-server'

    if (AUTH_TOKEN) {
      if (password !== AUTH_TOKEN) {
        console.log(`Authentication failed: Invalid token for ${isServer ? 'server' : 'client'} connection`)
        return new Response('Unauthorized', { status: 401 })
      }
    }

    // Upgrade the request to a WebSocket connection
    const success = server.upgrade(req, {
      data: {
        id: `${isServer ? 'server' : 'client'}-${nextClientId++}`,
        isServer,
      },
    })

    if (!success) {
      return new Response('WebSocket upgrade failed. This is a WebSocket server.', { status: 400 })
    }

    return undefined
  },
  websocket: {
    idleTimeout: IDLE_TIMEOUT,
    sendPings: true, // ping quiet-but-healthy clients so idleTimeout only reaps dead peers
    backpressureLimit: BACKPRESSURE_LIMIT,
    closeOnBackpressureLimit: true, // drop consumers that stall past the buffer instead of losing messages silently
    open(ws) {
      const clientId = ws.data.id
      const isServer = ws.data.isServer
      clients.set(ws, ws.data)

      console.log(`Client connected: ${clientId}${isServer ? ' (laplace-chat server)' : ''}`)

      // Welcome message
      ws.send(
        JSON.stringify({
          type: 'established',
          clientId,
          isServer,
          version: pkg.version,
          message: 'Connected to LAPLACE Event Bridge',
        })
      )
    },
    message(ws, message) {
      const clientId = ws.data.id
      const isServer = ws.data.isServer

      try {
        const messageStr = message.toString()
        let parsedMessage: LaplaceEvent
        let broadcastMessage: string

        try {
          // Try to parse as JSON
          parsedMessage = JSON.parse(messageStr)

          if (DEBUG_MODE) {
            console.log(`Received ${parsedMessage.type} from ${clientId}:`, parsedMessage)
          } else {
            console.log(`Received ${parsedMessage.type} from ${clientId}`)
          }

          // Prepare broadcast message in the same format
          broadcastMessage = JSON.stringify({
            ...parsedMessage,
            source: clientId,
          })
        } catch {
          // Handle as plain text if not JSON
          console.log(`Received message from ${clientId}: ${messageStr}`)

          // Prepare broadcast message for plain text
          broadcastMessage = JSON.stringify({
            type: 'unknown-message',
            text: messageStr,
            source: clientId,
            timestamp: Date.now(),
          })
        }

        // Broadcast to all clients EXCEPT the server
        // If the message is from the server, broadcast to all clients
        // If from a client, don't broadcast (or optionally can be enabled)
        if (isServer) {
          // console.log(`Broadcasting message from laplace-chat to all clients`)

          // Broadcast to all clients except the server
          for (const [client, data] of clients.entries()) {
            if (client !== ws) {
              // 0 = dropped: the connection is closing, or the client stalled past
              // backpressureLimit (closeOnBackpressureLimit then drops it)
              if (client.send(broadcastMessage) === 0) {
                console.warn(`Dropped message to ${data.id} (slow or closing connection)`)
              }
            }
          }

          // Send confirmation back to the server
          ws.send(
            JSON.stringify({
              type: 'broadcast-success',
              clientCount: clients.size - 1, // Excluding the server
              timestamp: Date.now(),
            })
          )
        } else {
          // Optional: Echo back to the client that their message was received
          ws.send(
            JSON.stringify({
              type: 'client-message-received',
              message: 'Message received (client-to-server messages are not relayed)',
              timestamp: Date.now(),
            })
          )
        }
      } catch (error) {
        console.error(`Error processing message from ${clientId}:`, error)
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to process your message',
            timestamp: Date.now(),
          })
        )
      }
    },
    close(ws) {
      const clientId = ws.data.id
      const isServer = ws.data.isServer
      clients.delete(ws)
      console.log(`Client disconnected: ${clientId}${isServer ? ' (laplace-chat server)' : ''}`)
    },
    drain(ws) {
      console.log(`WebSocket backpressure: ${ws.getBufferedAmount()}`)
    },
  },
})

// Create a banner display at startup
function displayBanner() {
  console.log('🌸 LAPLACE Event Bridge Server')
  console.log(`🚀 Server running at http://${server.hostname}:${server.port}`)
  console.log(`🔐 Authentication: ${AUTH_TOKEN ? '✅ Enabled' : '❌ Disabled'}`)
  console.log(`🐛 Debug Mode: ${DEBUG_MODE ? '✅ Enabled' : '❌ Disabled'}`)
  console.log(`⏱️ Started at: ${new Date().toLocaleString()}`)
  console.log(`\nWaiting for connections...\n`)
}

displayBanner()
