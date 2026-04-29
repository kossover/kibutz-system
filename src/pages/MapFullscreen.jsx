// src/pages/MapFullscreen.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import { MapPin, Filter, Layers, Crosshair, List, Search, X as CloseIcon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Emoji icon helper - Purim update: handles numbers with festive styling
const getEmojiIcon = (emoji) => {
    const isNumber = !isNaN(emoji) && String(emoji).trim() !== '';

    if (isNumber) {
        return L.divIcon({
            className: 'custom-icon',
            html: `<div style="
                width: 22px;
                height: 22px;
                background: linear-gradient(135deg, #FF9D00, #FF6A00);
                border: 1.5px solid white;
                border-radius: 50%;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 900;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${emoji}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    }

    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="
            font-size: 30px;
            text-align: center;
            line-height: 1;
            filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
        ">${emoji || '📍'}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    });
};

// User location icon
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

function MapFullscreen() {
    const [loading, setLoading] = useState(true);
    const [points, setPoints] = useState([]);
    const [filteredPoints, setFilteredPoints] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [map, setMap] = useState(null);
    const [showList, setShowList] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const kibbutzCenter = [32.588925, 35.553405];

    useEffect(() => {
        loadData();
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

    const loadData = async () => {
        try {
            const [pointsSnap, catsSnap] = await Promise.all([
                getDocs(collection(db, 'mapPoints')),
                getDocs(collection(db, 'mapCategories'))
            ]);

            const pointsData = pointsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            const categoriesData = catsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setPoints(pointsData);
            setFilteredPoints(pointsData); // אתחול נקודות מסוננות
            setCategories(categoriesData);
            setLoading(false);
        } catch (error) {
            console.error('Error loading map data:', error);
            setLoading(false);
        }
    };

    const centerOnUser = () => {
        if (userLocation && map) {
            map.flyTo(userLocation, 18);
        }
    };

    const getCategoryEmoji = (categoryName) => {
        const category = categories.find(cat => cat.name === categoryName);
        return category?.emoji || '📍';
    };

    const goToPoint = (point) => {
        if (map) {
            map.flyTo([point.lat, point.lng], 19, {
                duration: 1.5
            });
            setShowList(false);

            // פתיחת פופאפ אוטומטית לנקודה שנבחרה
            setTimeout(() => {
                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker) {
                        const latLng = layer.getLatLng();
                        if (latLng.lat === point.lat && latLng.lng === point.lng) {
                            layer.openPopup();
                        }
                    }
                });
            }, 1600);
        }
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
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>טוען מפה...</div>
            </div>
        );
    }

    return (
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
            <style>{`
        .leaflet-container { height: 100%; width: 100%; z-index: 0; }
        .custom-icon { background: none; border: none; }
        .user-location-icon { background: none; border: none; }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          70% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .purim-header {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1500;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(8px);
            padding: 8px 24px;
            border-bottom-left-radius: 20px;
            border-bottom-right-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 12px;
            white-space: nowrap;
            border: 2px solid #FF9D00;
            border-top: none;
        }
        .confetti {
            position: fixed;
            width: 10px;
            height: 10px;
            background-color: #f2d74e;
            position: absolute;
            z-index: 1001;
            top: -10px;
            border-radius: 50%;
            animation: fall var(--fall-duration) linear infinite;
        }
        @keyframes fall {
            to { transform: translateY(105vh) rotate(360deg); }
        }
        .points-list-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
        .sidebar {
            position: absolute;
            top: 0;
            right: 0;
            width: 300px;
            max-width: 85vw;
            height: 100%;
            background: white;
            z-index: 2000;
            box-shadow: -4px 0 15px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
        }
      `}</style>


            {/* Floating Filter Button */}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #6e2da8, #a855f7)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '30px',
                        boxShadow: '0 4px 12px rgba(110, 45, 168, 0.3)',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Search size={20} />
                    איפה יש הפתעות?
                </button>
            </div>

            {/* Points Sidebar Modal */}
            {showFilters && (
                <div className="sidebar" style={{ position: 'fixed', zIndex: 3000 }}>
                    <div style={{
                        padding: '16px',
                        background: 'linear-gradient(135deg, #6e2da8, #a855f7)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>איפה יש הפתעות? 🎁</h2>
                        <button
                            onClick={() => setShowFilters(false)}
                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
                        >
                            <CloseIcon size={24} />
                        </button>
                    </div>

                    <div style={{ padding: '12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                type="text"
                                placeholder="חפש לפי שם או מספר..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 36px 8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '14px',
                                    direction: 'rtl'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {points
                            .filter(p => {
                                // בדיקה אם הקטגוריה היא מספר (שם קטגוריה או האייקון שלה)
                                const catName = String(p.category || '');
                                const catEmoji = getCategoryEmoji(p.category);
                                const isNumber = (val) => val && !isNaN(val) && String(val).trim() !== '';

                                const isNumberedStation = isNumber(catName) || isNumber(catEmoji);

                                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    catName.toLowerCase().includes(searchTerm.toLowerCase());

                                return isNumberedStation && matchesSearch;
                            })
                            .sort((a, b) => {
                                const numA = parseInt(a.category) || parseInt(getCategoryEmoji(a.category));
                                const numB = parseInt(b.category) || parseInt(getCategoryEmoji(b.category));
                                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                                return a.name.localeCompare(b.name);
                            })
                            .map(point => {
                                const emoji = getCategoryEmoji(point.category);
                                return (
                                    <button
                                        key={point.id}
                                        onClick={() => {
                                            goToPoint(point);
                                            setShowFilters(false);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            textAlign: 'right',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid #f3f4f6',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            background: 'linear-gradient(135deg, #FF9D00, #FF6A00)',
                                            borderRadius: '50%',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '14px',
                                            flexShrink: 0
                                        }}>
                                            {emoji && !isNaN(emoji) ? emoji : point.category}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--text-primary)' }}>{point.name}</div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Bottom Left Controls */}
            <div style={{ position: 'absolute', bottom: '24px', left: '12px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userLocation && (
                    <button
                        onClick={centerOnUser}
                        style={{
                            padding: '12px',
                            background: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3B82F6'
                        }}
                        title="מרכז על המיקום שלי"
                    >
                        <Crosshair size={24} />
                    </button>
                )}
            </div>


            {/* Map Container */}
            <MapContainer
                center={kibbutzCenter}
                zoom={17}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false} // Clean look
                ref={setMap}
            >
                <LayersControl position="bottomright">
                    <LayersControl.BaseLayer checked name="מפה">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="לוויין">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {userLocation && (
                    <Marker position={userLocation} icon={getUserLocationIcon()}>
                        <Popup>אתה כאן</Popup>
                    </Marker>
                )}

                {filteredPoints.map(point => (
                    <Marker
                        key={point.id}
                        position={[point.lat, point.lng]}
                        icon={getEmojiIcon(getCategoryEmoji(point.category))}
                    >
                        <Popup>
                            <div style={{ direction: 'rtl', textAlign: 'right' }}>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{point.name}</h3>
                                <div style={{ fontSize: '12px', color: '#666' }}>{point.category}</div>
                                {point.description && <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>{point.description}</p>}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

export default MapFullscreen;
