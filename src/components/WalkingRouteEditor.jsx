import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Trash, PencilSimple, X, MapTrifold as MapIcon, Path } from '@phosphor-icons/react';

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getEmojiIcon = (emoji) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="font-size: 24px; text-align: center; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">${emoji || '📍'}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

function MapClickHandler({ mode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (mode !== 'view') {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

export default function WalkingRouteEditor({ path = [], waypoints = [], onChange }) {
  const [mode, setMode] = useState('view'); // 'view', 'draw', 'waypoint'
  const [editingWaypoint, setEditingWaypoint] = useState(null);
  
  const kibbutzCenter = path.length > 0 ? path[0] : [32.588925, 35.553405];

  const handleMapClick = (latlng) => {
    if (mode === 'draw') {
      onChange({ path: [...path, [latlng.lat, latlng.lng]], waypoints });
    } else if (mode === 'waypoint') {
      const newWaypoint = {
        id: Date.now().toString(),
        lat: latlng.lat,
        lng: latlng.lng,
        title: 'נקודה חדשה',
        description: '',
        emoji: '📍'
      };
      onChange({ path, waypoints: [...waypoints, newWaypoint] });
      setEditingWaypoint(newWaypoint);
      setMode('view'); // switch back after placing
    }
  };

  const handleWaypointUpdate = (id, field, value) => {
    const newWaypoints = waypoints.map(wp => 
      wp.id === id ? { ...wp, [field]: value } : wp
    );
    onChange({ path, waypoints: newWaypoints });
  };

  const handleDeleteWaypoint = (id) => {
    onChange({ path, waypoints: waypoints.filter(wp => wp.id !== id) });
    if (editingWaypoint?.id === id) setEditingWaypoint(null);
  };

  const handleDeleteLastPathPoint = () => {
    if (path.length > 0) {
      onChange({ path: path.slice(0, -1), waypoints });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style>{`
        .leaflet-container { z-index: 0; }
        .custom-icon { background: none; border: none; }
      `}</style>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button 
          type="button"
          onClick={() => setMode(mode === 'draw' ? 'view' : 'draw')}
          className={`btn ${mode === 'draw' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', padding: '8px 12px' }}
        >
          {mode === 'draw' ? '🛑 הפסק שרטוט מסלול' : '✍️ שרטט מסלול (לחץ על המפה)'}
        </button>
        <button 
          type="button"
          onClick={() => setMode(mode === 'waypoint' ? 'view' : 'waypoint')}
          className={`btn ${mode === 'waypoint' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ width: 'auto', padding: '8px 12px' }}
        >
          {mode === 'waypoint' ? '🛑 הפסק הוספת נקודה' : '📍 הוסף נקודת ציון למסלול'}
        </button>
        {path.length > 0 && (
          <button 
            type="button"
            onClick={handleDeleteLastPathPoint}
            className="btn btn-secondary text-red-500"
            style={{ width: 'auto', padding: '8px 12px' }}
          >
            ↩️ מחק נקודת מסלול אחרונה
          </button>
        )}
      </div>

      <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
        <MapContainer center={kibbutzCenter} zoom={16} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topleft">
            <LayersControl.BaseLayer checked name="מפת רחובות">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="תצלום לוויין">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapClickHandler mode={mode} onMapClick={handleMapClick} />

          {path.length > 0 && (
            <Polyline positions={path} color="#3B82F6" weight={5} opacity={0.7} dashArray="10, 10" />
          )}

          {waypoints.map(wp => (
            <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={getEmojiIcon(wp.emoji)}>
              <Popup>
                <div style={{ direction: 'rtl', minWidth: '150px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{wp.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px' }}>{wp.description}</p>
                  <button 
                    type="button"
                    onClick={() => setEditingWaypoint(wp)}
                    style={{ marginTop: '8px', width: '100%', padding: '4px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ערוך נקודה
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Waypoints Editor */}
      {waypoints.length > 0 && (
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '12px' }}>נקודות ציון במסלול</h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            {waypoints.map(wp => (
              <div key={wp.id} style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={wp.emoji} 
                    onChange={e => handleWaypointUpdate(wp.id, 'emoji', e.target.value)}
                    style={{ width: '40px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    title="אימוג'י"
                  />
                  <input 
                    type="text" 
                    value={wp.title} 
                    onChange={e => handleWaypointUpdate(wp.id, 'title', e.target.value)}
                    style={{ flex: 1, padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    placeholder="שם הנקודה"
                  />
                  <button 
                    type="button" 
                    onClick={() => handleDeleteWaypoint(wp.id)}
                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
                <textarea 
                  value={wp.description} 
                  onChange={e => handleWaypointUpdate(wp.id, 'description', e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', minHeight: '60px' }}
                  placeholder="הסבר על הנקודה..."
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
