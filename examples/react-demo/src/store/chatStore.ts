import { LaplaceEvent } from '@laplace.live/event-types'
import { create } from 'zustand'

interface ChatState {
  messages: LaplaceEvent[]
  addMessage: (message: LaplaceEvent) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>(set => ({
  messages: [],
  addMessage: messageData =>
    set(state => ({
      messages: [...state.messages, messageData],
    })),
  clearMessages: () => set({ messages: [] }),
}))
