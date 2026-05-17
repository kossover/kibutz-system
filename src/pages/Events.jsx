import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  increment,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Calendar, Info, Clock, Flame, CalendarPlus, MapPin } from 'lucide-react';
import BackButton from '../components/BackButton';

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // רישומים קיימים של המשתמש: { [eventId]: { total, quantities, mode, id } }
  const [myRegs, setMyRegs] = useState({});
  // מונים מקומיים לפני שליחה/עדכון: { [eventId]: { total, [catKey]: number } }
  const [counters, setCounters] = useState({});
  const [savingId, setSavingId] = useState(null);

  // בדיקה אם המשתמש מחובר
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const userId = currentUser?.uid || null;
  const userDisplay = currentUser?.displayName || '';
  const userEmail = currentUser?.email || '';

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        const now = new Date();
        // מאפשרים אירועים מלפני שעתיים כדי לא להעלים אירוע שמתרחש כרגע
        const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        snap.forEach((d) => {
          const data = d.data();
          const date = data.date?.toDate();
          if (date && date >= cutoff) {
            arr.push({ id: d.id, ...data });
          }
        });
        setEvents(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  // האזן לכל הרישומים של המשתמש (רק אם מחובר)
  useEffect(() => {
    if (!userId) {
      setMyRegs({});
      return;
    }
    const qRegs = query(
      collection(db, 'eventRegistrations'),
      where('userId', '==', userId)
    );
    const unsub = onSnapshot(qRegs, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const r = d.data();
        map[r.eventId] = { ...r, id: d.id };
      });
      setMyRegs(map);
      // עדכן את המונים המקומיים לפי הרישומים הקיימים
      setCounters((prev) => {
        const next = { ...prev };
        Object.keys(map).forEach((evId) => {
          const r = map[evId];
          if (r.mode === 'single') {
            next[evId] = { ...(next[evId] || {}), total: Math.min(r.total || 0, 1) };
          } else if (r.mode === 'quantity') {
            next[evId] = { ...(next[evId] || {}), total: r.total || 0 };
          } else if (r.mode === 'categories') {
            const qts = r.quantities || {};
            next[evId] = { ...(next[evId] || {}) };
            Object.entries(qts).forEach(([k, v]) => { next[evId][k] = v || 0; });
          }
        });
        return next;
      });
    });
    return () => unsub();
  }, [userId]);

  const getRemaining = (ev) => {
    if (!ev?.maxParticipants) return null;
    const used = ev.currentParticipants || 0;
    return Math.max(ev.maxParticipants - used, 0);
  };

  const setCounter = (eventId, key, value) => {
    const v = Math.max(0, Number.isFinite(+value) ? +value : 0);
    setCounters((prev) => ({ ...prev, [eventId]: { ...(prev[eventId] || {}), [key]: v } }));
  };
  const adjustCounter = (eventId, key, delta) => {
    const cur = counters[eventId]?.[key] || 0;
    setCounter(eventId, key, cur + delta);
  };

  const calcTotals = (ev) => {
    const reg = ev.registration || {};
    const c = counters[ev.id] || {};
    if (reg.mode === 'single') {
      const t = Math.min(c.total || 0, 1);
      return { total: t, quantities: {} };
    }
    if (reg.mode === 'quantity') {
      const t = c.total || 0;
      return { total: t, quantities: { total: t } };
    }
    const enabled = (reg.categories || []).filter((x) => x.enabled);
    let sum = 0; const qts = {};
    enabled.forEach((cat) => {
      const n = c[cat.key] || 0;
      if (n > 0) { qts[cat.key] = n; sum += n; }
    });
    return { total: sum, quantities: qts };
  };

  const calcOldTotals = (ev) => {
    const r = myRegs[ev.id];
    if (!r) return { total: 0, quantities: {} };
    if (r.mode === 'single') return { total: Math.min(r.total || 0, 1), quantities: {} };
    if (r.mode === 'quantity') return { total: r.total || 0, quantities: { total: r.total || 0 } };
    const q = r.quantities || {};
    const total = Object.values(q).reduce((s, v) => s + (v || 0), 0);
    return { total, quantities: q };
  };

  const saveRegistration = async (ev) => {
    // בדיקה אם המשתמש מחובר
    if (!userId) {
      if (window.confirm('עליך להתחבר כדי להירשם לאירוע. לעבור למסך התחברות?')) {
        navigate('/login');
      }
      return;
    }

    const reg = ev.registration || {};
    if (!reg.required) return;

    const { total: newTotal, quantities: newQ } = calcTotals(ev);
    const { total: oldTotal, quantities: oldQ } = calcOldTotals(ev);

    if (newTotal < 1) {
      alert('נא לבחור לפחות משתתף אחד.');
      return;
    }

    // בדיקת קיבולת לפי דלתא
    const remaining = getRemaining(ev);
    const delta = newTotal - oldTotal;
    if (remaining !== null && delta > remaining) {
      alert(`נשארו ${remaining} מקומות פנויים בלבד`);
      return;
    }

    try {
      setSavingId(ev.id);
      const regId = `${ev.id}_${userId}`;
      await setDoc(doc(db, 'eventRegistrations', regId), {
        eventId: ev.id,
        userId,
        userDisplay,
        userEmail,
        mode: reg.mode || 'single',
        total: newTotal,
        quantities: newQ,
      }, { merge: true });

      // עדכון סטטוסין לפי דלתא
      const updates = { currentParticipants: increment(delta) };
      if (reg.mode === 'categories') {
        const keys = new Set([...Object.keys(newQ), ...Object.keys(oldQ)]);
        keys.forEach((k) => {
          const nd = (newQ[k] || 0) - (oldQ[k] || 0);
          if (nd !== 0) updates[`stats.${k}`] = increment(nd);
        });
      }
      await updateDoc(doc(db, 'events', ev.id), updates);

      alert('הרישום נשמר.');
    } catch (e) {
      console.error(e);
      alert('שגיאה בשמירת הרישום: ' + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const cancelRegistration = async (ev) => {
    if (!userId) {
      alert('עליך להתחבר כדי לבטל רישום.');
      return;
    }

    const r = myRegs[ev.id];
    if (!r) return;
    const reg = ev.registration || {};
    const { total: oldTotal, quantities: oldQ } = calcOldTotals(ev);

    if (!window.confirm('לבטל את הרישום לאירוע?')) return;

    try {
      setSavingId(ev.id);
      await deleteDoc(doc(db, 'eventRegistrations', r.id));

      const updates = { currentParticipants: increment(-oldTotal) };
      if (reg.mode === 'categories') {
        Object.entries(oldQ).forEach(([k, v]) => {
          if (v) updates[`stats.${k}`] = increment(-v);
        });
      }
      await updateDoc(doc(db, 'events', ev.id), updates);

      setCounters((prev) => ({ ...prev, [ev.id]: {} }));
      alert('הרישום בוטל.');
    } catch (e) {
      console.error(e);
      alert('שגיאה בביטול הרישום: ' + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const isThisWeek = (date) => {
    if (!date) return false;
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return date >= now && date <= nextWeek;
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-emerald-600 font-bold text-xl animate-pulse">טוען אירועים...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-32">
      <div className="flex justify-center mb-8">
        <img src="/tarbutenu.png" alt="תרבותנו" className="h-20 object-contain drop-shadow-xl" />
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tight">אירועים קרובים</h1>
        <div className="flex items-center gap-4">
          <a 
            href="https://tinyurl.com/tarbutneveur" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="glass-pill flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 border-emerald-200"
          >
            <CalendarPlus size={20} strokeWidth={2.5} />
            <span className="font-bold">הוסף יומן תרבותנו</span>
          </a>
          <BackButton pageKey="events" />
        </div>
      </div>

      {/* הודעה למשתמשים לא מחוברים */}
      {!userId && (
        <div className="glass-card bg-amber-50/50 border-amber-200 p-4 mb-8 flex items-start sm:items-center gap-4">
          <Info size={28} className="text-amber-500 shrink-0" strokeWidth={2.5} />
          <div className="text-slate-700 font-medium">
            <strong className="text-amber-700">צפייה באירועים פתוחה לכולם.</strong> להרשמה לאירוע יש להתחבר.{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-amber-600 font-black underline hover:text-amber-800 transition-colors"
            >
              התחבר כאן
            </button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-16 text-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6">
            <Calendar size={64} className="text-slate-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">אין אירועים קרובים</h2>
          <p className="text-slate-500 font-medium mt-2">מוזמנים לבדוק שוב מאוחר יותר.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {events.map((ev) => {
            const reg = ev.registration || { required: false, mode: 'single', categories: [] };
            const remaining = getRemaining(ev);
            const mine = myRegs[ev.id];
            const saving = savingId === ev.id;

            // בדיקת "השבוע"
            const thisWeek = isThisWeek(ev.date?.toDate());

            // סכום נוכחי לבקרה
            const totalNow = calcTotals(ev).total;

            // cap = המקומות שנותרו + מה שכבר תפוס על-ידי המשתמש (כדי לאפשר עדכון/הפחתה)
            const oldTotal = calcOldTotals(ev).total;
            const cap = remaining === null ? null : (remaining + oldTotal);

            return (
              <div key={ev.id} className={`glass-card relative p-6 md:p-8 transition-transform hover:-translate-y-1 ${thisWeek ? 'border-2 border-orange-400 shadow-orange-500/20' : ''}`}>
                {thisWeek && (
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-black px-4 py-2 rounded-full shadow-md flex items-center gap-2 z-10">
                    <Flame size={16} strokeWidth={3} />
                    השבוע!
                  </div>
                )}

                {ev.imageUrl && (
                  <div className="w-full h-48 md:h-64 mb-6 rounded-2xl overflow-hidden shadow-sm border border-white/40">
                    <img 
                      src={ev.imageUrl} 
                      alt={ev.title} 
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-3 mb-6">
                  <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight pr-2">{ev.title}</h3>
                  
                  <div className="flex items-center gap-3 text-slate-500 font-medium">
                    <Calendar size={20} strokeWidth={2} className={thisWeek ? 'text-orange-500' : 'text-emerald-500'} />
                    <span className={`${thisWeek ? 'font-black text-orange-600' : ''}`}>
                      {ev.date?.toDate().toLocaleDateString('he-IL', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  
                  {ev.location && (
                    <div className="flex items-center gap-3 text-slate-500 font-medium">
                      <MapPin size={20} strokeWidth={2} className="text-emerald-500" />
                      <span>{ev.location}</span>
                    </div>
                  )}
                  
                  {ev.description && (
                    <div className="mt-2 text-slate-600 font-medium bg-white/40 p-4 rounded-2xl border border-white/60 leading-relaxed">
                      {ev.description}
                    </div>
                  )}
                  
                  {reg.required && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      <span className="glass-pill bg-blue-50/50 text-blue-700 border-blue-200 shadow-sm" title="מצב תפוסה">
                        {(ev.currentParticipants || 0)}{ev.maxParticipants ? `/${ev.maxParticipants}` : ''}{' '}
                        {remaining !== null ? `(נשארו ${remaining})` : ''}
                      </span>
                      <span className="glass-pill bg-amber-50/50 text-amber-700 border-amber-200 shadow-sm font-bold" title="דרישת רישום">
                        {reg.mode === 'single' ? 'נדרש רישום: יחיד' : reg.mode === 'quantity' ? 'נדרש רישום: כמות' : 'נדרש רישום: קטגוריות'}
                      </span>
                    </div>
                  )}
                </div>

                {reg.required ? (
                  <div className="pt-6 mt-4 border-t border-slate-200/50">
                    {/* פס סטטוס שלי */}
                    {mine && userId && (
                      <div className="mb-4 text-sm font-bold text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                        <Info size={18} strokeWidth={2.5} />
                        נרשמת{userDisplay ? `: ${userDisplay}` : ''} • סה״כ: <span className="text-lg bg-white px-2 py-0.5 rounded-lg ml-1 shadow-sm">{calcOldTotals(ev).total}</span>
                      </div>
                    )}

                    {/* יחיד */}
                    {reg.mode === 'single' && (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 p-4 rounded-3xl border border-white/60">
                        <span className="font-bold text-slate-700">משתתף יחיד:</span>
                        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                          <button
                            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xl hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                            onClick={() => setCounter(ev.id, 'total', 0)}
                            disabled={saving || !userId || (counters[ev.id]?.total || 0) <= 0}
                            type="button"
                          >−</button>
                          <div className="w-10 text-center font-black text-xl text-emerald-600">
                            {Math.min(counters[ev.id]?.total || 0, 1)}
                          </div>
                          <button
                            className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 font-bold text-xl hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                            onClick={() => setCounter(ev.id, 'total', 1)}
                            disabled={saving || !userId || (cap !== null && 1 > cap) || (counters[ev.id]?.total || 0) >= 1}
                            type="button"
                          >+</button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                          {mine && userId && (
                            <button
                              className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"
                              onClick={() => cancelRegistration(ev)}
                              disabled={saving}
                              type="button"
                            >בטל רישום</button>
                          )}
                          <button
                            className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:shadow-none"
                            onClick={() => saveRegistration(ev)}
                            disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)}
                            type="button"
                          >{saving ? 'שומר...' : (mine ? 'עדכן רישום' : 'הירשם עכשיו')}</button>
                        </div>
                      </div>
                    )}

                    {/* כמות */}
                    {reg.mode === 'quantity' && (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 p-4 rounded-3xl border border-white/60">
                        <span className="font-bold text-slate-700">כמות משתתפים:</span>
                        <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                          <button
                            className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-2xl hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                            onClick={() => adjustCounter(ev.id, 'total', -1)}
                            disabled={saving || !userId || (counters[ev.id]?.total || 0) <= 0}
                            type="button"
                          >−</button>
                          <div className="w-12 text-center font-black text-2xl text-emerald-600">
                            {counters[ev.id]?.total || 0}
                          </div>
                          <button
                            className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 font-bold text-2xl hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                            onClick={() => adjustCounter(ev.id, 'total', 1)}
                            disabled={saving || !userId || (cap !== null && (counters[ev.id]?.total || 0) >= cap)}
                            type="button"
                          >+</button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                          {mine && userId && (
                            <button
                              className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"
                              onClick={() => cancelRegistration(ev)}
                              disabled={saving}
                              type="button"
                            >בטל רישום</button>
                          )}
                          <button
                            className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:shadow-none"
                            onClick={() => saveRegistration(ev)}
                            disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)}
                            type="button"
                          >{saving ? 'שומר...' : (mine ? 'עדכן רישום' : 'הירשם עכשיו')}</button>
                        </div>
                      </div>
                    )}

                    {/* קטגוריות */}
                    {reg.mode === 'categories' && (
                      <div className="bg-white/40 p-5 rounded-3xl border border-white/60">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                          {(reg.categories || []).filter((c) => c.enabled).map((c) => {
                            const cur = counters[ev.id]?.[c.key] || 0;
                            const sum = Object.entries(counters[ev.id] || {})
                              .filter(([k]) => k !== 'total')
                              .reduce((s, [, v]) => s + (v || 0), 0);
                            const over = cap !== null && sum >= cap;
                            
                            return (
                              <div key={c.key} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3">
                                <div className="font-black text-slate-700 text-center">{c.label || c.key}</div>
                                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-2xl w-full justify-between">
                                  <button
                                    className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 font-bold text-xl hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center justify-center"
                                    onClick={() => adjustCounter(ev.id, c.key, -1)}
                                    disabled={saving || !userId || cur <= 0}
                                    type="button"
                                  >−</button>
                                  <div className="w-8 text-center font-black text-xl text-emerald-600">
                                    {cur}
                                  </div>
                                  <button
                                    className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 font-bold text-xl hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                                    onClick={() => adjustCounter(ev.id, c.key, 1)}
                                    disabled={saving || !userId || over}
                                    type="button"
                                  >+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200/50">
                          {mine && userId && (
                            <button
                              className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-red-50 hover:text-red-600 transition-colors border border-slate-200"
                              onClick={() => cancelRegistration(ev)}
                              disabled={saving}
                              type="button"
                            >בטל רישום</button>
                          )}
                          <button
                            className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-black hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:shadow-none"
                            onClick={() => saveRegistration(ev)}
                            disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)}
                            type="button"
                          >{saving ? 'שומר...' : (mine ? 'עדכן רישום' : 'הירשם עכשיו')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Events;