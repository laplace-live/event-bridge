import './index.css'

import { useEffect } from 'react'

import { EventComponent } from './components/event'
import laplaceLogo from './laplace-spaceless.svg'
import { eventBridgeClient } from './lib/chat'
import logo from './logo.svg'
import reactLogo from './react.svg'

export function App() {
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventBridgeClient.disconnect()
    }
  }, [])

  return (
    <div className='max-w-7xl mx-auto p-8 text-center relative z-10'>
      <div className='flex justify-center items-center gap-4 mb-4'>
        <img
          src={logo}
          alt='Bun Logo'
          className='h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#646cffaa] scale-120'
        />
        <img
          src={reactLogo}
          alt='React Logo'
          className='h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] animate-[spin_20s_linear_infinite]'
        />
        <img
          src={laplaceLogo}
          alt='LAPLACE Logo'
          className='h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] animate-[spin_20s_linear_infinite]'
        />
      </div>

      <h1 className='text-3xl font-bold my-4 leading-tight'>LAPLACE Event Bridge + Bun + React</h1>

      <div className='grid grid-cols-1 gap-8 mt-8'>
        <EventComponent />
      </div>
    </div>
  )
}

export default App
