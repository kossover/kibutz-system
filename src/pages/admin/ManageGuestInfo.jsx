import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, auth } from '../../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  Info, 
  MapPin, 
  Coffee, 
  Storefront, 
  Code,
  Plus,
  Trash,
  PencilSimple,
  X,
  CheckCircle,
  Link,
  CalendarBlank,
  MapTrifold as MapIcon
} from '@phosphor-icons/react';
import WalkingRouteEditor from '../../components/WalkingRouteEditor';

const DEFAULT_DATA = {
  generalInfo: "ברוכים הבאים לקיבוץ נווה אור! ריכזנו עבורכם מידע שימושי לשהות שלכם.",
  facilities: [],
  attractions: [],
  restaurants: [],
  events: [],
  walkingRoutes: []
};

function ManageGuestInfo() {
  const navigate = useNavigate();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Form states for manual entry
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(''); // 'facilities', 'attractions', 'restaurants'
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const docRef = doc(db, 'settings', 'guestInfo');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setData({ ...DEFAULT_DATA, ...docSnap.data() });
      }
    } catch (error) {
      console.error('Error loading guest info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async (newData = data) => {
    try {
      await setDoc(doc(db, 'settings', 'guestInfo'), {
        ...newData,
        updatedAt: serverTimestamp()
      });
      alert('המידע נשמר בהצלחה!');
      setData(newData);
    } catch (error) {
      console.error('Error saving data:', error);
      alert('שגיאה בשמירת המידע');
    }
  };

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.facilities || !parsed.attractions || !parsed.restaurants) {
        throw new Error('חסרים שדות חובה ב-JSON (facilities, attractions, restaurants)');
      }
      setJsonError('');
      if (window.confirm('ייבוא JSON ידרוס את כל המידע הקיים. האם להמשיך?')) {
        const newData = { ...DEFAULT_DATA, ...parsed };
        handleSaveAll(newData);
      }
    } catch (err) {
      setJsonError('שגיאה בייבוא: ' + err.message);
    }
  };

  const handleJsonExport = () => {
    setJsonInput(JSON.stringify(data, null, 2));
    setActiveTab('json');
  };

  const openForm = (type, item = null) => {
    setFormType(type);
    setEditingId(item ? item.id : null);
    
    if (item) {
      setFormData(item);
    } else {
      // Default empty form
      if (type === 'facilities') setFormData({ name: '', hours: '', description: '', navLink: '', website: '' });
      if (type === 'attractions') setFormData({ name: '', distance: '', description: '', navLink: '', website: '' });
      if (type === 'restaurants') setFormData({ name: '', type: '', distance: '', description: '', navLink: '', website: '' });
      if (type === 'events') setFormData({ name: '', date: '', time: '', location: '', description: '', navLink: '', website: '' });
      if (type === 'walkingRoutes') setFormData({ name: '', description: '', path: [], waypoints: [] });
    }
    setShowForm(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newData = { ...data };
    
    if (editingId) {
      newData[formType] = newData[formType].map(i => i.id === editingId ? { ...formData, id: editingId } : i);
    } else {
      const newItem = { ...formData, id: Date.now().toString() };
      newData[formType] = [...newData[formType], newItem];
    }
    
    setData(newData);
    handleSaveAll(newData);
    setShowForm(false);
  };

  const handleDeleteItem = (type, id) => {
    if (window.confirm('האם למחוק פריט זה?')) {
      const newData = { ...data };
      newData[type] = newData[type].filter(i => i.id !== id);
      setData(newData);
      handleSaveAll(newData);
    }
  };

  if (loading) return <div>טוען...</div>;

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול מידע לאורחים</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/guests'); alert('הקישור הועתק') }} style={{ width: 'auto' }}>
                <Link size={18} /> העתק קישור לדף
            </button>
            <button className="btn btn-primary" onClick={() => handleSaveAll()} style={{ width: 'auto' }}>
                <CheckCircle size={18} /> שמור שינויים
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 pb-2 border-b border-slate-200 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'general', label: 'מידע כללי', icon: Info },
          { id: 'facilities', label: 'מתקנים בקיבוץ', icon: Storefront },
          { id: 'events', label: 'אירועים', icon: CalendarBlank },
          { id: 'attractions', label: 'אטרקציות וטיולים', icon: MapPin },
          { id: 'restaurants', label: 'מסעדות בסביבה', icon: Coffee },
          { id: 'walkingRoutes', label: 'מסלולי הליכה', icon: MapIcon },
          { id: 'json', label: 'ייבוא/ייצוא JSON', icon: Code }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                isActive 
                  ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && (
        <div className="card">
          <h3 className="font-bold mb-4">הודעת פתיחה לאורחים</h3>
          <textarea 
            className="form-input" 
            rows="5"
            value={data.generalInfo}
            onChange={(e) => setData({ ...data, generalInfo: e.target.value })}
            placeholder="כתוב כאן הודעת קבלת פנים או מידע כללי חשוב..."
          />
        </div>
      )}

      {(activeTab === 'facilities' || activeTab === 'attractions' || activeTab === 'restaurants' || activeTab === 'events' || activeTab === 'walkingRoutes') && (
        <div>
          <button onClick={() => openForm(activeTab)} className="btn btn-accent mb-4" style={{width:'auto'}}>
            <Plus size={18} /> הוסף {activeTab === 'walkingRoutes' ? 'מסלול' : 'פריט'} חדש
          </button>

          <div style={{ display: 'grid', gap: 16 }}>
            {data[activeTab]?.map(item => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    {item.hours && <div className="text-sm text-slate-500 mt-1">🕒 {item.hours}</div>}
                    {item.date && <div className="text-sm text-slate-500 mt-1">📅 {item.date} {item.time && `| ${item.time}`}</div>}
                    {item.location && <div className="text-sm text-slate-500 mt-1">📍 {item.location}</div>}
                    {item.distance && !item.location && <div className="text-sm text-slate-500 mt-1">📍 {item.distance}</div>}
                    {item.type && <div className="text-sm text-slate-500 mt-1">🏷️ {item.type}</div>}
                    {item.navLink && <div className="text-sm text-emerald-600 mt-1 flex items-center gap-1">🔗 קישור לניווט הוגדר</div>}
                    {item.website && <div className="text-sm text-blue-600 mt-1 flex items-center gap-1">🌐 קישור לאתר הוגדר</div>}
                    {activeTab === 'walkingRoutes' && (
                      <div className="text-sm text-emerald-600 mt-1">
                        🗺️ מסלול מפה ({item.path?.length || 0} נקודות ציור, {item.waypoints?.length || 0} נקודות עניין)
                      </div>
                    )}
                    <p className="mt-2 text-slate-700">{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openForm(activeTab, item)} className="btn btn-secondary" style={{width:'auto', padding:8}}><PencilSimple size={18}/></button>
                    <button onClick={() => handleDeleteItem(activeTab, item.id)} className="btn btn-danger" style={{width:'auto', padding:8}}><Trash size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
            {(!data[activeTab] || data[activeTab].length === 0) && <div className="text-center text-slate-500 my-8">אין נתונים בקטגוריה זו.</div>}
          </div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="card">
          <div className="flex-between mb-4">
            <h3 className="font-bold">עורך JSON מתקדם</h3>
            <button onClick={handleJsonExport} className="btn btn-secondary" style={{width:'auto', padding:'6px 12px'}}>
              טען נתונים נוכחיים לתיבה
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            ניתן להדביק כאן קובץ JSON שלם כדי לייבא נתונים בבת אחת. ודא שהמבנה תקין.
          </p>
          <textarea
            className="form-input mb-4"
            rows="15"
            style={{ fontFamily: 'monospace', direction: 'ltr' }}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"facilities": [...], "attractions": [...], "restaurants": [...]}'
          />
          {jsonError && <div className="text-red-500 mb-4">{jsonError}</div>}
          <button onClick={handleJsonImport} className="btn btn-primary" style={{width:'auto'}}>
            <CheckCircle size={18} /> בצע ייבוא JSON
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showForm && createPortal(
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', justifyContent:'center', alignItems:'center', padding:20, direction: 'rtl' }}>
          <div className="card" style={{ width:'100%', maxWidth:500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-4">
              <h3 className="font-bold text-xl">{editingId ? 'עריכת פריט' : 'פריט חדש'}</h3>
              <button onClick={() => setShowForm(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={24}/></button>
            </div>
            <form onSubmit={handleFormSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div className="form-group">
                <label className="form-label">שם *</label>
                <input required className="form-input" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              {formType === 'facilities' && (
                <div className="form-group">
                  <label className="form-label">שעות פעילות</label>
                  <input className="form-input" value={formData.hours || ''} onChange={e => setFormData({...formData, hours: e.target.value})} placeholder="לדוגמה: א-ה 08:00-14:00" />
                </div>
              )}
              
              {(formType === 'attractions' || formType === 'restaurants') && (
                <div className="form-group">
                  <label className="form-label">מרחק / מיקום</label>
                  <input className="form-input" value={formData.distance || ''} onChange={e => setFormData({...formData, distance: e.target.value})} placeholder="לדוגמה: 15 דק' נסיעה" />
                </div>
              )}
              
              {formType === 'events' && (
                <>
                  <div className="form-group">
                    <label className="form-label">תאריך</label>
                    <input className="form-input" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} placeholder="לדוגמה: יום שישי 21/5" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">שעה</label>
                    <input className="form-input" value={formData.time || ''} onChange={e => setFormData({...formData, time: e.target.value})} placeholder="לדוגמה: 18:00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">מיקום</label>
                    <input className="form-input" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="לדוגמה: שער מזרחי" />
                  </div>
                </>
              )}
              
              {formType === 'restaurants' && (
                <div className="form-group">
                  <label className="form-label">סגנון / סוג</label>
                  <input className="form-input" value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})} placeholder="לדוגמה: מסעדת שף, המבורגרים" />
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">קישור לניווט (Waze / Google Maps)</label>
                <input type="url" className="form-input" value={formData.navLink || ''} onChange={e => setFormData({...formData, navLink: e.target.value})} placeholder="הדבק כאן קישור (אופציונלי)" dir="ltr" />
              </div>

              <div className="form-group">
                <label className="form-label">קישור לאתר אינטרנט</label>
                <input type="url" className="form-input" value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="הדבק כאן קישור לאתר או לפייסבוק (אופציונלי)" dir="ltr" />
              </div>

              <div className="form-group">
                <label className="form-label">תיאור</label>
                <textarea className="form-input" rows="3" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              {formType === 'walkingRoutes' && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '12px' }}>עריכת מסלול על המפה</label>
                  <WalkingRouteEditor 
                    path={formData.path || []} 
                    waypoints={formData.waypoints || []} 
                    onChange={({ path, waypoints }) => setFormData({ ...formData, path, waypoints })}
                  />
                </div>
              )}
              
              <button type="submit" className="btn btn-primary mt-2">שמור פריט</button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ManageGuestInfo;
