import { useState, useEffect } from 'react'
import { fetchCadence, updateCadence, rotatePlaylist } from '../services/api.js'

export default function CadenceSelector() {
  const [cadence, setCadence] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    fetchCadence()
      .then(setCadence)
      .catch(console.error)
  }, [])

  async function handleChange(e) {
    const interval = e.target.value
    setSaving(true)
    try {
      const updated = await updateCadence(interval)
      setCadence(updated)
    } catch (err) {
      console.error('Failed to update cadence:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleRotate() {
    setRotating(true)
    try {
      const result = await rotatePlaylist()
      // Update the displayed nextRun without a full page reload
      if (result.nextRun) setCadence((prev) => prev ? { ...prev, nextRun: result.nextRun } : prev)
      // Reload the page playlist — bubble up via a page-level event so App re-fetches
      window.dispatchEvent(new CustomEvent('varus:rotate'))
    } catch (err) {
      console.error('Failed to rotate playlist:', err)
    } finally {
      setRotating(false)
    }
  }

  if (!cadence) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-spotify-lightgray">Cycle:</span>
      <select
        value={cadence.interval}
        onChange={handleChange}
        disabled={saving}
        className="bg-spotify-gray text-white border border-spotify-lightgray rounded px-2 py-1 text-sm focus:outline-none focus:border-spotify-green"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      {cadence.nextRun && (
        <span className="text-xs text-spotify-lightgray hidden lg:inline">
          Next: {new Date(cadence.nextRun).toLocaleDateString()}
        </span>
      )}
      <button
        onClick={handleRotate}
        disabled={rotating}
        title="Rotate now — generates a fresh playlist and resets your cadence timer"
        aria-label="Rotate playlist now"
        className="text-spotify-lightgray hover:text-white p-1 rounded transition-colors disabled:opacity-40"
      >
        {rotating ? (
          <span className="animate-spin inline-block">↻</span>
        ) : (
          <RotateIcon />
        )}
      </button>
    </div>
  )
}

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3" />
    </svg>
  )
}
