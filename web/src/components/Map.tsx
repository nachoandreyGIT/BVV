'use client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Animated icons for PENDING alerts
const fireIconActive = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 60px; line-height: 60px; animation: pulse 1.5s infinite; text-shadow: 0 0 10px red;">⚠️</div>`,
  iconSize: [60, 60],
  iconAnchor: [30, 30],
  popupAnchor: [0, -30]
});

const accidentIconActive = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 60px; line-height: 60px; animation: pulse 1.5s infinite; text-shadow: 0 0 10px orange;">⚠️</div>`,
  iconSize: [60, 60],
  iconAnchor: [30, 30],
  popupAnchor: [0, -30]
});

// Static icons for ATTENDED/CLOSED alerts
const fireIconStatic = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 40px; line-height: 40px; opacity: 0.6;">📍</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const accidentIconStatic = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="font-size: 40px; line-height: 40px; opacity: 0.6;">📍</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

interface MapProps {
  alerts: Array<{
    id: string;
    lat: number;
    lng: number;
    type: 'fire' | 'accident';
    estado: string;
    user: string;
    phone: string;
    address: string;
  }>;
}

export default function Map({ alerts }: MapProps) {
  // Centro aproximado de Verónica, Punta Indio
  const position: [number, number] = [-35.3855, -57.3400];

  return (
    <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
      {/* Usamos un mapa oscuro de CartoDB para que combine con el tema del cuartel */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      {alerts.map((alert) => (
        <Marker 
          key={alert.id} 
          position={[alert.lat, alert.lng]} 
          icon={
            alert.estado === 'Pendiente'
              ? (alert.type === 'fire' ? fireIconActive : accidentIconActive)
              : (alert.type === 'fire' ? fireIconStatic : accidentIconStatic)
          }
        >
          <Popup>
            <div style={{ padding: '5px', minWidth: '200px' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '16px', color: alert.type === 'fire' ? '#ef4444' : '#f97316', marginBottom: '8px', marginTop: 0 }}>
                {alert.type === 'fire' ? '🔴 INCENDIO' : '🟠 SINIESTRO'} 
                {alert.estado !== 'Pendiente' && <span style={{fontSize: '12px', color: '#94a3b8', marginLeft: '10px'}}>({alert.estado})</span>}
              </h3>
              <p style={{ margin: '4px 0' }}><strong>Vecino:</strong> {alert.user}</p>
              <p style={{ margin: '4px 0' }}><strong>Tel:</strong> {alert.phone}</p>
              <p style={{ margin: '4px 0' }}><strong>Vivienda:</strong> {alert.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
