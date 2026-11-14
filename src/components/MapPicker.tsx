import L from 'leaflet'
import { useEffect } from 'react'
import { LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(16,185,129,.8)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ lat, lon, flyKey }: { lat: number; lon: number; flyKey: number }) {
  const map = useMap()
  useEffect(() => {
    if (flyKey) map.flyTo([lat, lon], 7, { duration: 1.2 })
    // Only fly when a hub is chosen, not on every map click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey])
  return null
}

export function MapPicker(props: { lat: number; lon: number; flyKey: number; onPick: (lat: number, lon: number) => void }) {
  return (
    <MapContainer center={[props.lat, props.lon]} zoom={5} className="h-[340px] w-full rounded-xl" zoomControl>
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
      <Marker position={[props.lat, props.lon]} icon={pinIcon} />
      <ClickHandler onPick={props.onPick} />
      <FlyTo lat={props.lat} lon={props.lon} flyKey={props.flyKey} />
    </MapContainer>
  )
}
