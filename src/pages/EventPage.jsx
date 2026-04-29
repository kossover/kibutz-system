
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { CalendarBlank, MapPin, Clock, Users, ArrowLeft, ShareNetwork, CheckCircle, Warning } from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function EventPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // User State
    const [user, setUser] = useState(null);
    const [existingReg, setExistingReg] = useState(null);

    // Form State
    const [fullName, setFullName] = useState('');
    const [guestPhone, setGuestPhone] = useState(''); // New State for Guest Phone
    const [guestStep, setGuestStep] = useState('phone'); // 'phone' | 'details'
    const [counters, setCounters] = useState({});
    const [saving, setSaving] = useState(false);

    // Normalize phone number: remove non-digits, leading +972 becomes 0
    const normalizePhone = (phone) => {
        if (!phone) return '';
        let p = phone.replace(/\D/g, ''); // Remove all non-digits
        if (p.startsWith('972')) {
            p = '0' + p.substring(3);
        }
        return p;
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
            if (u && !fullName) {
                setFullName(u.displayName || '');
            }
        });
        return () => unsubscribe();
    }, []);

    // Load Event
    useEffect(() => {
        const loadEvent = async () => {
            try {
                const docRef = doc(db, 'events', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setEvent({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError('האירוע לא נמצא');
                }
            } catch (err) {
                console.error(err);
                setError('שגיאה בטעינת האירוע');
            } finally {
                setLoading(false);
            }
        };
        loadEvent();
    }, [id]);

    // Manage Bottom Nav Visibility
    useEffect(() => {
        const nav = document.querySelector('.bottom-nav-wrapper');
        if (event) {
            if (nav) {
                // Default is false (hidden) if not explicitly true
                if (event.showFloatingMenu) {
                    nav.style.display = '';
                } else {
                    nav.style.display = 'none';
                }
            }
        }

        // Cleanup: always restore nav when unmounting or leaving
        return () => {
            const navEl = document.querySelector('.bottom-nav-wrapper');
            if (navEl) navEl.style.display = '';
        };
    }, [event]);

    // Load Existing Registration
    useEffect(() => {
        const loadReg = async () => {
            if (!user && !localStorage.getItem('kibbutz_guest_user')) return; // Check if regular user or guest user exists

            // Determine effective user ID
            let uid = user ? user.uid : null;
            if (!uid) {
                try {
                    const guest = JSON.parse(localStorage.getItem('kibbutz_guest_user'));
                    if (guest && guest.uid) {
                        uid = guest.uid;
                        // Pre-fill guest info
                        if (!fullName) setFullName(guest.name || '');
                        if (!guestPhone) setGuestPhone(guest.phone || '');
                    }
                } catch (e) { console.error("Guest parse error", e); }
            }

            if (!uid || !id) return;

            try {
                // Check if user is registered using the composite ID we use in Events.jsx (eventId_userId)
                // Or query by userId and eventId
                const regRef = doc(db, 'eventRegistrations', `${id}_${uid}`);
                const regSnap = await getDoc(regRef);

                if (regSnap.exists()) {
                    const data = regSnap.data();
                    setExistingReg(data);
                    setFullName(data.userDisplay || user?.displayName || data.userDisplay || '');

                    // If guest, show details immediately
                    if (!user) setGuestStep('details');

                    // Initialize counters from existing registration
                    if (data.mode === 'single') {
                        setCounters({ total: Math.min(data.total || 0, 1) });
                    } else if (data.mode === 'quantity') {
                        setCounters({ total: data.total || 0 });
                    } else if (data.mode === 'categories') {
                        setCounters({ ...data.quantities });
                    }
                }
            } catch (err) {
                console.error("Error loading registration", err);
            }
        };
        loadReg();
    }, [user, id]); // Note: dependency on 'user' might need handling for guest state, but 'fullName' changes shouldn't trigger this.
    // The useEffect runs on mount and when 'user' changes.
    // Ideally we should also run it if allowGuestRegistration changes? No, mainly just one-time check for localStorage.

    // Helper: Logic from Events.jsx
    const getRemaining = () => {
        if (!event?.maxParticipants) return null;
        const used = event.currentParticipants || 0;
        // If user is already registered, don't count their current spots against them for updates (simplified)
        // Actually, if we are updating, we check the DELTA.
        // For display "Remaining", we show what's globally remaining.
        return Math.max(event.maxParticipants - used, 0);
    };

    const adjustCounter = (key, delta) => {
        setCounters(prev => {
            const current = prev[key] || 0;
            const newVal = Math.max(0, current + delta);
            return { ...prev, [key]: newVal };
        });
    };

    const calcCurrentTotals = () => {
        const reg = event?.registration || {};
        if (reg.mode === 'single') {
            const t = Math.min(counters.total || 0, 1);
            return { total: t, quantities: {} };
        }
        if (reg.mode === 'quantity') {
            const t = counters.total || 0;
            return { total: t, quantities: { total: t } };
        }
        // Categories
        let sum = 0;
        const qts = {};
        (reg.categories || []).filter(c => c.enabled).forEach(c => {
            const n = counters[c.key] || 0;
            if (n > 0) {
                qts[c.key] = n;
                sum += n;
            }
        });
        return { total: sum, quantities: qts };
    };

    const handleSave = async () => {
        // If not logged in and Guest Registration is NOT allowed -> block
        if (!user && !event.allowGuestRegistration) {
            alert('יש להתחבר כדי להירשם');
            navigate('/login');
            return;
        }

        // If not logged in and Guest Reg IS allowed -> validate guest inputs
        let targetUser = user;

        const cleanPhone = normalizePhone(guestPhone);

        if (!user && event.allowGuestRegistration) {
            if (guestStep === 'phone') {
                alert('אנא אשר את מספר הטלפון תחילה');
                return;
            }
            if (!fullName.trim() || !cleanPhone) {
                alert('נא להזין שם מלא וטלפון');
                return;
            }

            // Basic phone validation (IL) - must be 10 digits starting with 05 after normalization
            const phoneRegex = /^05\d{8}$/;
            if (!phoneRegex.test(cleanPhone)) {
                alert('נא להזין מספר טלפון תקין (05X-XXXXXXX)');
                return;
            }
        } else if (!fullName.trim()) {
            alert('נא להזין שם מלא');
            return;
        }

        const { total: newTotal, quantities: newQ } = calcCurrentTotals();

        // Calculate old totals
        let oldTotal = 0;
        let oldQ = {};
        if (existingReg) {
            oldTotal = existingReg.total || 0;
            oldQ = existingReg.quantities || {};
        }

        if (newTotal < 1) {
            alert('יש לבחור לפחות משתתף אחד');
            return;
        }

        // Capacity Check
        const remaining = getRemaining();
        const delta = newTotal - oldTotal;

        if (remaining !== null && delta > remaining) {
            alert(`נותרו ${remaining} מקומות בלבד`);
            return;
        }

        setSaving(true);
        try {
            // Handle Guest User Creation / Lookup
            if (!targetUser) {
                // 1. Search for existing user by phone (NORMALIZED)
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('phoneNumber', '==', cleanPhone));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // Found existing user
                    const userDoc = querySnapshot.docs[0];
                    targetUser = { uid: userDoc.id, ...userDoc.data() };
                } else {
                    // Create NEW user (Low privilege)
                    const newUserRef = doc(collection(db, 'users'));
                    const newUserData = {
                        displayName: fullName,
                        phoneNumber: cleanPhone,
                        role: 'guest',
                        createdAt: new Date(),
                        isGuest: true
                    };
                    await setDoc(newUserRef, newUserData);
                    targetUser = { uid: newUserRef.id, ...newUserData };
                }

                // Store in LocalStorage for persistence on this device
                localStorage.setItem('kibbutz_guest_user', JSON.stringify({ uid: targetUser.uid, name: fullName, phone: cleanPhone }));
            }



            const regId = `${event.id}_${targetUser.uid}`;

            // Save Registration
            await setDoc(doc(db, 'eventRegistrations', regId), {
                eventId: event.id,
                userId: targetUser.uid,
                userDisplay: fullName, // Use the input name
                userEmail: targetUser.email || '',
                userPhone: targetUser.phoneNumber || cleanPhone, // Save phone
                mode: event.registration.mode || 'single',
                total: newTotal,
                quantities: newQ,
                updatedAt: new Date()
            }, { merge: true });

            // Update Event Stats
            const updates = { currentParticipants: increment(delta) };

            if (event.registration.mode === 'categories') {
                const allKeys = new Set([...Object.keys(newQ), ...Object.keys(oldQ)]);
                allKeys.forEach(key => {
                    const diff = (newQ[key] || 0) - (oldQ[key] || 0);
                    if (diff !== 0) {
                        updates[`stats.${key}`] = increment(diff);
                    }
                });
            }

            await updateDoc(doc(db, 'events', event.id), updates);

            // Reload Event (to get fresh stats)
            const fresh = await getDoc(doc(db, 'events', event.id));
            if (fresh.exists()) setEvent({ id: fresh.id, ...fresh.data() });

            // Reload Reg
            const freshReg = await getDoc(doc(db, 'eventRegistrations', regId));
            if (freshReg.exists()) setExistingReg(freshReg.data());

            // Handle Redirect or Success Message
            const redirectUrl = event.registration?.redirectUrl;
            if (redirectUrl && redirectUrl.trim() !== '') {
                if (redirectUrl.startsWith('http')) {
                    window.location.href = redirectUrl;
                } else {
                    navigate(redirectUrl);
                }
            } else {
                alert('ההרשמה עודכנה בהצלחה!');
            }

        } catch (e) {
            console.error(e);
            alert('שגיאה בשמירה: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm('האם לבטל את ההרשמה?')) return;
        setSaving(true);
        try {
            const regId = `${event.id}_${user.uid}`;
            const totalToReduce = existingReg.total || 0;
            const qToReduce = existingReg.quantities || {};

            await deleteDoc(doc(db, 'eventRegistrations', regId));

            const updates = { currentParticipants: increment(-totalToReduce) };
            if (event.registration.mode === 'categories') {
                Object.entries(qToReduce).forEach(([k, v]) => {
                    if (v) updates[`stats.${k}`] = increment(-v);
                });
            }
            await updateDoc(doc(db, 'events', event.id), updates);

            setExistingReg(null);
            setCounters({});
            // Reset full name only if desired, but keeping it is fine.

            // Reload event stats
            const fresh = await getDoc(doc(db, 'events', event.id));
            if (fresh.exists()) setEvent({ id: fresh.id, ...fresh.data() });

            alert('ההרשמה בוטלה');
        } catch (e) {
            console.error(e);
            alert('שגיאה בביטול: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-container"><div className="loading">טוען אירוע...</div></div>;
    if (error || !event) return <div className="page-container"><div style={{ textAlign: 'center', marginTop: 50 }}>{error || 'אירוע לא נמצא'}</div></div>;

    const reg = event.registration || { required: false };
    const dateObj = event.date?.toDate ? event.date.toDate() : new Date(event.date);

    return (
        <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '40px' }}>
            <BackButton pageKey={`event_${id}`} />

            {/* Header Image */}
            <div style={{
                height: '200px',
                background: event.imageUrl ? `url(${event.imageUrl}) center/cover` : 'linear-gradient(135deg, #fb923c, #ea580c)',
                borderRadius: '24px',
                marginBottom: '24px',
                position: 'relative'
            }}>
                {!event.imageUrl && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                        <CalendarBlank size={80} color="white" />
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', lineHeight: 1.2 }}>{event.title}</h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarBlank size={20} color="var(--primary-color)" />
                        <span style={{ fontWeight: 500 }}>
                            {dateObj.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={20} color="var(--primary-color)" />
                        <span style={{ fontWeight: 500 }}>
                            {dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {event.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={20} color="var(--primary-color)" />
                            <span>{event.location}</span>
                        </div>
                    )}
                </div>

                {event.description && (
                    <div style={{
                        background: '#fff7ed',
                        padding: '16px',
                        borderRadius: '16px',
                        lineHeight: 1.6,
                        marginBottom: '32px'
                    }}>
                        {event.description}
                    </div>
                )}

                {/* Registration Section */}
                {reg.required ? (
                    <div style={{ borderTop: '2px dashed #e5e7eb', paddingTop: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users weight="duotone" color="#ea580c" />
                            הרשמה לאירוע
                        </h2>

                        {!user && !event.allowGuestRegistration && (
                            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '12px', marginBottom: '16px', color: '#92400e', fontSize: '14px' }}>
                                <Warning size={20} style={{ verticalAlign: 'sub' }} /> עליך להתחבר למערכת כדי להירשם לאירוע.
                                <button onClick={() => navigate('/login')} style={{ fontWeight: 'bold', textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginRight: 4 }}>התחבר כאן</button>
                            </div>
                        )}

                        {(user || event.allowGuestRegistration) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {!user && event.allowGuestRegistration && (
                                    <>
                                        {guestStep === 'phone' ? (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>מספר טלפון לזיהוי *</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <input
                                                        type="tel"
                                                        value={guestPhone}
                                                        onChange={(e) => setGuestPhone(e.target.value)}
                                                        placeholder="05X-XXXXXXX"
                                                        className="form-input"
                                                        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '16px' }}
                                                        dir="ltr"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const clean = normalizePhone(guestPhone);
                                                            const phoneRegex = /^05\d{8}$/;
                                                            if (!phoneRegex.test(clean)) {
                                                                alert('נא להזין מספר טלפון תקין (10 ספרות, מתחיל ב-05)');
                                                                return;
                                                            }

                                                            setSaving(true); // temporary reuse saving for loading state
                                                            try {
                                                                const usersRef = collection(db, 'users');
                                                                const q = query(usersRef, where('phoneNumber', '==', clean));
                                                                const snapshot = await getDocs(q);

                                                                if (!snapshot.empty) {
                                                                    const uData = snapshot.docs[0].data();
                                                                    setFullName(uData.displayName || '');
                                                                }
                                                                setGuestStep('details');
                                                            } catch (e) {
                                                                console.error("Error checking phone", e);
                                                                // On permission error or other error, still proceed to let user try entering details
                                                                setGuestStep('details');
                                                            } finally {
                                                                setSaving(false);
                                                            }
                                                        }}
                                                        className="btn btn-primary"
                                                        style={{ width: '100%', borderRadius: '12px', padding: '14px', fontSize: '16px', fontWeight: 'bold' }}
                                                        disabled={saving}
                                                    >
                                                        {saving ? '...' : 'המשך'}
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>ודא שהמספר תקין. נקבל כל פורמט (לדוגמה 052-1234567)</div>
                                            </div>
                                        ) : (
                                            // Step 2: Name (and Phone readonly)
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '16px', direction: 'ltr' }}>{guestPhone}</span>
                                                    <button onClick={() => setGuestStep('phone')} style={{ background: 'none', border: 'none', color: '#ea580c', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>שנה מספר</button>
                                                </div>

                                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>שם מלא *</label>
                                                <input
                                                    type="text"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    placeholder="הכנס שם מלא..."
                                                    className="form-input"
                                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}
                                                    autoFocus
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Standard Name Input for Logged In User */}
                                {user && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>שם מלא *</label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="הכנס שם מלא..."
                                            className="form-input"
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}
                                        />
                                    </div>
                                )}

                                {/* Mode: Quantity or Single */}
                                {(reg.mode === 'single' || reg.mode === 'quantity') && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>כמות משתתפים</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f1f5f9', padding: '8px', borderRadius: '16px', width: 'fit-content' }}>
                                            <button
                                                onClick={() => adjustCounter('total', -1)}
                                                disabled={counters.total <= 0}
                                                style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'white', fontSize: '20px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                            >-</button>
                                            <span style={{ fontSize: '20px', fontWeight: 'bold', minWidth: '30px', textAlign: 'center' }}>{counters.total || 0}</span>
                                            <button
                                                onClick={() => adjustCounter('total', 1)}
                                                disabled={reg.mode === 'single' && counters.total >= 1}
                                                style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'white', fontSize: '20px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                            >+</button>
                                        </div>
                                    </div>
                                )}

                                {/* Mode: Categories */}
                                {reg.mode === 'categories' && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', fontSize: '14px' }}>משתתפים לפי גילאים</label>
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            {(reg.categories || []).filter(c => c.enabled).map(cat => (
                                                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                                                    <span style={{ fontWeight: 500 }}>{cat.label || cat.key}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <button
                                                            onClick={() => adjustCounter(cat.key, -1)}
                                                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                                                        >-</button>
                                                        <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{counters[cat.key] || 0}</span>
                                                        <button
                                                            onClick={() => adjustCounter(cat.key, 1)}
                                                            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                                                        >+</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Status & Actions */}
                                <div style={{ marginTop: '16px' }}>
                                    {existingReg ? (
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            {/* Hide Register Button if in phone step */}
                                            {(!user && event.allowGuestRegistration && guestStep === 'phone') ? null : (
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="btn btn-primary"
                                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}
                                                >
                                                    {saving ? 'מעדכן...' : 'עדכן פרטים'}
                                                </button>
                                            )}
                                            <button
                                                onClick={handleCancel}
                                                disabled={saving}
                                                style={{ padding: '14px', borderRadius: '12px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                                בטל רישום
                                            </button>
                                        </div>
                                    ) : (
                                        // New Registration Button
                                        (!user && event.allowGuestRegistration && guestStep === 'phone') ? null : (
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="btn btn-primary"
                                                style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)' }}
                                            >
                                                {saving ? 'שולח...' : 'אני מגיע/ה! ✋'}
                                            </button>
                                        )
                                    )}
                                </div>

                                {existingReg && (
                                    <div style={{ textAlign: 'center', marginTop: '12px', color: '#16a34a', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                        <CheckCircle weight="fill" />
                                        את/ה רשום/ה לאירוע זה
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                        האירוע פתוח לכולם - אין צורך בהרשמה מראש
                    </div>
                )}
            </div>

            {/* Share Button (Mobile Friendly) */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <button
                    onClick={() => {
                        const url = window.location.href;
                        if (navigator.share) {
                            navigator.share({
                                title: event.title,
                                text: `בואו להירשם לאירוע: ${event.title}`,
                                url: url
                            }).catch(console.error);
                        } else {
                            navigator.clipboard.writeText(url);
                            alert('הקישור הועתק!');
                        }
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', cursor: 'pointer' }}
                >
                    <ShareNetwork size={20} />
                    שתף אירוע לחברים
                </button>
            </div>
        </div>
    );
}

export default EventPage;
