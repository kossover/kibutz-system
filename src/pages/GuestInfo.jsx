import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { MapPin, Clock, CalendarBlank, Storefront, Coffee } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

function GuestInfo() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch guest info
        const docRef = doc(db, 'settings', 'guestInfo');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
            setData({ generalInfo: "ברוכים הבאים!", facilities: [], attractions: [], restaurants: [] });
        }

        // Fetch upcoming events
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
      } catch (err) {
        console.error("Error fetching guest info", err);
        setData({ generalInfo: "ברוכים הבאים!", facilities: [], attractions: [], restaurants: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading"><div>טוען נתונים...</div></div>;
  if (!data) return <div className="text-center p-8 text-xl font-bold">לא נמצא מידע לאורחים.</div>;

  return (
    <div className="pb-24 max-w-4xl mx-auto mt-4 px-4">
      {/* Header Banner */}
      <div className="glass-card mb-8 p-8 text-center bg-gradient-to-r from-emerald-100 to-teal-50 border-emerald-200">
        <h1 className="text-3xl font-black text-emerald-800 mb-4 drop-shadow-sm">ברוכים הבאים לנווה אור!</h1>
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
                {f.hours && <div className="flex items-center gap-2 text-slate-600 mb-2 font-medium"><Clock size={18} className="text-emerald-500" /> {f.hours}</div>}
                <p className="text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Events */}
        {events.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-slate-800">
              <CalendarBlank size={28} className="text-emerald-600" weight="fill" />
              אירועים קרובים
            </h2>
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
                  <p className="text-slate-600 leading-relaxed">{a.description}</p>
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
                  <p className="text-slate-600 leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default GuestInfo;
