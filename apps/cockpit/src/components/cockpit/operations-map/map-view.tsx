import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polygon,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RobotLocation, Geofence } from '@/mocks/fixtures/robot-locations';
import type { RobotStatus } from '@/types/robotics';
import { cn } from '@/lib/utils';
import { LayerToggles, type LayerVisibility } from './layer-toggles';

// Fix default marker icon paths for bundlers (guarded for JSDOM/SSR)
if (typeof window !== 'undefined' && L.Icon?.Default?.prototype) {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

const STATUS_COLORS: Record<RobotStatus, string> = {
  Online: '#22c55e',
  Degraded: '#eab308',
  'E-Stopped': '#ef4444',
  Offline: '#9ca3af',
};

function robotIcon(status: RobotStatus, isSelected: boolean): L.DivIcon {
  const color = STATUS_COLORS[status];
  const size = isSelected ? 18 : 12;
  const border = isSelected ? '3px solid white' : '2px solid white';
  const shadow = isSelected ? '0 0 8px rgba(0,0,0,0.4)' : '0 0 4px rgba(0,0,0,0.3)';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:${border};
      box-shadow:${shadow};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyToSelected({
  selectedId,
  locations,
}: {
  selectedId: string | null;
  locations: RobotLocation[];
}) {
  const map = useMap();
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedId.current) {
      const loc = locations.find((l) => l.robotId === selectedId);
      if (loc) {
        map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
      }
    }
    prevSelectedId.current = selectedId;
  }, [selectedId, locations, map]);

  return null;
}

interface MapViewProps {
  locations: RobotLocation[];
  geofences: Geofence[];
  selectedRobotId: string | null;
  onSelectRobot: (robotId: string | null) => void;
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
}

export function MapView({
  locations,
  geofences,
  selectedRobotId,
  onSelectRobot,
  layers,
  onLayersChange,
}: MapViewProps) {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[47.6062, -122.3321]}
        zoom={13}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FlyToSelected selectedId={selectedRobotId} locations={locations} />

        {/* Geofence polygons */}
        {layers.geofences &&
          geofences.map((gf) => (
            <Polygon
              key={gf.geofenceId}
              positions={gf.polygon}
              pathOptions={{
                color: gf.color,
                weight: 2,
                fillOpacity: 0.1,
                dashArray: '5 5',
              }}
            >
              <Popup>
                <span className="text-sm font-medium">{gf.label}</span>
              </Popup>
            </Polygon>
          ))}

        {/* Uncertainty halos */}
        {layers.halos &&
          locations
            .filter((loc) => loc.status === 'Degraded' || loc.status === 'E-Stopped')
            .map((loc) => (
              <Circle
                key={`halo-${loc.robotId}`}
                center={[loc.lat, loc.lng]}
                radius={80}
                pathOptions={{
                  color: STATUS_COLORS[loc.status],
                  weight: 1,
                  fillOpacity: 0.08,
                }}
              />
            ))}

        {/* Trails */}
        {layers.trails &&
          locations
            .filter((loc) => loc.trail.length > 1)
            .map((loc) => (
              <Polyline
                key={`trail-${loc.robotId}`}
                positions={loc.trail.map((t) => [t.lat, t.lng] as [number, number])}
                pathOptions={{
                  color: STATUS_COLORS[loc.status],
                  weight: 2,
                  opacity: 0.4,
                  dashArray: '4 4',
                }}
              />
            ))}

        {/* Robot markers */}
        {locations.map((loc) => (
          <Marker
            key={loc.robotId}
            position={[loc.lat, loc.lng]}
            icon={robotIcon(loc.status, loc.robotId === selectedRobotId)}
            eventHandlers={{
              click: () => onSelectRobot(loc.robotId),
            }}
          >
            <Popup>
              <div className="space-y-1 min-w-[140px]">
                <p className="font-semibold text-sm">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.robotId}</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className={cn('inline-block h-2 w-2 rounded-full')}
                    style={{ backgroundColor: STATUS_COLORS[loc.status] }}
                  />
                  {loc.status}
                </div>
                <p className="text-xs">Battery: {loc.batteryPct}%</p>
                {loc.missionId && (
                  <p className="text-xs text-muted-foreground">Mission: {loc.missionId}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Layer toggles overlay */}
      <div className="absolute top-3 right-3 z-[1000]">
        <LayerToggles layers={layers} onChange={onLayersChange} />
      </div>
    </div>
  );
}
