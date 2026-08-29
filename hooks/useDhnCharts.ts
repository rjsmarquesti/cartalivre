import { useState, useEffect, useCallback, useRef } from 'react'
import { buildManifestFromImportedCharts } from '../lib/dhnManifest'
import { getVisibleCharts, type DhnChart, type DhnManifest, type ViewBounds } from '../lib/dhnCatalog'
import { subscribeCartasImportadas } from '../lib/cartasImportadas'

const DEBOUNCE_MS = 400
const MAX_VISIBLE_CHARTS = 10

export function useDhnCharts() {
  const [manifest, setManifest] = useState<DhnManifest | null>(null)
  const [visibleCharts, setVisibleCharts] = useState<DhnChart[]>([])
  const [loading, setLoading] = useState(true)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manifestRef = useRef<DhnManifest | null>(null)

  useEffect(() => {
    function load() {
      setLoading(true)
      const next = buildManifestFromImportedCharts()
      manifestRef.current = next
      setManifest(next)
      setLoading(false)
    }
    load()
    const unsubscribe = subscribeCartasImportadas(load)
    return () => {
      unsubscribe()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const onViewportChange = useCallback((bounds: ViewBounds, zoom: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const current = manifestRef.current
      setVisibleCharts(current ? getVisibleCharts(current, bounds, zoom).slice(0, MAX_VISIBLE_CHARTS) : [])
    }, DEBOUNCE_MS)
  }, [])

  return { manifest, visibleCharts, loading, onViewportChange }
}
