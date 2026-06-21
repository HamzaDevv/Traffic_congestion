import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

// Design system risk token colors for heatmap gradient
const HEAT_GRADIENT = {
  0.0: '#10B981', // risk-low
  0.3: '#F59E0B', // risk-moderate
  0.6: '#EF4444', // risk-high
  1.0: '#DC2626', // risk-critical
}

export default function HeatmapLayer({ data }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!map) return

    // Remove previous layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (!data || data.length === 0) return

    // data is [[lat, lon, intensity], ...]
    const heat = L.heatLayer(data, {
      radius: 22,
      blur: 18,
      maxZoom: 14,
      max: 1.0,
      gradient: HEAT_GRADIENT,
      minOpacity: 0.4,
    })

    heat.addTo(map)
    layerRef.current = heat

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
      }
    }
  }, [map, data])

  return null
}
