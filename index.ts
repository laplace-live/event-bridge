// Get authentication token from environment variable
const AUTH_TOKEN = process.env['LAPLACE_EVENT_BRIDGE_AUTH'] || ''

interface Client {
  id: string
  isServer: boolean // Flag to identify if this client is the laplace-chat server
}

const clients = new Map<any, Client>()
let nextClientId = 1

const server = Bun.serve<Client, {}>({
  port: 9696,
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
          message: 'Connected to LAPLACE Event bridge',
        })
      )
    },
    message(ws, message) {
      const clientId = ws.data.id
      const isServer = ws.data.isServer

      try {
        const messageStr = message.toString()
        let parsedMessage
        let broadcastMessage

        try {
          // Try to parse as JSON
          parsedMessage = JSON.parse(messageStr)
          console.log(`Received event from ${clientId}:`, parsedMessage)

          // Prepare broadcast message in the same format
          broadcastMessage = JSON.stringify({
            ...parsedMessage,
            source: clientId,
          })
        } catch (e) {
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
          console.log(`Broadcasting message from laplace-chat to all clients`)

          // Broadcast to all clients except the server
          for (const [client, data] of clients.entries()) {
            if (client !== ws) {
              client.send(broadcastMessage)
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

console.log(`LAPLACE Event Bridge running at http://${server.hostname}:${server.port}`)
