import type { LaplaceEvent } from '@laplace.live/event-types'
import type { LaplaceInternal } from '@laplace.live/internal'

// ============================================================================
// Room info types
// ============================================================================

/**
 * Response structure from /info endpoint
 */
export interface InfoResponse {
  success: boolean
  status: number
  data: {
    version: string
    uptime: string
    connectedAt: string
    websocketBridge: string
    websocketClients: number
    rooms: LaplaceInternal.HTTPS.Workers.UidByRoom[]
  }
}

/**
 * Extended room info from API (includes username which is not in the base type)
 */
export interface RoomInfo extends LaplaceInternal.HTTPS.Workers.UidByRoom {
  username?: string
}

/**
 * Room maps for looking up streamer names
 * - byIdx: Map of originIdx (array index) to streamer username
 * - byRoomId: Map of roomId to streamer username (fallback)
 */
export interface RoomMaps {
  byIdx: Map<number, string>
  byRoomId: Map<number, string>
}

// ============================================================================
// Event filter configuration
// ============================================================================

export interface EventFilters {
  showInteractions: boolean
  showMessages: boolean
  showSuperchats: boolean
  showGifts: boolean
  showEntryEffects: boolean
  showSystem: boolean
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  showInteractions: false, // Off by default
  showMessages: true,
  showSuperchats: true,
  showGifts: true,
  showEntryEffects: true,
  showSystem: true,
}

// ============================================================================
// CLI types
// ============================================================================

export interface CliOptions {
  url: string
  token?: string
  reconnect: boolean
  interval: number
  attempts: number
  help: boolean
}

// ============================================================================
// Event types
// ============================================================================

export interface FormattedEvent {
  id: string
  timestamp: number
  lines: string[]
  type: string
  guardType?: number // 0=none, 1=Governor, 2=Admiral, 3=Captain
  originIdx?: number // Index into rooms array for room lookup
  priceNormalized?: number // Price in CNY for superchats/gifts
}

/**
 * Internal event type for connection established
 */
export interface EstablishedEvent {
  type: 'established'
  clientId: string
  version: string
}

/**
 * Extended event type to include internal events like 'established'
 */
export type ExtendedEvent = LaplaceEvent | EstablishedEvent

// ============================================================================
// Persisted configuration
// ============================================================================

/**
 * Configuration that gets persisted to disk
 */
export interface PersistedConfig {
  eventFilters: EventFilters
  // Streamer filters are stored by roomId (more stable than array index)
  disabledStreamers: number[]
}
