/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css'

console.log('👋 This message is being logged by "renderer.ts", included via Vite')

// TypeScript declaration for the electronAPI
declare global {
  interface Window {
    electronAPI: {
      setWindowOpacity: (opacity: number) => void
      setAlwaysOnTop: (enabled: boolean) => void
    }
  }
}

// Get DOM elements
const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement
const opacityValue = document.getElementById('opacity-value') as HTMLSpanElement
const closeBtn = document.getElementById('close-btn') as HTMLButtonElement
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement
const settingsModal = document.getElementById('settings-modal') as HTMLElement
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement
const alwaysOnTopCheckbox = document.getElementById('always-on-top') as HTMLInputElement

// Handle opacity slider changes
if (opacitySlider && opacityValue) {
  opacitySlider.addEventListener('input', e => {
    const target = e.target as HTMLInputElement
    const opacity = parseInt(target.value)
    opacityValue.textContent = `${opacity}%`

    // Update the background opacity
    const content = document.querySelector('.content') as HTMLElement
    if (content) {
      content.style.backgroundColor = `rgba(20, 20, 20, ${opacity / 100})`
    }

    // Update window opacity (optional - this affects the entire window)
    // window.electronAPI.setWindowOpacity(opacity / 100);
  })
}

// Handle close button
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.close()
  })
}

// Handle settings button
if (settingsBtn && settingsModal) {
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('show')
  })
}

// Handle modal close button
if (closeModalBtn && settingsModal) {
  closeModalBtn.addEventListener('click', () => {
    settingsModal.classList.remove('show')
  })
}

// Close modal when clicking outside
if (settingsModal) {
  settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('show')
    }
  })
}

// Handle always on top checkbox
if (alwaysOnTopCheckbox) {
  alwaysOnTopCheckbox.addEventListener('change', e => {
    const target = e.target as HTMLInputElement
    window.electronAPI.setAlwaysOnTop(target.checked)
  })
}

// Close modal with Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsModal) {
    settingsModal.classList.remove('show')
  }
})
