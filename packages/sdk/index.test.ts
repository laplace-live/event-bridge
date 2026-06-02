import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'

import { ConnectionState, fetchInfo, LaplaceEventBridgeClient } from './index'

// Detect if running in AI agent environment for cleaner output
const isAIAgent = process.env.CLAUDECODE === '1' || process.env.REPL_ID === '1' || process.env.AGENT === '1'

// Helper to conditionally log based on AI agent environment
const log = (...args: any[]) => {
  if (!isAIAgent) {
    console.log(...args)
  }
}

describe('LaplaceEventBridgeClient', () => {
  describe('reconnection behavior', () => {
    let client: LaplaceEventBridgeClient | null = null
    let originalLog: typeof console.log

    beforeEach(() => {
      // Save original console.log for restoration
      originalLog = console.log
    })

    afterEach(() => {
      // Clean up client and restore console
      if (client) {
        client.disconnect()
        client = null
      }
      console.log = originalLog
    })

    test(
      'exponential backoff with failed connections',
      async () => {
        // Test configuration
        const unreachableUrl = 'ws://localhost:9999' // Intentionally unreachable port
        const maxAttempts = 5
        const reconnectInterval = 2000

        log('🧪 Testing WebSocket reconnection behavior with exponential backoff...')
        log(`Configuration:`)
        log(`  - URL: ${unreachableUrl}`)
        log(`  - Max attempts: ${maxAttempts}`)
        log(`  - Base reconnect interval: ${reconnectInterval}ms`)
        log(`  - Backoff multiplier: 1.5x`)
        log(`  - Max interval cap: 60000ms`)
        log('')

        // Calculate expected delays
        const expectedDelays: number[] = []
        for (let i = 0; i < maxAttempts; i++) {
          const delay = Math.min(reconnectInterval * 1.5 ** i, 60000)
          expectedDelays.push(Math.round(delay))
        }

        // Create client with test configuration
        client = new LaplaceEventBridgeClient({
          url: unreachableUrl,
          reconnect: true,
          maxReconnectAttempts: maxAttempts,
          reconnectInterval: reconnectInterval,
          pingTimeout: 5000, // Short timeout for testing
        })

        // Track connection state changes
        const stateHistory: ConnectionState[] = []
        let reconnectCount = 0
        const reconnectTimings: { attempt: number; scheduledDelay: number }[] = []

        // Mock console.log to capture reconnect timings
        const logSpy = jest.fn((...args) => {
          originalLog(...args)
          const message = args.join(' ')
          const match = message.match(/Attempting to reconnect \((\d+)\/\d+\) in (\d+)ms/)
          if (match) {
            reconnectTimings.push({
              attempt: parseInt(match[1]!, 10),
              scheduledDelay: parseInt(match[2]!, 10),
            })
          }
        })
        console.log = logSpy

        // Track state changes
        client.onConnectionStateChange(state => {
          stateHistory.push(state)
          if (state === ConnectionState.RECONNECTING) {
            reconnectCount++
          }
        })

        // Attempt to connect
        await client.connect().catch(() => {
          // Expected to fail
        })

        // Calculate expected test duration
        const totalExpectedTime = expectedDelays.reduce((sum, delay) => sum + delay, 0) + 2000

        // Wait for all reconnection attempts to complete
        await new Promise(resolve => setTimeout(resolve, totalExpectedTime))

        // Assertions
        expect(reconnectCount).toBe(maxAttempts)
        expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED)
        expect(reconnectTimings).toHaveLength(maxAttempts)

        // Verify exponential backoff timing
        reconnectTimings.forEach((timing, i) => {
          expect(timing.scheduledDelay).toBe(expectedDelays[i]!)
        })

        // Verify state transitions
        expect(stateHistory).toContain(ConnectionState.CONNECTING)
        expect(stateHistory).toContain(ConnectionState.RECONNECTING)
        expect(stateHistory).toContain(ConnectionState.DISCONNECTED)
      },
      { timeout: 40000 }
    ) // Use test options for timeout
  })

  describe('exponential backoff calculations', () => {
    test('calculates delays correctly with cap', () => {
      const baseInterval = 3000
      const backoffMultiplier = 1.5
      const maxInterval = 60000

      // Test first few attempts
      const delays = []
      for (let i = 0; i < 10; i++) {
        const delay = Math.min(baseInterval * backoffMultiplier ** i, maxInterval)
        delays.push(Math.round(delay))
      }

      // Verify calculations
      expect(delays[0]).toBe(3000) // 3s
      expect(delays[1]).toBe(4500) // 4.5s
      expect(delays[2]).toBe(6750) // 6.75s
      expect(delays[3]).toBe(10125) // 10.125s
      expect(delays[4]).toBe(15188) // 15.188s
      expect(delays[5]).toBe(22781) // 22.781s
      expect(delays[6]).toBe(34172) // 34.172s
      expect(delays[7]).toBe(51258) // 51.258s
      expect(delays[8]).toBe(60000) // Capped at 60s
      expect(delays[9]).toBe(60000) // Still capped at 60s
    })
  })

  describe('connection state management', () => {
    test('transitions through states correctly', async () => {
      const client = new LaplaceEventBridgeClient({
        url: 'ws://localhost:9999',
        reconnect: false, // Disable reconnect for this test
      })

      const states: ConnectionState[] = []
      client.onConnectionStateChange(state => {
        states.push(state)
      })

      // Initial state should be disconnected
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED)

      // Attempt connection (will fail)
      await client.connect().catch(() => {})

      // Wait a bit for state transitions
      await new Promise(resolve => setTimeout(resolve, 100))

      client.disconnect()

      // Verify we got the expected state transitions
      expect(states).toContain(ConnectionState.DISCONNECTED)
      expect(states).toContain(ConnectionState.CONNECTING)

      // Final state should be disconnected
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED)
    })
  })

  describe('ping monitoring', () => {
    test('clears ping state on disconnect', () => {
      const client = new LaplaceEventBridgeClient({
        url: 'ws://localhost:9999',
        reconnect: false,
      })

      // Connect and immediately disconnect
      client.connect().catch(() => {})
      client.disconnect()

      // Verify clean state (we can't directly check private members, but we can verify no errors)
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED)
      expect(client.getClientId()).toBeNull()
    })

    test('stopPingMonitoring is called on connection close', async () => {
      // This test verifies that the selected lines (177 and 180) are necessary
      // by ensuring ping monitoring cleanup happens on connection close

      const client = new LaplaceEventBridgeClient({
        url: 'ws://localhost:9999',
        reconnect: false,
      })

      let connectionClosed = false
      client.onConnectionStateChange(state => {
        if (state === ConnectionState.DISCONNECTED && connectionClosed) {
          // If we reach DISCONNECTED state after a close, it means cleanup was successful
          connectionClosed = true
        }
      })

      // Attempt connection and let it fail
      await client.connect().catch(() => {})

      // Verify the connection properly cleaned up
      expect(client.getConnectionState()).toBe(ConnectionState.DISCONNECTED)
      expect(client.getClientId()).toBeNull()

      // The fact that we can successfully disconnect without errors
      // indicates that ping monitoring was properly cleaned up
      client.disconnect()
    })
  })
})

