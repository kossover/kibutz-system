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
import { CalendarBlank, Info, Clock, Fire } from '@phosphor-icons/react';
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
      <div className="page-container">
        <div className="loading">טוען אירועים...</div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ direction: 'rtl' }}>
      {/* CSS רספונסיבי ממוקד-קומפוננטה */}
      <style>{`
        .event-card {
          padding: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .event-card.this-week {
            border: 2px solid #ea580c;
            background: #fff7ed;
            position: relative;
        }

        .week-badge {
            position: absolute;
            top: -12px;
            right: 20px;
            background: #ea580c;
            color: white;
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .meta-line {
          color: var(--text-secondary);
        }
        .chips {
          display: inline-flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .chip {
          padding: 4px 10px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
        }
        .chip-muted {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
        }
        .chip-warn {
          background: #FDE68A;
          border: 1px solid #F59E0B;
        }

        .reg-section {
          border-top: 1px solid var(--border-color);
          padding-top: 12px;
          margin-top: 8px;
        }

        .reg-row {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          max-width: 520px;
          flex-wrap: wrap;
        }

        .counter {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 8px;
        }
        .counter button {
          min-width: 44px;
          min-height: 44px;
          font-size: 18px;
          border-radius: 10px;
        }
        .counter-value {
          min-width: 44px;
          text-align: center;
          font-size: 18px;
        }

        .actions-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .actions-row .btn {
          min-height: 44px;
        }

        .cats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(180px, 1fr));
          gap: 10px;
        }
        .cat-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 12px;
        }

        .login-notice {
          background: #FEF3C7;
          border: 1px solid #F59E0B;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }

        /* ====== מובייל ====== */
        @media (max-width: 640px) {
          .event-card {
            padding: 16px;
          }
          .reg-row {
            flex-direction: column;
            align-items: stretch;
            max-width: 100%;
            gap: 10px;
          }
          .counter {
            justify-content: space-between;
          }
          .actions-row {
            width: 100%;
          }
          .actions-row .btn {
            flex: 1 1 auto;
          }
          .cats-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ====== טאבלט קטן ====== */
        @media (min-width: 641px) and (max-width: 960px) {
          .cats-grid {
            grid-template-columns: repeat(2, minmax(180px, 1fr));
          }
        }
      `}</style>

      <h1 className="page-title" style={{ marginBottom: 16 }}>אירועים קרובים</h1>
      <BackButton pageKey="events" />

      {/* הודעה למשתמשים לא מחוברים */}
      {!userId && (
        <div className="login-notice">
          <Info size={24} weight="fill" color="#F59E0B" />
          <div>
            <strong>צפייה באירועים פתוחה לכולם.</strong> להרשמה לאירוע יש להתחבר.{' '}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit'
              }}
            >
              התחבר כאן
            </button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CalendarBlank size={48} weight="duotone" color="var(--text-secondary)" />
          </div>
          <div className="empty-state-text">אין אירועים קרובים</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
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
              <div key={ev.id} className={`card event-card ${thisWeek ? 'this-week' : ''}`}>
                {thisWeek && (
                  <div className="week-badge">
                    <Fire weight="fill" />
                    השבוע!
                  </div>
                )}

                <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{ev.title}</h3>
                  <div className="meta-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarBlank size={18} />
                    <span style={{ fontWeight: thisWeek ? 'bold' : 'normal', color: thisWeek ? '#ea580c' : 'inherit' }}>
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
                    <div className="meta-line">📍 {ev.location}</div>
                  )}
                  {ev.description && (
                    <div className="meta-line" style={{ marginTop: 4 }}>{ev.description}</div>
                  )}
                  <div className="chips" style={{ marginTop: 6 }}>
                    <span className="chip chip-muted" title="מצב תפוסה">
                      {(ev.currentParticipants || 0)}{ev.maxParticipants ? `/${ev.maxParticipants}` : ''}{' '}
                      {remaining !== null ? `(נשארו ${remaining})` : ''}
                    </span>
                    {reg.required ? (
                      <span className="chip chip-warn" title="דרישת רישום">
                        {reg.mode === 'single' ? 'נדרש רישום: יחיד' : reg.mode === 'quantity' ? 'נדרש רישום: כמות' : 'נדרש רישום: קטגוריות'}
                      </span>
                    ) : (
                      <span className="chip chip-muted">לא נדרש רישום</span>
                    )}
                  </div>
                </div>

                {reg.required ? (
                  <div className="reg-section">
                    {/* פס סטטוס שלי */}
                    {mine && userId && (
                      <div style={{ marginBottom: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                        נרשמת{userDisplay ? `: ${userDisplay}` : ''} • סה״כ: <b>{calcOldTotals(ev).total}</b>
                      </div>
                    )}

                    {/* יחיד */}
                    {reg.mode === 'single' && (
                      <div className="reg-row" aria-label="רישום יחיד">
                        <span>משתתף יחיד:</span>
                        <div className="counter" role="group" aria-label="מונה משתתפים">
                          <button
                            className="btn btn-secondary"
                            onClick={() => setCounter(ev.id, 'total', 0)}
                            disabled={saving || !userId || (counters[ev.id]?.total || 0) <= 0}
                            type="button"
                            aria-label="הפחת אחד"
                          >−</button>
                          <div className="counter-value" aria-live="polite">
                            {Math.min(counters[ev.id]?.total || 0, 1)}
                          </div>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setCounter(ev.id, 'total', 1)}
                            disabled={saving || !userId || (cap !== null && 1 > cap) || (counters[ev.id]?.total || 0) >= 1}
                            type="button"
                            aria-label="הוסף אחד"
                          >+</button>
                        </div>

                        <div className="actions-row">
                          {mine && userId && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => cancelRegistration(ev)}
                              disabled={saving}
                              type="button"
                            >בטל רישום</button>
                          )}
                          <button
                            className="btn btn-primary"
                            onClick={() => saveRegistration(ev)}
                            disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)}
                            type="button"
                          >{saving ? 'שומר...' : (mine ? 'עדכן' : 'שמור')}</button>
                        </div>
                      </div>
                    )}

                    {/* כמות */}
                    {reg.mode === 'quantity' && (
                      <div className="reg-row" aria-label="רישום לפי כמות">
                        <span>כמות:</span>
                        <div className="counter" role="group" aria-label="מונה משתתפים">
                          <button
                            className="btn btn-secondary"
                            onClick={() => adjustCounter(ev.id, 'total', -1)}
                            disabled={saving || !userId || (counters[ev.id]?.total || 0) <= 0}
                            type="button"
                            aria-label="הפחת אחד"
                          >−</button>
                          <div className="counter-value" aria-live="polite">
                            {counters[ev.id]?.total || 0}
                          </div>
                          <button
                            className="btn btn-secondary"
                            onClick={() => adjustCounter(ev.id, 'total', 1)}
                            disabled={saving || !userId || (cap !== null && (counters[ev.id]?.total || 0) >= cap)}
                            type="button"
                            aria-label="הוסף אחד"
                          >+</button>
                        </div>

                        <div className="actions-row">
                          {mine && userId && (
                            <button className="btn btn-secondary" onClick={() => cancelRegistration(ev)} disabled={saving} type="button">בטל רישום</button>
                          )}
                          <button className="btn btn-primary" onClick={() => saveRegistration(ev)} disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)} type="button">
                            {saving ? 'שומר...' : (mine ? 'עדכן' : 'שמור')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* קטגוריות */}
                    {reg.mode === 'categories' && (
                      <>
                        <div className="cats-grid">
                          {(reg.categories || []).filter((c) => c.enabled).map((c) => {
                            const cur = counters[ev.id]?.[c.key] || 0;
                            // סכימת הקטגוריות לצורך הגבלת cap
                            const sum = Object.entries(counters[ev.id] || {})
                              .filter(([k]) => k !== 'total')
                              .reduce((s, [, v]) => s + (v || 0), 0);
                            const over = cap !== null && sum >= cap;
                            return (
                              <div key={c.key} className="cat-card">
                                <div style={{ marginBottom: 6, fontWeight: 600 }}>{c.label || c.key}</div>
                                <div className="counter" role="group" aria-label={`מונה ${c.label || c.key}`}>
                                  <button className="btn btn-secondary" onClick={() => adjustCounter(ev.id, c.key, -1)} disabled={saving || !userId || cur <= 0} type="button" aria-label="הפחת אחד">−</button>
                                  <div className="counter-value" aria-live="polite">{cur}</div>
                                  <button className="btn btn-secondary" onClick={() => adjustCounter(ev.id, c.key, 1)} disabled={saving || !userId || over} type="button" aria-label="הוסף אחד">+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="actions-row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                          {mine && userId && (
                            <button className="btn btn-secondary" onClick={() => cancelRegistration(ev)} disabled={saving} type="button">בטל רישום</button>
                          )}
                          <button className="btn btn-primary" onClick={() => saveRegistration(ev)} disabled={saving || totalNow < 1 || (cap !== null && totalNow > cap)} type="button">
                            {saving ? 'שומר...' : (mine ? 'עדכן' : 'שמור')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                      color: 'var(--text-secondary)',
                      fontSize: 14,
                    }}
                  >
                    לא נדרש רישום לאירוע זה.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Events;