import L from 'leaflet'
import { useEffect, useState } from 'react'
import { CircleMarker, LayersControl, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { LatLon } from '../engine/geo'

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(16,185,129,.8)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const GREEN = '#10b981'

export interface FlyTarget {
  lat: number
  lon: number
  zoom: number
  key: number
}

function MapEvents(p: { drawing: boolean; onPick: (lat: number, lon: number) => void; onAddPoint: (pt: LatLon) => void; onFinish: () => void; onZoom: (z: number) => void }) {
  const map = useMapEvents({
    click: (e) => (p.drawing ? p.onAddPoint([e.latlng.lat, e.latlng.lng]) : p.onPick(e.latlng.lat, e.latlng.lng)),
    dblclick: () => {
      if (p.drawing) p.onFinish()
    },
    zoomend: () => p.onZoom(map.getZoom()),
  })
  useEffect(() => {
    // Double-click finishes a boundary while drawing, so it mustn't also zoom.
    if (p.drawing) map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
    map.getContainer().style.cursor = p.drawing ? 'crosshair' : ''
  }, [p.drawing, map])
  return null
}

function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], target.zoom, { duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key])
  return null
}

function zoomLabel(z: number): { text: string; cls: string } {
  if (z >= 13) return { text: `Paddock level (zoom ${z})`, cls: 'text-emerald-400 font-bold' }
  if (z >= 9) return { text: `District view (zoom ${z})`, cls: 'text-cyan-400' }
  return { text: `Regional view (zoom ${z})`, cls: 'text-slate-400' }
}

export function MapPicker(props: {
  lat: number
  lon: number
  fly: FlyTarget | null
  drawing: boolean
  points: LatLon[]
  boundary: LatLon[] | null
  onPick: (lat: number, lon: number) => void
  onAddPoint: (pt: LatLon) => void
  onFinish: () => void
}) {
  const [zoom, setZoom] = useState(5)
  const zl = zoomLabel(zoom)
  return (
    <div className="relative">
      <MapContainer
        center={[props.lat, props.lon]}
        zoom={5}
        className="h-[460px] w-full rounded-xl"
        zoomControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street map">
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Place labels">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
          </LayersControl.Overlay>
        </LayersControl>

        {props.boundary && <Polygon positions={props.boundary} pathOptions={{ color: GREEN, weight: 3, fillColor: GREEN, fillOpacity: 0.3 }} />}
        {props.drawing && props.points.length >= 3 && <Polygon positions={props.points} pathOptions={{ color: GREEN, weight: 2, fillColor: GREEN, fillOpacity: 0.25 }} />}
        {props.drawing && props.points.length === 2 && <Polyline positions={props.points} pathOptions={{ color: GREEN, weight: 2.5, dashArray: '5 5' }} />}
        {props.drawing &&
          props.points.map((pt, i) => <CircleMarker key={i} center={pt} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: GREEN, fillOpacity: 1 }} />)}

        <Marker position={[props.lat, props.lon]} icon={pinIcon} />
        <MapEvents drawing={props.drawing} onPick={props.onPick} onAddPoint={props.onAddPoint} onFinish={props.onFinish} onZoom={setZoom} />
        <FlyTo target={props.fly} />
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-2 rounded-lg border border-space-700 bg-space-900/90 px-3 py-1.5 text-[11px] text-slate-300 shadow-lg">
        <span>{props.drawing ? 'Click each corner of your paddock, then Finish (or double-click)' : 'Click to drop the farm pin, or use Draw paddock to outline it'}</span>
        <span className="text-slate-500">|</span>
        <span className={`font-mono ${zl.cls}`}>{zl.text}</span>
      </div>
    </div>
  )
}
