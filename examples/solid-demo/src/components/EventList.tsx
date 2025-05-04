import { Component, createEffect, onCleanup, onMount } from 'solid-js';
import { LaplaceEvent } from '@laplace.live/event-types';
import { chatState } from '../stores/chatStore';
import { Timestamp } from './Timestamp';
import { eventBridgeClient } from '../lib/eventBridge';
import './EventList.css';

const EventList: Component = () => {
  let containerRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom when messages change
  createEffect(() => {
    if (containerRef && chatState.messages.length > 0) {
      containerRef.scrollTo({
        top: containerRef.scrollHeight,
        behavior: 'smooth',
      });
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    eventBridgeClient.disconnect();
  });

  return (
    <div class="event-list-container">
      <div class="event-list" ref={containerRef}>
        {chatState.messages.length === 0 ? (
          <div class="no-messages">No messages yet</div>
        ) : (
          chatState.messages.map(event => <MessageRouter event={event} />)
        )}
      </div>
    </div>
  );
};

const MessageRouter: Component<{ event: LaplaceEvent }> = (props) => {
  const { event } = props;

  if (event.type === 'system') {
    return <div>{event.message}</div>;
  }

  if (event.type === 'interaction') {
    const actionMap: { [key: number]: string } = {
      1: '进入直播间',
      2: '关注',
      3: '分享',
      4: '特别关注',
      5: '互相关注',
    };

    return (
      <div class="interaction-message">
        {event.username} {actionMap[event.action]}
      </div>
    );
  }

  if (event.type === 'message') {
    return (
      <div class="chat-message">
        <Timestamp timestamp={event.timestampNormalized} />
        <span class="username">{event.username}:</span> {event.message}
      </div>
    );
  }

  if (event.type === 'superchat') {
    return (
      <div class="superchat-message">
        <Timestamp timestamp={event.timestampNormalized} />
        <span class="username">{event.username}:</span>
        <span class="price">[¥{event.priceNormalized}]</span> {event.message}
      </div>
    );
  }

  if (event.type === 'gift') {
    return (
      <div class="gift-message">
        <Timestamp timestamp={event.timestampNormalized} />
        <span class="username">{event.username}:</span>
        <span class="price">[¥{event.priceNormalized}]</span> {event.message}
      </div>
    );
  }

  if (event.type === 'entry-effect') {
    return <div class="entry-effect">{event.message}</div>;
  }

  return null;
};

export default EventList;
