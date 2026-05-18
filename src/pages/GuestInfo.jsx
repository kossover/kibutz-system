import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { MapPin, Clock, CalendarBlank, Storefront, Coffee, MapTrifold as MapIcon, PersonSimpleWalk, Bicycle, Ruler } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Polyline } from 'react-leaflet';
import BackButton from '../components/BackButton';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
    html: `<div style="font-size: 28px; text-align: center; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">${emoji || '📍'}</div>`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
    popupAnchor: [0, -35]
  });
};

const calculateRouteStats = (path) => {
  if (!path || path.length < 2) return null;
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = L.latLng(path[i].lat, path[i].lng);
    const p2 = L.latLng(path[i+1].lat, path[i+1].lng);
    totalDistance += p1.distanceTo(p2);
  }
  
  const distanceStr = totalDistance < 1000 
    ? `${Math.round(totalDistance)} מטרים` 
    : `${(totalDistance / 1000).toFixed(2)} ק"מ`;
    
  const walkMins = Math.ceil(totalDistance / 83.3); // 5km/h
  const bikeMins = Math.ceil(totalDistance / 250); // 15km/h
  
  return { distance: distanceStr, walkTime: walkMins, bikeTime: bikeMins };
};

function GuestInfo() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [mapCategories, setMapCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const kibbutzCenter = [32.588925, 35.553405];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch guest info
        const docRef = doc(db, 'settings', 'guestInfo');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
            setData({ generalInfo: "ברוכים הבאים!", facilities: [], attractions: [], restaurants: [], events: [] });
        }

        // Fetch upcoming public events
        const q = query(
          collection(db, 'events'),
          where('date', '>=', new Date().toISOString().split('T')[0]),
          orderBy('date', 'asc'),
          limit(5)
        );
        const eventsSnap = await getDocs(q);
        const upcoming = [];
        eventsSnap.forEach(doc => {
          upcoming.push({ id: doc.id, ...doc.data() });
        });
        setEvents(upcoming);

        // Fetch map points & categories
        const pointsSnap = await getDocs(collection(db, 'mapPoints'));
        setMapPoints(pointsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const catsSnap = await getDocs(collection(db, 'mapCategories'));
        setMapCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error("Error fetching guest info", err);
        setData({ generalInfo: "ברוכים הבאים!", facilities: [], attractions: [], restaurants: [], events: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCategoryEmoji = (categoryName) => {
    const category = mapCategories.find(cat => cat.name === categoryName);
    return category?.emoji || '📍';
  };

  if (loading) return <div className="loading"><div>טוען נתונים...</div></div>;
  if (!data) return <div className="text-center p-8 text-xl font-bold">לא נמצא מידע לאורחים.</div>;

  const hasSpecialEvents = data.events?.length > 0;
  const hasDynamicEvents = events.length > 0;

  return (
    <div className="pb-24 max-w-4xl mx-auto mt-4 px-4">
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
      `}</style>
      
      {/* Header Banner */}
      <div className="glass-card mb-8 p-8 text-center bg-gradient-to-r from-emerald-100 to-teal-50 border-emerald-200">
        <img src="/logo.png" alt="נווה אור" className="h-24 w-auto object-contain mx-auto mb-4 drop-shadow-md" />
        <h1 className="text-3xl font-black text-emerald-800 mb-2 drop-shadow-sm">ברוכים הבאים לנווה אור!</h1>
        <h2 className="text-xl font-bold text-emerald-700 mb-4">המקום הכי שווה לגור</h2>
        <p className="text-lg text-emerald-800 font-medium whitespace-pre-wrap">{data.generalInfo}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Facilities */}
        {data.facilities?.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <Storefront size={28} className="text-emerald-600" weight="fill" />
              מתקנים ושירותים
            </h2>
            {data.facilities.map(f => (
              <div key={f.id} className="glass-card p-5 hover:-translate-y-1 transition-transform border border-slate-200">
                <h3 className="text-xl font-bold mb-2 text-slate-800">{f.name}</h3>
                {f.hours && <div className="flex items-start gap-2 text-slate-600 mb-2 font-medium">
                  <Clock size={18} className="text-emerald-500 mt-0.5" /> 
                  <span className="whitespace-pre-wrap leading-relaxed">{f.hours}</span>
                </div>}
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Events */}
        {(hasSpecialEvents || hasDynamicEvents) && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <CalendarBlank size={28} className="text-emerald-600" weight="fill" />
              אירועים ופעילויות
            </h2>
            
            {/* Special JSON Events */}
            {data.events?.map(ev => (
              <div key={ev.id} className="glass-card p-5 hover:-translate-y-1 transition-transform border border-amber-200 bg-amber-50/50">
                <h3 className="text-xl font-bold mb-2 text-amber-900">{ev.name}</h3>
                <div className="flex flex-wrap gap-4 text-sm font-bold text-amber-700 mb-2">
                  {ev.date && <span className="flex items-center gap-1"><CalendarBlank size={16} /> {ev.date}</span>}
                  {ev.time && <span className="flex items-center gap-1"><Clock size={16} /> {ev.time}</span>}
                  {ev.location && <span className="flex items-center gap-1"><MapPin size={16} /> {ev.location}</span>}
                </div>
                <p className="text-amber-800/80 leading-relaxed whitespace-pre-wrap">{ev.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {ev.navLink && <a href={ev.navLink} target="_blank" rel="noreferrer" className="inline-block bg-amber-100 text-amber-800 font-bold px-4 py-2 rounded-lg text-sm hover:bg-amber-200 transition-colors">📍 פתח אפליקציית ניווט</a>}
                  {ev.website && <a href={ev.website} target="_blank" rel="noreferrer" className="inline-block bg-blue-100 text-blue-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-blue-200 transition-colors">🌐 לאתר האינטרנט</a>}
                </div>
              </div>
            ))}

            {/* Dynamic System Events */}
            {events.map(ev => (
              <div key={ev.id} className="glass-card p-5 cursor-pointer hover:-translate-y-1 transition-transform border border-emerald-100 bg-emerald-50/30" onClick={() => navigate(`/events/${ev.id}`)}>
                <h3 className="text-xl font-bold mb-2 text-slate-800">{ev.title}</h3>
                <div className="flex flex-wrap gap-4 text-sm font-medium text-emerald-700 mb-2">
                  <span className="flex items-center gap-1"><CalendarBlank size={16} /> {new Date(ev.date).toLocaleDateString('he-IL')}</span>
                  {ev.time && <span className="flex items-center gap-1"><Clock size={16} /> {ev.time}</span>}
                  {ev.location && <span className="flex items-center gap-1"><MapPin size={16} /> {ev.location}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kibbutz Map for Guests */}
        {mapPoints.length > 0 && (
          <div className="space-y-4 md:col-span-2 mt-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <MapIcon size={28} className="text-emerald-600" weight="fill" />
              מפת הקיבוץ
            </h2>
            <div className="glass-card overflow-hidden border border-slate-200 h-[400px]">
              <MapContainer center={kibbutzCenter} zoom={17} style={{ height: '100%', width: '100%' }}>
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
                {mapPoints.map(point => (
                  <Marker
                    key={point.id}
                    position={[point.lat, point.lng]}
                    icon={getEmojiIcon(getCategoryEmoji(point.category))}
                  >
                    <Popup>
                      <div style={{ direction: 'rtl', minWidth: '150px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{point.name}</h3>
                        {point.description && <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{point.description}</p>}
                        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
                          <a href={`https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`} target="_blank" rel="noreferrer" className="flex-1 bg-blue-50 text-blue-600 font-bold p-1.5 rounded text-center text-xs hover:bg-blue-100 border border-blue-100 transition-colors">Waze</a>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`} target="_blank" rel="noreferrer" className="flex-1 bg-emerald-50 text-emerald-600 font-bold p-1.5 rounded text-center text-xs hover:bg-emerald-100 border border-emerald-100 transition-colors">Google</a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {/* Walking Routes */}
        {data.walkingRoutes?.length > 0 && (
          <div className="space-y-4 md:col-span-2 mt-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <MapIcon size={28} className="text-emerald-600" weight="fill" />
              מסלולי הליכה
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {data.walkingRoutes.map(route => {
                const stats = calculateRouteStats(route.path);
                return (
                <div key={route.id} className="glass-card p-5 border border-slate-200">
                  <h3 className="text-xl font-bold mb-2 text-slate-800">{route.name}</h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">{route.description}</p>
                  
                  {stats && (
                    <div className="flex flex-wrap gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Ruler size={18} className="text-emerald-600" /> <span>{stats.distance}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <PersonSimpleWalk size={18} className="text-emerald-600" /> <span>כ-{stats.walkTime} דקות הליכה</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Bicycle size={18} className="text-emerald-600" /> <span>כ-{stats.bikeTime} דקות רכיבה</span>
                      </div>
                    </div>
                  )}

                  {route.path && route.path.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '300px' }}>
                      {(() => {
                        const allPoints = [
                          ...(route.path || []).map(p => [p.lat, p.lng]),
                          ...(route.waypoints || []).map(wp => [wp.lat, wp.lng])
                        ];
                        const bounds = allPoints.length > 1 ? L.latLngBounds(allPoints) : undefined;
                        
                        return (
                          <MapContainer 
                            bounds={bounds}
                            center={!bounds ? route.path[0] : undefined}
                            zoom={!bounds ? 16 : undefined}
                            style={{ height: '100%', width: '100%', zIndex: 0 }}
                            scrollWheelZoom={false}
                          >
                        <LayersControl position="topleft">
                          <LayersControl.BaseLayer name="מפת רחובות">
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          </LayersControl.BaseLayer>
                          <LayersControl.BaseLayer checked name="תצלום לוויין">
                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                          </LayersControl.BaseLayer>
                        </LayersControl>
                        
                        <Polyline positions={route.path} color="#3B82F6" weight={5} opacity={0.7} dashArray="10, 10" />
                        
                        {route.waypoints?.map(wp => (
                          <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={getEmojiIcon(wp.emoji)}>
                            <Popup>
                              <div style={{ direction: 'rtl', minWidth: '150px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{wp.title}</h3>
                                {wp.description && <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{wp.description}</p>}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                        );
                      })()}
                    </div>
                  )}
                  
                  {route.waypoints?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-bold text-slate-700 mb-2">נקודות ציון במסלול:</h4>
                      <div className="flex flex-col gap-2">
                        {route.waypoints.map(wp => (
                          <div key={wp.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3">
                            <div className="text-2xl mt-1">{wp.emoji}</div>
                            <div>
                              <div className="font-bold text-slate-800">{wp.title}</div>
                              <div className="text-sm text-slate-600">{wp.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Attractions */}
        {data.attractions?.length > 0 && (
          <div className="space-y-4 md:col-span-2 mt-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <MapPin size={28} className="text-emerald-600" weight="fill" />
              אטרקציות וטיולים באזור
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.attractions.map(a => (
                <div key={a.id} className="glass-card p-5 hover:-translate-y-1 transition-transform border border-slate-200">
                  <h3 className="text-xl font-bold mb-2 text-slate-800">{a.name}</h3>
                  {a.distance && <div className="flex items-center gap-2 text-slate-600 mb-2 font-medium">📍 {a.distance}</div>}
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{a.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {a.navLink && <a href={a.navLink} target="_blank" rel="noreferrer" className="inline-block bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-emerald-200 transition-colors">🚗 ניווט למקום</a>}
                    {a.website && <a href={a.website} target="_blank" rel="noreferrer" className="inline-block bg-blue-100 text-blue-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-blue-200 transition-colors">🌐 לאתר האינטרנט</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restaurants */}
        {data.restaurants?.length > 0 && (
          <div className="space-y-4 md:col-span-2 mt-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <Coffee size={28} className="text-emerald-600" weight="fill" />
              מסעדות מומלצות
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.restaurants.map(r => (
                <div key={r.id} className="glass-card p-5 hover:-translate-y-1 transition-transform border border-slate-200">
                  <h3 className="text-xl font-bold mb-3 text-slate-800">{r.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {r.type && <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-orange-200">{r.type}</span>}
                    {r.distance && <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200">📍 {r.distance}</span>}
                  </div>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{r.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {r.navLink && <a href={r.navLink} target="_blank" rel="noreferrer" className="inline-block bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-emerald-200 transition-colors">🚗 ניווט למקום</a>}
                    {r.website && <a href={r.website} target="_blank" rel="noreferrer" className="inline-block bg-blue-100 text-blue-700 font-bold px-4 py-2 rounded-lg text-sm hover:bg-blue-200 transition-colors">🌐 לאתר האינטרנט</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <BackButton pageKey="guests" />
    </div>
  );
}

export default GuestInfo;
