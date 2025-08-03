import { create } from 'zustand'
import type { LaplaceEvent } from '@laplace.live/event-types'

interface ChatState {
  messages: LaplaceEvent[]
  addMessage: (message: LaplaceEvent) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>(set => ({
  messages: [],
  addMessage: messageData =>
    set(state => {
      const newMessages = [...state.messages, messageData]
      // Keep only the most recent 50 messages
      return {
        messages: newMessages.slice(-50),
      }
    }),
  clearMessages: () => set({ messages: [] }),
}))
