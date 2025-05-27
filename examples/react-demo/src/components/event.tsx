import React, { useEffect, useRef } from 'react'
import { LaplaceEvent } from '@laplace.live/event-types'

import { useChatStore } from '../store/chatStore'
import { TextEffect } from './text-effect'
import { Timestamp } from './timestamp'

/**
 * Main chat component that displays all messages
 */
export const EventComponent: React.FC = () => {
  const messages = useChatStore(state => state.messages)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages])

  return (
    <div className='w-full text-start max-w-lg mx-auto bg-white rounded-lg shadow-md overflow-hidden'>
      <div ref={containerRef} className='h-128 overflow-y-auto p-4 space-y-2 text-black'>
        {messages.length === 0 ? (
          <div className='text-center text-gray-500 py-8'>No messages yet</div>
        ) : (
          messages.map(event => <MessageRouter key={event.id} event={event} />)
        )}
      </div>
    </div>
  )
}

/**
 * Routes messages to the appropriate component based on event type
 */
const MessageRouter: React.FC<{ event: LaplaceEvent }> = ({ event }) => {
  if (event.type === 'system') {
    return <div>{event.message}</div>
  }

  if (event.type === 'interaction') {
    const actionMap: { [key: number]: string } = {
      1: '进入直播间',
      2: '关注',
      3: '分享',
      4: '特别关注',
      5: '互相关注',
    }

    return (
      <div className='flex flex-col opacity-40'>
        <TextEffect>{`${event.username} ${actionMap[event.action]}`}</TextEffect>
      </div>
    )
  }

  if (event.type === 'message') {
    return (
      <div className='flex flex-col'>
        <Timestamp timestamp={event.timestampNormalized} />
        <TextEffect className='text-2xl font-bold'>{`${event.username}: ${event.message}`}</TextEffect>
      </div>
    )
  }

  if (event.type === 'superchat') {
    return (
      <div className='flex flex-col'>
        <Timestamp timestamp={event.timestampNormalized} />
        {event.username}: [¥{event.priceNormalized}] {event.message}
      </div>
    )
  }

  if (event.type === 'gift') {
    return (
      <div className='flex flex-col'>
        <Timestamp timestamp={event.timestampNormalized} />
        {event.username}: [¥{event.priceNormalized}] {event.message}
      </div>
    )
  }

  if (event.type === 'entry-effect') {
    return <TextEffect className='text-sky-600'>{event.message}</TextEffect>
  }
}
