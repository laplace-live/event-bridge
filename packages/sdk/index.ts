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
   * The base interval between reconnect attempts in milliseconds.
   * With exponential backoff, each attempt multiplies this by 1.5^(attempt-1).
   * The maximum interval is capped at 60 seconds.
   *
   * @default 3000
   * @example
   * // With base interval of 3000ms:
   * // Attempt 1: 3000ms
   * // Attempt 2: 4500ms
   * // Attempt 3: 6750ms
   * // ...
   * // Capped at: 60000ms
   */
  reconnectInterval?: number
  /**
   * The maximum number of reconnect attempts
   *
   * @default 1000
   */
  maxReconnectAttempts?: number
  /**
   * The timeout for ping heartbeat in milliseconds
   * If no ping is received within this time, the connection is considered dead
   * Only applies to server versions >= 4.0.2
   *
   * @default 90000 (90 seconds)
   */
  pingTimeout?: number
}

export class LaplaceEventBridgeClient {
  private ws: WebSocket | null = null
  private eventHandlers = new Map<string, EventHandler<any>[]>()
  private anyEventHandlers: AnyEventHandler[] = []
  private connectionStateHandlers: ConnectionStateChangeHandler[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private clientId: string | null = null
  private serverVersion: string | null = null
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED
  private lastPingTime: number | null = null
  private pingMonitorTimer: ReturnType<typeof setInterval> | null = null

  private options: Required<ConnectionOptions> = {
    url: 'ws://localhost:9696',
    token: '',
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 1000,
    pingTimeout: 90000, // 90 seconds
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

        let url = this.options.url
        const protocols: string[] = []
        if (this.options.token) {
          // Add the token as the second protocol parameter
          protocols.push('laplace-event-bridge-role-client', this.options.token)

          // Also add token as a query parameter
          const urlObj = new URL(url)
          urlObj.searchParams.set('token', this.options.token)
          url = urlObj.toString()
        }

        this.ws = new WebSocket(url, protocols)

        this.ws.onopen = () => {
          this.setConnectionState(ConnectionState.CONNECTED)
          this.reconnectAttempts = 0
          resolve()
        }

        this.ws.onmessage = event => {
          try {
            const data = JSON.parse(event.data)

            // Handle ping from server
            if (data.type === 'ping') {
              // Track last ping time
              this.lastPingTime = Date.now()

              // Respond with pong
              this.ws?.send(
                JSON.stringify({
                  type: 'pong',
                  timestamp: Date.now(),
                  respondingTo: data.timestamp,
                })
              )
              return
            }

            // Store client ID from the established message
            if (data.type === 'established') {
              this.clientId = data.clientId
              this.serverVersion = data.version

              // Create a display URL that masks the token if present
              const displayUrl = (() => {
                const urlObj = new URL(url)
                if (urlObj.searchParams.has('token')) {
                  urlObj.searchParams.set('token', '***')
                }
                return urlObj.toString()
              })()

              console.log(
                `Welcome to LAPLACE Event Bridge ${`v${data.version}` || '(unknown version)'}: ${displayUrl} with client ID ${this.clientId || 'unknown'}`
              )

              // Start ping monitoring if server version supports it (>= 4.0.2)
              if (this.shouldMonitorPing()) {
                this.startPingMonitoring()
              }
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

          // Stop ping monitoring before attempting reconnection
          this.stopPingMonitoring()

          // Clear ping state
          this.lastPingTime = null

          if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++
            this.setConnectionState(ConnectionState.RECONNECTING)

            // Calculate exponential backoff with cap at 60 seconds
            const baseInterval = this.options.reconnectInterval
            const backoffMultiplier = 1.5 // Increase by 50% each time
            const maxInterval = 60000 // 60 seconds cap

            // Calculate delay: base * (multiplier ^ (attempt - 1))
            const calculatedDelay = Math.min(
              baseInterval * Math.pow(backoffMultiplier, this.reconnectAttempts - 1),
              maxInterval
            )
            const delay = Math.round(calculatedDelay)

            console.log(
              `Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts}) in ${delay}ms...`
            )
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(err => {
                console.error('Reconnection failed:', err)
              })
            }, delay)
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

    this.stopPingMonitoring()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setConnectionState(ConnectionState.DISCONNECTED)
    this.clientId = null
    this.serverVersion = null
    this.lastPingTime = null
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

  /**
   * Check if ping monitoring should be enabled based on server version
   */
  private shouldMonitorPing(): boolean {
    if (!this.serverVersion) {
      return false
    }

    // Parse version (e.g., "4.0.2" -> [4, 0, 2])
    const versionParts = this.serverVersion.split('.').map(part => parseInt(part, 10))

    // Ensure we have at least 3 version parts
    if (versionParts.length < 3 || versionParts.some(isNaN)) {
      console.warn(`Invalid server version format: ${this.serverVersion}`)
      return false
    }

    const major = versionParts[0]!
    const minor = versionParts[1]!
    const patch = versionParts[2]!

    // Check if version is >= 4.0.3
    if (major > 4) return true
    if (major === 4) {
      if (minor > 0) return true
      if (minor === 0 && patch >= 3) return true
    }

    return false
  }

  /**
   * Start monitoring ping messages from the server
   */
  private startPingMonitoring(): void {
    // Stop any existing monitoring
    this.stopPingMonitoring()

    console.log(`Ping monitoring enabled (timeout: ${this.options.pingTimeout}ms)`)

    // Set initial ping time
    this.lastPingTime = Date.now()

    // Start monitoring
    this.pingMonitorTimer = setInterval(() => {
      if (!this.lastPingTime) {
        return
      }

      const timeSinceLastPing = Date.now() - this.lastPingTime

      if (timeSinceLastPing > this.options.pingTimeout) {
        console.warn(`Ping timeout detected (${timeSinceLastPing}ms since last ping). Reconnecting...`)

        // Stop monitoring
        this.stopPingMonitoring()

        // Force reconnection
        if (this.ws) {
          this.ws.close()
        }
      }
    }, this.options.pingTimeout / 3) // Check 3 times within the timeout period
  }

  /**
   * Stop monitoring ping messages
   */
  private stopPingMonitoring(): void {
    if (this.pingMonitorTimer) {
      clearInterval(this.pingMonitorTimer)
      this.pingMonitorTimer = null
    }
  }
}
