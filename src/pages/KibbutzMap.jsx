// src/pages/KibbutzMap.jsx - עדכון: הוספת תצוגת לוויין
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { MapPin, Filter, X, Layers, Maximize, Minimize } from 'lucide-react';
import BackButton from '../components/BackButton';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// תיקון בעיית אייקונים של Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// אייקון עם אימוג'י (כמו בממשק הניהול)
const getEmojiIcon = (emoji) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="
      font-size: 28px;
      text-align: center;
      line-height: 1;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
    ">${emoji || '📍'}</div>`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
    popupAnchor: [0, -35]
  });
};

// אייקון למיקום נוכחי
const getUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-icon',
    html: `<div style="
      width: 20px;
      height: 20px;
      background-color: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: #3B82F6;
        border-radius: 50%;
        animation: pulse 2s infinite;
        opacity: 0.5;
        top: 0;
        left: 0;
        transform: scale(1);
      "></div>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

function KibbutzMap() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [filteredPoints, setFilteredPoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const kibbutzCenter = [32.588925, 35.553405];

  useEffect(() => {
    checkAccess();
    loadPoints();
    loadCategories();
    const watchId = startTrackingLocation();

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const startTrackingLocation = () => {
    if ('geolocation' in navigator) {
      return navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
    return null;
  };

  useEffect(() => {
    applyFilters();
  }, [points, selectedCategory]);

  const checkAccess = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    setLoading(false);
  };

  const loadPoints = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mapPoints'));
      const pointsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPoints(pointsData);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mapCategories'));
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCategoryEmoji = (categoryName) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.emoji || '📍';
  };

  const applyFilters = () => {
    let result = [...points];

    if (selectedCategory) {
      result = result.filter(point => point.category === selectedCategory);
    }

    setFilteredPoints(result);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 0, maxWidth: '100%' }}>
      <style>{`
        .leaflet-container {
          height: 100%;
          width: 100%;
          z-index: 0;
        }
        .custom-icon {
          background: none;
          border: none;
        }
        .user-location-icon {
          background: none;
          border: none;
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          70% {
            transform: scale(2.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'white',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title" style={{ margin: 0 }}>מפת הקיבוץ</h1>

        </div>

        {/* Filters */}
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 16px',
              background: showFilters ? 'var(--primary-color)' : 'var(--bg-secondary)',
              color: showFilters ? 'white' : 'var(--text-primary)',
              border: showFilters ? 'none' : '2px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Filter size={16} />
            סינון לפי קטגוריה
          </button>

          {showFilters && (
            <div style={{
              marginTop: '12px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setSelectedCategory('')}
                style={{
                  padding: '6px 12px',
                  background: !selectedCategory ? 'var(--primary-color)' : 'white',
                  color: !selectedCategory ? 'white' : 'var(--text-primary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                הכל ({points.length})
              </button>
              {categories.map(cat => {
                const count = points.filter(p => p.category === cat.name).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      padding: '6px 12px',
                      background: selectedCategory === cat.name ? 'var(--primary-color)' : 'white',
                      color: selectedCategory === cat.name ? 'white' : 'var(--text-primary)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{cat.emoji || '📍'}</span>
                    <span>{cat.name} ({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            מציג {filteredPoints.length} מתוך {points.length} נקודות
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{
        height: isFullscreen ? '100vh' : 'calc(100vh - 250px)',
        minHeight: isFullscreen ? '100vh' : '400px',
        width: isFullscreen ? '100vw' : '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 10,
        background: 'white'
      }}>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10000,
            background: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
          title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
        {filteredPoints.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <MapPin size={64} color="var(--text-secondary)" />
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                {points.length === 0 ? 'אין נקודות במפה' : 'לא נמצאו נקודות בקטגוריה זו'}
              </p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={kibbutzCenter}
            zoom={17}
            style={{ height: '100%', width: '100%' }}
          >
            <LayersControl position="topleft">
              <LayersControl.BaseLayer checked name="מפת רחובות">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="תצלום לוויין">
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {userLocation && (
              <Marker position={userLocation} icon={getUserLocationIcon()}>
                <Popup>
                  <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    אתה כאן
                  </div>
                </Popup>
              </Marker>
            )}

            {filteredPoints.map(point => (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={getEmojiIcon(getCategoryEmoji(point.category))}
              >
                <Popup>
                  <div style={{ direction: 'rtl', minWidth: '200px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {point.name}
                    </h3>
                    {point.category && (
                      <div style={{
                        padding: '4px 8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        display: 'inline-block',
                        marginBottom: '8px'
                      }}>
                        {getCategoryEmoji(point.category)} {point.category}
                      </div>
                    )}
                    {point.description && (
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {point.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <a href={`https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '6px', background: '#e0f2fe', color: '#0369a1', textAlign: 'center', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>Waze</a>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '6px', background: '#d1fae5', color: '#047857', textAlign: 'center', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}>Google</a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
      <BackButton pageKey="map" />
    </div>
  );
}

export default KibbutzMap;