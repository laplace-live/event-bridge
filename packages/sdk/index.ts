import type { LaplaceEvent, LaplaceEventTypes } from '@laplace.live/event-types'

// Connection state enum to represent the current state of the connection
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
}

// Create a conditional type that maps from event type string to event object type
export type EventTypeMap = {
  [K in LaplaceEventTypes]: Extract<LaplaceEvent, { type: K }>
}

export type EventHandler<T extends LaplaceEvent> = (event: T) => void
export type EventTypeHandler = (event: LaplaceEvent) => void
export type AnyEventHandler = (event: LaplaceEvent) => void
export type ConnectionStateChangeHandler = (state: ConnectionState) => void

export interface ConnectionOptions {
  /**
   * The URL of the LAPLACE Event Bridge server
   *
   * @example 'ws://localhost:9696'
   */
  url?: string
  /**
   * The authentication token for the LAPLACE Event Bridge server
   */
  token?: string
  /**
   * Whether to automatically reconnect to the LAPLACE Event Bridge server
   */
  reconnect?: boolean
  /**
   * The interval between reconnect attempts in milliseconds
   *
   * @default 3000
   */
  reconnectInterval?: number
  /**
   * The maximum number of reconnect attempts
   *
   * @default 10
   */
  maxReconnectAttempts?: number
}

export class LaplaceEventBridgeClient {
  private ws: WebSocket | null = null
  private eventHandlers = new Map<string, EventHandler<any>[]>()
  private anyEventHandlers: AnyEventHandler[] = []
  private connectionStateHandlers: ConnectionStateChangeHandler[] = []
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private clientId: string | null = null
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED

  private options: Required<ConnectionOptions> = {
    url: 'ws://localhost:9696',
    token: '',
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  }

  constructor(options: ConnectionOptions = {}) {
    this.options = { ...this.options, ...options }
  }

  /**
   * Connect to the LAPLACE Event Bridge
   * @returns A promise that resolves when the connection is established
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.close()
        }

        this.setConnectionState(ConnectionState.CONNECTING)

        const protocols: string[] = []
        if (this.options.token) {
          // Add the token as the second protocol parameter
          protocols.push('laplace-event-bridge-role-client', this.options.token)
        }

        this.ws = new WebSocket(this.options.url, protocols)

        this.ws.onopen = () => {
          this.setConnectionState(ConnectionState.CONNECTED)
          this.reconnectAttempts = 0
          console.log('Connected to LAPLACE Event Bridge')
          resolve()
        }

        this.ws.onmessage = event => {
          try {
            const data = JSON.parse(event.data)

            // Store client ID from the established message
            if (data.type === 'established' && data.clientId) {
              this.clientId = data.clientId
              console.log(`Connection established with client ID: ${this.clientId}`)
            }

            // Process the event
            this.processEvent(data)
          } catch (err) {
            console.error('Failed to parse event data:', err)
          }
        }

        this.ws.onerror = error => {
          console.error('WebSocket error:', error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log('Disconnected from LAPLACE Event Bridge')

          if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++
            this.setConnectionState(ConnectionState.RECONNECTING)
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`)
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(err => {
                console.error('Reconnection failed:', err)
              })
            }, this.options.reconnectInterval) as unknown as number
          } else {
            this.setConnectionState(ConnectionState.DISCONNECTED)
          }
        }
      } catch (err) {
        this.setConnectionState(ConnectionState.DISCONNECTED)
        reject(err)
      }
    })
  }

  /**
   * Disconnect from the LAPLACE Event Bridge
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setConnectionState(ConnectionState.DISCONNECTED)
    this.clientId = null
  }

  /**
   * Register an event handler for a specific event type
   * @param eventType The event type to listen for
   * @param handler The handler function to call when the event is received
   */
  public on<T extends LaplaceEventTypes>(eventType: T, handler: (event: EventTypeMap[T]) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, [])
    }
    this.eventHandlers.get(eventType)!.push(handler)
  }

  /**
   * Register a handler for all events
   * @param handler The handler function to call for any event
   */
  public onAny(handler: AnyEventHandler): void {
    this.anyEventHandlers.push(handler)
  }

  /**
   * Register a handler for connection state changes
   * @param handler The handler function to call when the connection state changes
   */
  public onConnectionStateChange(handler: ConnectionStateChangeHandler): void {
    this.connectionStateHandlers.push(handler)
    // Immediately call with current state to initialize
    handler(this.connectionState)
  }

  /**
   * Remove an event handler for a specific event type
   * @param eventType The event type to remove the handler for
   * @param handler The handler function to remove
   */
  public off<T extends LaplaceEventTypes>(eventType: T, handler: (event: EventTypeMap[T]) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      return
    }

    const handlers = this.eventHandlers.get(eventType)!
    const index = handlers.indexOf(handler)

    if (index !== -1) {
      handlers.splice(index, 1)
    }

    if (handlers.length === 0) {
      this.eventHandlers.delete(eventType)
    }
  }

  /**
   * Remove a handler for all events
   * @param handler The handler function to remove
   */
  public offAny(handler: AnyEventHandler): void {
    const index = this.anyEventHandlers.indexOf(handler)
    if (index !== -1) {
      this.anyEventHandlers.splice(index, 1)
    }
  }

  /**
   * Remove a connection state change handler
   * @param handler The handler function to remove
   */
  public offConnectionStateChange(handler: ConnectionStateChangeHandler): void {
    const index = this.connectionStateHandlers.indexOf(handler)
    if (index !== -1) {
      this.connectionStateHandlers.splice(index, 1)
    }
  }

  /**
   * Check if the client is connected to the bridge
   * @deprecated Use getConnectionState() instead for more detailed state information
   */
  public isConnectedToBridge(): boolean {
    return this.connectionState === ConnectionState.CONNECTED
  }

  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Get the client ID assigned by the bridge
   */
  public getClientId(): string | null {
    return this.clientId
  }

  /**
   * Send an event to the bridge
   * @param event The event to send
   */
  public send(event: LaplaceEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to LAPLACE Event Bridge')
    }

    this.ws.send(JSON.stringify(event))
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state
      // Notify all connection state change handlers
      for (const handler of this.connectionStateHandlers) {
        try {
          handler(state)
        } catch (err) {
          console.error('Error in connection state change handler:', err)
        }
      }
    }
  }

  private processEvent(event: LaplaceEvent): void {
    // Call specific event handlers
    if (this.eventHandlers.has(event.type)) {
      for (const handler of this.eventHandlers.get(event.type)!) {
        try {
          handler(event)
        } catch (err) {
          console.error(`Error in event handler for type ${event.type}:`, err)
        }
      }
    }

    // Call any event handlers
    for (const handler of this.anyEventHandlers) {
      try {
        handler(event)
      } catch (err) {
        console.error('Error in any event handler:', err)
      }
    }
  }
}
