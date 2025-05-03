import '@laplace.live/event-bridge-sdk'

// Add additional event types for the event bridge client
declare module '@laplace.live/event-bridge-sdk' {
  interface LaplaceEventBridgeClient {
    on(eventType: 'connected', handler: () => void): void
    on(eventType: 'disconnected', handler: () => void): void
  }
}
