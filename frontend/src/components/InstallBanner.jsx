import { useState, useEffect } from 'react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setDeferredPrompt(null)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-[132px] md:bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-spotify-darkgray border border-spotify-gray rounded-xl px-4 py-3 shadow-xl text-sm animate-fade-in max-w-[calc(100vw-2rem)] w-max">
      <span className="text-white">Install Varus Music for offline playback</span>
      <button
        onClick={handleInstall}
        className="bg-spotify-green hover:bg-green-400 text-black font-bold px-3 py-1 rounded-full text-xs transition-colors"
      >
        Install
      </button>
      <button onClick={() => setVisible(false)} className="text-spotify-lightgray hover:text-white">✕</button>
    </div>
  )
}
