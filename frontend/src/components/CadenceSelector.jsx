import { useState, useEffect } from 'react'
import { fetchCadence, updateCadence } from '../services/api.js'

export default function CadenceSelector() {
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
    </div>
  )
}
