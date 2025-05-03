import { LaplaceEventBridgeClient } from '@laplace.live/event-bridge-sdk'

/**
 * Create and configure a LAPLACE Event Bridge client
 * @param url WebSocket URL to connect to
 * @returns Configured client instance
 */
export function createEventBridgeClient(url: string): LaplaceEventBridgeClient {
  return new LaplaceEventBridgeClient({
    url,
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
  })
}

/**
 * Get default WebSocket URL
 * @returns Default WebSocket URL
 */
export function getDefaultWebSocketUrl(): string {
  return 'ws://localhost:9696'
}