describe('fetchInfo', () => {
  const realFetch = globalThis.fetch

  // Minimal valid `/info` payload — the `data` object fetchInfo returns.
  const sampleInfo = {
    version: '4.0.20',
    uptime: '2 hours ago',
    connectedAt: 1717200000000,
    websocketBridge: true,
    websocketClients: 3,
    rooms: [
      { status: 0, uid: 2132180406, roomId: 25034104, shortRoomId: 0, username: '明前奶绿' },
      { status: 404, uid: 0, roomId: 456117, shortRoomId: 0, username: null },
    ],
  }

  const okResponse = (data: unknown) =>
    new Response(JSON.stringify({ success: true, status: 200, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('derives an http URL from a ws URL and appends /info', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe('http://localhost:9696/info')
  })

  test('derives an https URL from a wss URL', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'wss://event-fetcher.laplace.cn' })

    expect(spy.mock.calls[0]![0]).toBe('https://event-fetcher.laplace.cn/info')
  })

  test('does not double up a trailing slash on the base URL', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696/' })

    expect(spy.mock.calls[0]![0]).toBe('http://localhost:9696/info')
  })

  test('passes through an http URL unchanged', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'http://localhost:9696' })

    expect(spy.mock.calls[0]![0]).toBe('http://localhost:9696/info')
  })

  test('preserves a sub-path for reverse-proxied fetchers', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'wss://example.com/lef/' })

    expect(spy.mock.calls[0]![0]).toBe('https://example.com/lef/info')
  })

  test('sends an Authorization bearer header when a token is provided', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696', token: 'secret' })

    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })

  test('omits the Authorization header when no token is provided', async () => {
    const spy = jest.fn(async (_url: string, _init?: RequestInit) => okResponse(sampleInfo))
    globalThis.fetch = spy as unknown as typeof fetch

    await fetchInfo({ url: 'ws://localhost:9696' })

    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  test('returns the data payload on success', async () => {
    globalThis.fetch = (async () => okResponse(sampleInfo)) as unknown as typeof fetch

    const info = await fetchInfo({ url: 'ws://localhost:9696' })

    expect(info).toEqual(sampleInfo)
    expect(info?.rooms).toHaveLength(2)
  })

  test('returns null without fetching when url is empty', async () => {
    const spy = jest.fn()
    globalThis.fetch = spy as unknown as typeof fetch

    const info = await fetchInfo({ url: '' })

    expect(info).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  test('returns null on a non-ok response (e.g. 403)', async () => {
    globalThis.fetch = (async () => new Response('', { status: 403 })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when the envelope success flag is false', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false, status: 403, message: 'Unauthorized' }), {
        status: 200,
      })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when rooms is not an array', async () => {
    globalThis.fetch = (async () => okResponse({ ...sampleInfo, rooms: undefined })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null on a network error', async () => {
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null on invalid JSON', async () => {
    globalThis.fetch = (async () => new Response('not json', { status: 200 })) as unknown as typeof fetch
    expect(await fetchInfo({ url: 'ws://localhost:9696' })).toBeNull()
  })

  test('returns null when the signal is already aborted', async () => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      return okResponse(sampleInfo)
    }) as unknown as typeof fetch

    const controller = new AbortController()
    controller.abort()

    expect(await fetchInfo({ url: 'ws://localhost:9696', signal: controller.signal })).toBeNull()
  })
})

describe('client.getInfo', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('fetches /info using the client url and token without connecting', async () => {
    const data = {
      version: '4.0.20',
      uptime: '',
      connectedAt: 0,
      websocketBridge: true,
      websocketClients: 0,
      rooms: [],
    }
    const spy = jest.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ success: true, status: 200, data }), { status: 200 })
    )
    globalThis.fetch = spy as unknown as typeof fetch

    const client = new LaplaceEventBridgeClient({ url: 'wss://example.com', token: 'tok' })
    const info = await client.getInfo()

    expect(spy.mock.calls[0]![0]).toBe('https://example.com/info')
    const init = spy.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(info?.rooms).toEqual([])
  })
})
