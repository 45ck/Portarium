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
import type { RobotStatus, RobotClass } from '@/types/robotics';
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

export const STATUS_COLORS: Record<RobotStatus, string> = {
  Online: '#22c55e',
  Degraded: '#eab308',
  'E-Stopped': '#ef4444',
  Offline: '#9ca3af',
};

const CLASS_GLYPHS: Record<RobotClass, string> = {
  AMR: 'R',
  AGV: 'A',
  Manipulator: 'M',
  UAV: 'U',
  PLC: 'P',
};

function robotIcon(
  status: RobotStatus,
  robotClass: RobotClass,
  name: string,
  isSelected: boolean,
): L.DivIcon {
  const color = STATUS_COLORS[status];
  const size = isSelected ? 32 : 24;
  const glyph = CLASS_GLYPHS[robotClass];
  const border = isSelected ? `3px solid ${color}` : `2px solid ${color}`;
  const shadow = isSelected ? '0 0 10px rgba(0,0,0,0.4)' : '0 0 4px rgba(0,0,0,0.3)';
  const fontSize = isSelected ? 13 : 10;
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
      <div style="
        width:${size}px;height:${size}px;border-radius:6px;
        background:var(--card);border:${border};
        box-shadow:${shadow};
        display:flex;align-items:center;justify-content:center;
        font-size:${fontSize}px;font-weight:700;color:${color};
        font-family:system-ui,sans-serif;
      ">${glyph}</div>
      <div style="
        margin-top:2px;font-size:9px;font-weight:600;
        color:var(--card-foreground);background:var(--card);
        padding:0 3px;border-radius:2px;white-space:nowrap;
        max-width:80px;overflow:hidden;text-overflow:ellipsis;
        text-align:center;line-height:1.3;
      ">${name}</div>
    </div>`,
    iconSize: [size, size + 16],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitAllControl({ locations }: { locations: RobotLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const btn = L.DomUtil.create('a', '', container);
    btn.href = '#';
    btn.title = 'Fit all robots';
    btn.innerHTML = '&#x2922;'; // ⤢ expand icon
    btn.style.cssText =
      'display:flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:18px;text-decoration:none;color:var(--card-foreground);background:var(--card);';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Fit all robots in view');

    const control = L.Control.extend({
      options: { position: 'topleft' as const },
      onAdd: () => container,
    });
    const ctrl = new control();
    ctrl.addTo(map);

    const handleClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (locations.length > 0) {
        const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    };
    btn.addEventListener('click', handleClick);
    return () => {
      btn.removeEventListener('click', handleClick);
      ctrl.remove();
    };
  }, [map, locations]);
  return null;
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
        <FitAllControl locations={locations} />

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
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{gf.label}</span>
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
            icon={robotIcon(loc.status, loc.robotClass, loc.name, loc.robotId === selectedRobotId)}
            eventHandlers={{
              click: () => onSelectRobot(loc.robotId),
            }}
          >
            <Popup>
              <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{loc.name}</p>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>{loc.robotId}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: STATUS_COLORS[loc.status],
                    }}
                  />
                  {loc.status}
                </div>
                <p style={{ fontSize: '0.75rem', margin: 0 }}>Battery: {loc.batteryPct}%</p>
                {loc.missionId && (
                  <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>
                    Mission: {loc.missionId}
                  </p>
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
