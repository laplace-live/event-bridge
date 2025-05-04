import { Component } from 'solid-js';

type TimestampProps = {
  timestamp: number;
};

export const Timestamp: Component<TimestampProps> = (props) => {
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <span class="timestamp">
      {formatTime(props.timestamp)}
    </span>
  );
};

export default Timestamp;
