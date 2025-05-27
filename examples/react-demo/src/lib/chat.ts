import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

import { useChatStore } from '../store/chatStore'

// Function to initialize and return the client
export function initializeEventBridge() {
  // Create a new client
  const client = new LaplaceEventBridgeClient({
    url: 'ws://localhost:9696',
    token: 'your-auth-token', // Optional
    reconnect: true,
  })

  // Get the chat store actions
  const { addMessage } = useChatStore.getState()

  // Connect to the bridge
  client.connect().catch(err => {
    console.error('Failed to connect to event bridge:', err)
  })

  // Set up event listeners
  client.onAny(event => {
    console.log(event)
    addMessage(event)
  })

  // Monitor connection state changes
  client.onConnectionStateChange(state => {
    console.log(`Connection state changed to: ${state}`)

    // Add system messages for connection state changes
    switch (state) {
      case 'connected':
        console.log('Connected to the server!')
        break
      case 'reconnecting':
        console.log('Attempting to reconnect...')
        break
      case 'disconnected':
        console.log('Disconnected from the server')
        break
      case 'connecting':
        console.log('Establishing connection...')
        break
    }
  })

  return client
}

// Export a singleton instance
export const eventBridgeClient = initializeEventBridge()
