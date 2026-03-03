import { useState, useEffect } from 'react'
import { fetchCadence, updateCadence } from '../services/api.js'

/**
 * @param {{ onRotate: () => Promise<void>, isRotating: boolean }} props
 */
export default function CadenceSelector({ onRotate, isRotating }) {
  const [cadence, setCadence] = useState(null)
  const [saving, setSaving] = useState(false)

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
        onClick={onRotate}
        disabled={isRotating}
        title={isRotating ? 'Rotating playlist…' : 'Rotate now — generates a fresh playlist and resets your cadence timer'}
        aria-label="Rotate playlist now"
        className="text-spotify-lightgray hover:text-white p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateIcon spinning={isRotating} />
      </button>
    </div>
  )
}

function RotateIcon({ spinning }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : undefined}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3" />
    </svg>
  )
}
