import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

import './index.css'

// TypeScript declaration for the electronAPI
declare global {
  interface Window {
    electronAPI: {
      setWindowOpacity: (opacity: number) => void
      setAlwaysOnTop: (enabled: boolean) => void
    }
  }
}

interface Message {
  username: string
  text: string
}

const App: React.FC = () => {
  const [messages] = useState<Message[]>([
    { username: 'User1', text: 'Hello from the React overlay!' },
    { username: 'User2', text: 'This is a transparent overlay window' },
  ])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [opacity, setOpacity] = useState(90)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)

  useEffect(() => {
    // Update the background opacity
    const content = document.querySelector('.content') as HTMLElement
    if (content) {
      content.style.backgroundColor = `rgba(20, 20, 20, ${opacity / 100})`
    }
  }, [opacity])

  const handleClose = () => {
    window.close()
  }

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value)
    setOpacity(newOpacity)
  }

  const handleAlwaysOnTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked
    setAlwaysOnTop(enabled)
    window.electronAPI.setAlwaysOnTop(enabled)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isSettingsOpen])

  return (
    <>
      <div className='title-bar'>
        <span>LAPLACE Chat Overlay</span>
        <div className='title-bar-buttons'>
          <button id='settings-btn' title='Settings' onClick={() => setIsSettingsOpen(true)}>
            ⚙
          </button>
          <button id='close-btn' title='Close' onClick={handleClose}>
            ×
          </button>
        </div>
      </div>

      <div className='content'>
        <div className='chat-container'>
          <h2>Chat Messages</h2>
          <div className='chat-messages'>
            {messages.map((message, index) => (
              <div key={index} className='message'>
                <span className='username'>{message.username}:</span>
                <span className='text'>{message.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <div
        id='settings-modal'
        className={`modal ${isSettingsOpen ? 'show' : ''}`}
        onClick={e => {
          if (e.target === e.currentTarget) {
            closeSettings()
          }
        }}
      >
        <div className='modal-content'>
          <div className='modal-header'>
            <h3>Settings</h3>
            <button id='close-modal-btn' className='modal-close' onClick={closeSettings}>
              ×
            </button>
          </div>
          <div className='modal-body'>
            <div className='setting-item'>
              <label htmlFor='opacity-slider'>Background Opacity:</label>
              <div className='slider-container'>
                <input
                  type='range'
                  id='opacity-slider'
                  min='0'
                  max='100'
                  value={opacity}
                  onChange={handleOpacityChange}
                />
                <span id='opacity-value'>{opacity}%</span>
              </div>
            </div>
            <div className='setting-item'>
              <label className='checkbox-label'>
                <input type='checkbox' id='always-on-top' checked={alwaysOnTop} onChange={handleAlwaysOnTopChange} />
                <span>Always on Top</span>
              </label>
              <p className='setting-description'>Keep the overlay window above all other windows</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Initialize React
const container = document.getElementById('root')
if (container) {
  const root = ReactDOM.createRoot(container)
  root.render(<App />)
}

console.log('👋 Chat overlay is now running with React!')
