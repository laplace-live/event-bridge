import React from 'react'

export const Timestamp: React.FC<{ timestamp: number }> = ({ timestamp }) => (
  <span className='text-xs opacity-40'>{new Date(timestamp).toLocaleTimeString()}</span>
)
