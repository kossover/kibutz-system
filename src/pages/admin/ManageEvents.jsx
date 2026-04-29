import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase/config';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  getDocs,
  query,
  where,
  setDoc,
  increment,
  writeBatch,
  serverTimestamp // הוספת הייבוא החסר
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  CalendarPlus,
  PencilSimple,
  Trash,
  Users,
  FileXls,
  X,
  MapPin,
  Clock,
  CalendarBlank,
  ArrowsClockwise,
  GoogleLogo,
  Gear,
  Warning,
  Link as LinkIcon,
  CheckCircle,
  Funnel,
  Fire
} from '@phosphor-icons/react';

// --- הגדרות גוגל ---
const GOOGLE_CLIENT_ID = "497141209198-bvemsce406hg6qqblblcn407neqn0mlf.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

function ManageEvents() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  const [openEventParticipants, setOpenEventParticipants] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [pEdits, setPEdits] = useState({});
  const [savingRegId, setSavingRegId] = useState(null);

  // Google Sync States
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // הגדרת היומן הספציפי
  const [googleCalendarId, setGoogleCalendarId] = useState('2b14dba2819ae285c2a786bb34af8c6c7d0a4b5ad6a678f7f75fef7b55523b07@group.calendar.google.com');
  const [showSyncSettings, setShowSyncSettings] = useState(false);

  // כדי למנוע לולאת סנכרון אינסופית
  const isSyncingRef = useRef(false);

  const [landingPages, setLandingPages] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    maxParticipants: '',
    imageUrl: '',
    addToGoogle: true,
    showFloatingMenu: false, // Default: No
    allowGuestRegistration: false, // Default: No (Regular Auth)
    registration: {
      required: false,
      redirectUrl: '',
      mode: 'single',
      categories: [
        { key: 'adults', label: 'מבוגרים', enabled: true },
        { key: 'teens', label: 'גילאי 7–16', enabled: true },
        { key: 'kids', label: 'ילדים (0–6)', enabled: true },
      ],
    },
  });

  useEffect(() => {
    const unsubscribeEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData = [];
      snapshot.forEach((d) => eventsData.push({ id: d.id, ...d.data() }));
      setEvents(eventsData.sort((a, b) => a.date?.toMillis() - b.date?.toMillis()));
    });

    const unsubscribePages = onSnapshot(collection(db, 'landingPages'), (snapshot) => {
      const pages = [];
      snapshot.forEach((d) => pages.push({ id: d.id, title: d.data().title }));
      setLandingPages(pages);
    });

    return () => {
      unsubscribeEvents();
      unsubscribePages();
    };
  }, []);

  // --- Google Calendar Setup ---
  useEffect(() => {
    const loadGoogleScripts = () => {
      const script1 = document.createElement('script');
      script1.src = "https://apis.google.com/js/api.js";
      script1.onload = () => {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
          });
          setGapiInited(true);
        });
      };
      document.body.appendChild(script1);

      const script2 = document.createElement('script');
      script2.src = "https://accounts.google.com/gsi/client";
      script2.onload = () => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: '',
          });
          setTokenClient(client);
          setGisInited(true);
        } catch (e) {
          console.error("Google Identity Services Error:", e);
        }
      };
      document.body.appendChild(script2);
    };
    loadGoogleScripts();
  }, []);

  // סנכרון אוטומטי בעליית הדף (ברגע שהסקריפטים מוכנים)
  useEffect(() => {
    if (gapiInited && gisInited && !syncing && !lastSyncTime) {
      // בודק אם יש טוקן שמור או מנסה לסנכרן בשקט
      // הערה: ללא אינטראקציית משתמש, הדפדפן עשוי לחסום פופ-אפ.
      // לכן נבצע סנכרון רק אם המשתמש כבר אישר בעבר והסשן קיים, אחרת הוא יצטרך ללחוץ.
      // כאן נשאיר את זה ידני או חצי-אוטומטי למניעת שגיאות.
      // console.log("Ready to sync");
    }
  }, [gapiInited, gisInited]);

  const handleGoogleAuth = (callback) => {
    if (!tokenClient) return;

    tokenClient.callback = async (resp) => {
      if (resp.error) throw resp;
      await callback();
    };

    // אם יש טוקן בתוקף, דלג על בקשת הרשאה
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent select_account' });
    } else {
      callback();
    }
  };

  /**
   * ליבת הסנכרון המלא (Full Sync Logic)
   * 1. מושך את כל האירועים מגוגל (חודשיים קדימה).
   * 2. מעדכן/יוצר אירועים ב-Firebase בהתאם לגוגל.
   * 3. מוחק אירועים ב-Firebase שיש להם מזהה גוגל אבל לא קיימים יותר בגוגל (כי נמחקו שם).
   */
  const performFullSync = async () => {
    if (!gapiInited || !gisInited) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setSyncing(true);

    try {
      const response = await window.gapi.client.calendar.events.list({
        'calendarId': googleCalendarId,
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 100, // כמות גדולה יותר לסנכרון מלא
        'orderBy': 'startTime'
      });

      const googleEvents = response.result.items;
      const firestoreEvents = [...events]; // העתק של המצב הנוכחי
      const batch = writeBatch(db);
      let operationsCount = 0;

      // רשימת IDs שהגיעו מגוגל (לצורך זיהוי מחיקות)
      const googleEventIds = new Set();

      // 1. מעבר על אירועי גוגל -> עדכון/יצירה ב-Firestore
      for (const gEvent of googleEvents) {
        googleEventIds.add(gEvent.id);
        const gStart = gEvent.start.dateTime || gEvent.start.date;
        if (!gStart) continue;

        const existingDoc = firestoreEvents.find(e => e.googleEventId === gEvent.id);

        // המרת נתונים
        const eventDate = new Date(gStart);
        let imageUrl = '';
        if (gEvent.attachments && gEvent.attachments.length > 0) {
          imageUrl = gEvent.attachments[0].fileUrl;
        }

        const eventData = {
          title: gEvent.summary || 'ללא כותרת',
          description: gEvent.description || '',
          date: Timestamp.fromDate(eventDate),
          location: gEvent.location || '',
          imageUrl: imageUrl,
          googleEventId: gEvent.id,
          updatedAt: serverTimestamp()
        };

        if (existingDoc) {
          // עדכון (רק אם משהו השתנה - כאן נעדכן בכל מקרה לביטחון, או אפשר להשוות שדות)
          const docRef = doc(db, 'events', existingDoc.id);
          batch.update(docRef, eventData);
          operationsCount++;
        } else {
          // יצירה חדשה
          const newDocRef = doc(collection(db, 'events'));
          batch.set(newDocRef, {
            ...eventData,
            registration: { required: false },
            currentParticipants: 0,
            createdAt: Timestamp.now(),
            createdBy: 'GoogleSync'
          });
          operationsCount++;
        }
      }

      // 2. זיהוי מחיקות: אירוע שקיים ב-Firestore עם googleEventId, אבל לא הגיע ברשימה מגוגל
      // (הערה: אנחנו מסננים רק אירועים עתידיים ב-query לגוגל, אז נזהר לא למחוק אירועי עבר בטעות)
      // לצורך הבטיחות: נמחק רק אירועים שקיימים ב-Firestore ותאריכם הוא *אחרי* עכשיו (כמו הסינון של גוגל)
      const now = new Date();

      firestoreEvents.forEach(fsEvent => {
        if (fsEvent.googleEventId && fsEvent.date?.toDate() > now) {
          if (!googleEventIds.has(fsEvent.googleEventId)) {
            // האירוע קיים אצלנו, מקושר לגוגל, עתידי, אבל לא חזר מגוגל -> נמחק שם!
            const docRef = doc(db, 'events', fsEvent.id);
            batch.delete(docRef);
            operationsCount++;
          }
        }
      });

      if (operationsCount > 0) {
        await batch.commit();
        alert(`סנכרון הושלם: ${operationsCount} שינויים בוצעו (הוספות, עדכונים ומחיקות).`);
      } else {
        alert("הכל מעודכן! לא נמצאו שינויים.");
      }

      setLastSyncTime(new Date());

    } catch (err) {
      console.error(err);
      alert("שגיאה בסנכרון: " + (err.result?.error?.message || err.message));
    } finally {
      setSyncing(false);
      isSyncingRef.current = false;
    }
  };

  const startSync = () => {
    handleGoogleAuth(performFullSync);
  };

  // --- פעולות CRUD מול גוגל (כתיבה מיידית) ---

  const addEventToGoogle = async (eventData) => {
    // פונקציית עזר להוספה
    const startDateTime = new Date(eventData.date.toDate());
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const gEvent = {
      'summary': eventData.title,
      'location': eventData.location,
      'description': eventData.description,
      'start': {
        'dateTime': startDateTime.toISOString(),
        'timeZone': 'Asia/Jerusalem'
      },
      'end': {
        'dateTime': endDateTime.toISOString(),
        'timeZone': 'Asia/Jerusalem'
      }
    };

    if (eventData.imageUrl) {
      gEvent.attachments = [{ 'fileUrl': eventData.imageUrl, 'title': 'Image', 'mimeType': 'image/jpeg' }];
    }

    const res = await window.gapi.client.calendar.events.insert({
      'calendarId': googleCalendarId,
      'resource': gEvent,
      'supportsAttachments': true
    });
    return res.result.id;
  };

  const updateEventInGoogle = async (googleEventId, eventData) => {
    if (!googleEventId) return;
    try {
      const startDateTime = new Date(eventData.date.toDate());
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      const gEvent = {
        'summary': eventData.title,
        'location': eventData.location,
        'description': eventData.description,
        'start': { 'dateTime': startDateTime.toISOString(), 'timeZone': 'Asia/Jerusalem' },
        'end': { 'dateTime': endDateTime.toISOString(), 'timeZone': 'Asia/Jerusalem' }
      };

      // עדכון attachments דורש לוגיקה מורכבת יותר, כאן נעדכן טקסטים
      await window.gapi.client.calendar.events.patch({
        'calendarId': googleCalendarId,
        'eventId': googleEventId,
        'resource': gEvent
      });
      console.log("Updated in Google Calendar");
    } catch (e) {
      console.error("Failed to update Google Calendar", e);
      alert("העדכון ביומן גוגל נכשל (אולי האירוע נמחק שם?)");
    }
  };

  const deleteEventInGoogle = async (googleEventId) => {
    if (!googleEventId) return;
    try {
      await window.gapi.client.calendar.events.delete({
        'calendarId': googleCalendarId,
        'eventId': googleEventId
      });
      console.log("Deleted from Google Calendar");
    } catch (e) {
      console.error("Failed to delete from Google Calendar", e);
    }
  };

  // --- CRUD Handlers ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSyncing(true); // מראה אינדיקציה של עבודה

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const timestamp = Timestamp.fromDate(dateTime);
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: timestamp,
        location: formData.location,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
        imageUrl: formData.imageUrl || '',
        registration: { ...formData.registration }, // העתק
        // שומרים נתונים קיימים בעריכה
        currentParticipants: editingEvent ? editingEvent.currentParticipants || 0 : 0,
        googleEventId: editingEvent ? editingEvent.googleEventId : null,
        showFloatingMenu: formData.showFloatingMenu,
        allowGuestRegistration: formData.allowGuestRegistration,
      };

      if (editingEvent) {
        // --- עדכון ---
        // 1. עדכון בגוגל (אם קיים שם)
        if (eventData.googleEventId && gapiInited) {
          await handleGoogleAuth(() => updateEventInGoogle(eventData.googleEventId, eventData));
        }

        // 2. עדכון ב-Firestore
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
        alert('האירוע עודכן בהצלחה!');

      } else {
        // --- יצירה חדשה ---
        eventData.createdAt = Timestamp.now();
        eventData.createdBy = auth?.currentUser?.uid || 'system';
        eventData.stats = {};

        // 1. יצירה בגוגל (אם נדרש)
        if (formData.addToGoogle && gapiInited) {
          await handleGoogleAuth(async () => {
            try {
              const gId = await addEventToGoogle(eventData);
              eventData.googleEventId = gId; // שומרים את ה-ID שקיבלנו
            } catch (err) {
              console.error("Google create error", err);
              alert("האירוע נוצר במערכת אך נכשל ביצירה בגוגל.");
            }
          });
        }

        // 2. יצירה ב-Firestore
        await addDoc(collection(db, 'events'), eventData);
        alert('האירוע נוסף בהצלחה!');
      }
      resetForm();
    } catch (e) {
      console.error(e); alert('אירעה שגיאה: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm('למחוק את האירוע?')) return;
    setSyncing(true);
    try {
      // 1. מחיקה מגוגל (אם מקושר)
      if (event.googleEventId && gapiInited) {
        await handleGoogleAuth(() => deleteEventInGoogle(event.googleEventId));
      }

      // 2. מחיקה מ-Firestore
      await deleteDoc(doc(db, 'events', event.id));
      alert('האירוע נמחק.');
    } catch (e) {
      console.error(e);
      alert('שגיאה במחיקה');
    } finally {
      setSyncing(false);
    }
  };

  const deleteAllEvents = async () => {
    if (!window.confirm('⚠️ מחיקת כל האירועים?')) return;
    if (!window.confirm('בטוח? זה ימחק הכל.')) return;

    setSyncing(true);
    try {
      const q = query(collection(db, 'events'));
      const snapshot = await getDocs(q);

      const batchArray = [];
      let batch = writeBatch(db);
      let opCount = 0;

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        opCount++;
        if (opCount === 500) {
          batchArray.push(batch.commit());
          batch = writeBatch(db);
          opCount = 0;
        }
      });
      if (opCount > 0) batchArray.push(batch.commit());

      await Promise.all(batchArray);
      alert('כל האירועים נמחקו.');
    } catch (error) {
      alert('שגיאה: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', description: '', date: '', time: '', location: '', maxParticipants: '', imageUrl: '', addToGoogle: true, showFloatingMenu: false, allowGuestRegistration: false,
      registration: {
        required: false, mode: 'single', redirectUrl: '',
        categories: [
          { key: 'adults', label: 'מבוגרים', enabled: true },
          { key: 'teens', label: 'גילאי 7–16', enabled: true },
          { key: 'kids', label: 'ילדים (0–6)', enabled: true },
        ],
      },
    });
    setEditingEvent(null);
    setShowForm(false);
  };

  const handleEdit = (event) => {
    const date = event.date.toDate();
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().slice(0, 5),
      location: event.location || '',
      maxParticipants: event.maxParticipants || '',
      imageUrl: event.imageUrl || '',
      addToGoogle: !!event.googleEventId, // אם יש ID, זה כבר בגוגל
      showFloatingMenu: !!event.showFloatingMenu,
      allowGuestRegistration: !!event.allowGuestRegistration,
      registration: {
        required: !!event.registration?.required,
        redirectUrl: event.registration?.redirectUrl || '',
        mode: event.registration?.mode || 'single',
        categories: event.registration?.categories?.length ? event.registration.categories : [
          { key: 'adults', label: 'מבוגרים', enabled: true },
          { key: 'teens', label: 'גילאי 7–16', enabled: true },
          { key: 'kids', label: 'ילדים (0–6)', enabled: true },
        ],
      },
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Helper Functions ---
  const isThisWeek = (date) => {
    if (!date) return false;
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    return date >= now && date <= nextWeek;
  };

  const exportParticipants = async (event) => {
    try {
      const qy = query(collection(db, 'eventRegistrations'), where('eventId', '==', event.id));
      const snapshot = await getDocs(qy);
      const rows = snapshot.docs.map((d) => {
        const r = d.data();
        return {
          'משתמש': r.userDisplay || r.userEmail || r.userId || '',
          'מצב': r.mode || '',
          'סה״כ': r.total || 0,
        };
      });
      if (rows.length === 0) { alert('אין משתתפים'); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'משתתפים');
      XLSX.writeFile(wb, `משתתפים_${event.title}.xlsx`);
    } catch (e) { console.error(e); }
  };

  const openParticipants = (event) => {
    setOpenEventParticipants(event);
    const qy = query(collection(db, 'eventRegistrations'), where('eventId', '==', event.id));
    return onSnapshot(qy, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setParticipants(list);
      const edits = {};
      list.forEach((r) => {
        edits[r.id] = { mode: r.mode, total: r.total || 0, quantities: { ...(r.quantities || {}) }, userId: r.userId };
      });
      setPEdits(edits);
    });
  };

  // --- Filter Events ---
  const filteredEvents = events.filter(ev => {
    if (showPastEvents) return true;
    const date = ev.date?.toDate();
    // מאפשרים לראות אירועים שהתחילו בשעתיים האחרונות גם כשהפילטר הוסתר
    const cutoff = new Date(new Date().getTime() - 2 * 60 * 60 * 1000);
    return date && date >= cutoff;
  });

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול אירועים</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', padding: '0 8px', borderRadius: '8px' }}>
            <input
              type="checkbox"
              id="showPast"
              checked={showPastEvents}
              onChange={(e) => setShowPastEvents(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#ea580c' }}
            />
            <label htmlFor="showPast" style={{ fontSize: '14px', margin: 0, cursor: 'pointer', userSelect: 'none' }}>הצג אירועי עבר</label>
          </div>

          <button
            onClick={() => setShowSyncSettings(!showSyncSettings)}
            className="btn btn-secondary" style={{ width: 'auto', padding: '8px' }} title="הגדרות"
          >
            <Gear size={20} />
          </button>

          <button
            onClick={startSync}
            disabled={syncing}
            className="btn btn-success"
            style={{ width: 'auto', padding: '8px 12px', fontSize: '0.9rem' }}
          >
            {syncing ? 'מסנכרן...' : <><ArrowsClockwise size={18} /> סנכרון גוגל</>}
          </button>

          <button onClick={deleteAllEvents} disabled={syncing} className="btn btn-danger" style={{ width: 'auto', padding: '8px', background: '#DC2626', borderColor: '#DC2626' }}>
            <Trash size={18} /> מחיקת הכל
          </button>

          <button onClick={() => setShowForm(!showForm)} className={`btn ${showForm ? 'btn-danger' : 'btn-accent'}`} style={{ width: 'auto' }}>
            {showForm ? <><X size={20} /> ביטול</> : <><CalendarPlus size={20} /> חדש</>}
          </button>
        </div>
      </div>

      {lastSyncTime && (
        <div style={{ fontSize: '0.8rem', color: 'gray', marginBottom: 10, textAlign: 'left' }}>
          סנכרון אחרון: {lastSyncTime.toLocaleTimeString()} <CheckCircle size={14} style={{ verticalAlign: 'middle', color: 'green' }} />
        </div>
      )}

      {showSyncSettings && (
        <div style={{ background: '#F3F4F6', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #E5E7EB' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>הגדרות יומן</h4>
          <div className="form-group" style={{ maxWidth: '400px', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Calendar ID</label>
            <input type="text" className="form-input" value={googleCalendarId} onChange={(e) => setGoogleCalendarId(e.target.value)} />
          </div>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h3 className="text-bold mb-4">{editingEvent ? 'ערוך אירוע' : 'אירוע חדש'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="form-group"><label className="form-label">שם *</label><input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">מיקום</label><input type="text" className="form-input" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">תיאור</label><textarea className="form-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="3" /></div>
            <div className="form-group">
              <label className="form-label">קישור לתמונה (Google Drive)</label>
              <div style={{ position: 'relative' }}>
                <input type="text" className="form-input" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} style={{ paddingRight: '36px' }} />
                <LinkIcon size={20} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="form-group"><label className="form-label">תאריך *</label><input type="date" className="form-input" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">שעה *</label><input type="time" className="form-input" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">מקסימום משתתפים</label><input type="number" className="form-input" value={formData.maxParticipants} onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })} /></div>
            </div>

            <div className="card" style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', marginTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="regRequired"
                  checked={formData.registration.required}
                  onChange={(e) => setFormData({
                    ...formData,
                    registration: { ...formData.registration, required: e.target.checked }
                  })}
                  style={{ width: '18px', height: '18px', accentColor: '#ea580c' }}
                />
                <label htmlFor="regRequired" style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>פתיחת הרשמה לאירוע</label>
              </div>

              {formData.registration.required && (
                <div style={{ paddingRight: '28px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>סוג הרשמה:</label>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="regMode"
                        checked={formData.registration.mode === 'quantity'}
                        onChange={() => setFormData({
                          ...formData,
                          registration: { ...formData.registration, mode: 'quantity' }
                        })}
                        style={{ accentColor: '#ea580c' }}
                      />
                      <span>כמות משתתפים כללית</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="regMode"
                        checked={formData.registration.mode === 'categories'}
                        onChange={() => setFormData({
                          ...formData,
                          registration: { ...formData.registration, mode: 'categories' }
                        })}
                        style={{ accentColor: '#ea580c' }}
                      />
                      <span>פירוט (מבוגרים/ילדים)</span>
                    </label>
                  </div>

                  {/* Redirect URL Section */}
                  <div style={{ marginTop: '16px', borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                    <label className="form-label">הפניה לאחר הרשמה מוצלחת (אופציונלי)</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <select
                        className="form-input"
                        style={{ flex: 1, minWidth: '200px' }}
                        onChange={(e) => {
                          const url = e.target.value ? `/p/${e.target.value}` : '';
                          setFormData({
                            ...formData,
                            registration: { ...formData.registration, redirectUrl: url }
                          });
                        }}
                        value={formData.registration.redirectUrl?.startsWith('/p/') ? formData.registration.redirectUrl.replace('/p/', '') : ''}
                      >
                        <option value="">בחר דף נחיתה קיים...</option>
                        {landingPages.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="או הזן כתובת URL מלאה..."
                        value={formData.registration.redirectUrl || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          registration: { ...formData.registration, redirectUrl: e.target.value }
                        })}
                        dir="ltr"
                        style={{ flex: 1, minWidth: '200px' }}
                      />
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      אם לא יוזן כלום, תוצג הודעת אישור רגילה והמשתמש יישאר בדף.
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Floating Menu Setting */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                id="showFloatingMenu"
                checked={formData.showFloatingMenu}
                onChange={(e) => setFormData({ ...formData, showFloatingMenu: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#ea580c' }}
              />
              <label htmlFor="showFloatingMenu" style={{ margin: 0, fontSize: '1rem' }}>הצג תפריט ניווט תחתון (Floating Menu)</label>
            </div>

            {/* Login Restriction Setting */}
            <div className="card" style={{ padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 'bold', color: '#9a3412', marginBottom: '12px', display: 'block' }}>בקרת גישה והרשמה:</label>

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="loginPolicy"
                    checked={!formData.allowGuestRegistration}
                    onChange={() => setFormData({ ...formData, allowGuestRegistration: false })}
                    style={{ width: '18px', height: '18px', accentColor: '#ea580c' }}
                  />
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', fontSize: '15px' }}>חובה להתחבר למערכת</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>מתאים לאירועים לחברים בלבד</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="loginPolicy"
                    checked={formData.allowGuestRegistration}
                    onChange={() => setFormData({ ...formData, allowGuestRegistration: true })}
                    style={{ width: '18px', height: '18px', accentColor: '#ea580c' }}
                  />
                  <div>
                    <span style={{ fontWeight: 'bold', display: 'block', fontSize: '15px' }}>רישום פתוח (כולל אורחים)</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>מאפשר רישום ע"י שם וטלפון ללא סיסמה</span>
                  </div>
                </label>
              </div>
            </div>

            {!editingEvent && (
              <div className="form-group" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <input id="addToGoogle" type="checkbox" style={{ width: '20px', height: '20px' }} checked={formData.addToGoogle} onChange={(e) => setFormData({ ...formData, addToGoogle: e.target.checked })} />
                <label htmlFor="addToGoogle" className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}><GoogleLogo weight="bold" /> הוסף ליומן גוגל</label>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn-primary">{editingEvent ? 'עדכן' : 'הוסף'}</button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">ביטול</button>
            </div>
          </form>
        </div>
      )}

      {filteredEvents.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: '8px' }}>
          לא נמצאו אירועים רלוונטיים להצגה.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {filteredEvents.map((event) => {
          const thisWeek = isThisWeek(event.date?.toDate());
          return (
            <div key={event.id} className="card" style={{
              padding: 16,
              border: thisWeek ? '2px solid #ea580c' : '1px solid #e5e7eb',
              background: thisWeek ? '#fff7ed' : 'white',
              position: 'relative'
            }}>
              {thisWeek && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  right: 20,
                  background: '#ea580c',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  השבוע
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 className="text-bold" style={{ fontSize: '1.1rem', marginBottom: 8 }}>{event.title}</h3>
                    {event.googleEventId && <GoogleLogo size={16} color="#4285F4" weight="fill" title="מקושר לגוגל" />}
                  </div>
                  <div className="text-sm text-muted" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarBlank size={16} /> {event.date?.toDate().toLocaleDateString('he-IL')} • {event.date?.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {event.location && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={16} /> {event.location}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`);
                      alert('הקישור הועתק ללוח!');
                    }}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '8px' }}
                    title="העתק קישור להרשמה"
                  >
                    <LinkIcon size={18} />
                  </button>
                  <button onClick={() => exportParticipants(event)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px' }}><FileXls size={18} /></button>
                  <button onClick={() => openParticipants(event)} className="btn btn-accent" style={{ width: 'auto', padding: '8px 12px' }}><Users size={18} /></button>
                  <button onClick={() => handleEdit(event)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px' }}><PencilSimple size={18} /></button>
                  <button onClick={() => handleDelete(event)} className="btn btn-danger" style={{ width: 'auto', padding: '8px' }}><Trash size={18} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {openEventParticipants && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 0 }}>
            <div className="flex-between mb-4"><h3 className="text-bold">משתתפים: {openEventParticipants.title}</h3><button onClick={() => setOpenEventParticipants(null)} className="btn btn-secondary" style={{ width: 'auto', padding: 8 }}><X size={20} /></button></div>
            <div style={{ overflowY: 'auto', paddingRight: 4, flex: 1 }}>
              {participants.length === 0 ? <div className="text-center text-muted py-8">אין נרשמים</div> : participants.map((reg) => (
                <div key={reg.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div className="flex-between"><div><div className="font-bold">{reg.userDisplay}</div></div><span className="chip chip-gray">{reg.total}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageEvents;