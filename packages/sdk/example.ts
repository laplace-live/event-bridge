import { LaplaceEventBridgeClient } from './index'

// Create a new client with custom options
const client = new LaplaceEventBridgeClient({
  url: 'ws://localhost:9696',
  token: 'your-auth-token', // Optional: provide your authentication token
  reconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 5,
})

// Connect to the LAPLACE Event Bridge
client
  .connect()
  .then(() => {
    console.log('Successfully connected to LAPLACE Event Bridge')

    // Get the client ID assigned by the bridge
    const clientId = client.getClientId()
    console.log(`Client ID: ${clientId}`)
  })
  .catch(error => {
    console.error('Failed to connect to LAPLACE Event Bridge:', error)
  })

// Listen for specific event types - the event type is automatically inferred!
client.on('message', event => {
  // TypeScript knows that 'event' is of type Message here
  console.log('Received chat message:', event)
  console.log('User:', event.username)
  console.log('Message:', event.message)
  // Handle the chat message event
})

// Listen for system events - no need for explicit type parameter
client.on('system', event => {
  // TypeScript knows that 'event' is of type System here
  console.log('System event:', event)
  console.log('Message:', event.message)
  // Handle the system event
})

// Listen for any event
client.onAny(event => {
  console.log('Received event of type:', event.type)
  // Handle any event
})

// Example of sending a custom system message
function sendSystemMessage(text: string) {
  // Create a minimal system message for demo purposes
  // In a real app, you would ensure all required fields are properly filled
  const message = {
    type: 'system' as const, // Use const assertion to help TypeScript infer the correct type
    id: `system-${Date.now()}`,
    message: text,
    timestamp: Date.now(),
    timestampNormalized: Date.now(),
    origin: 0,
    originIdx: 0,
    uid: 0,
    username: 'sdk-example',
    read: false,
  }

  client.send(message)
}

// Example usage: Send a system message after 3 seconds
setTimeout(() => {
  try {
    sendSystemMessage('Hello from SDK example!')
    console.log('Sent system message')
  } catch (error) {
    console.error('Failed to send system message:', error)
  }
}, 3000)

// Example of properly cleaning up when done
function cleanup() {
  console.log('Disconnecting from LAPLACE Event Bridge...')
  client.disconnect()
  console.log('Disconnected')
}

// Example cleanup after 10 seconds
setTimeout(cleanup, 10000)

// Handle process termination gracefully
process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
