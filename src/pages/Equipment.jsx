import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  MapPin,
  HandGrabbing,
  MagnifyingGlass,
  Info,
  CheckCircle,
  Warning,
  Camera,
  X,
  ArrowUUpLeft, // אייקון להחזרה
  NotePencil
} from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function Equipment() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Borrow Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [borrowForm, setBorrowForm] = useState({
    quantity: 1,
    approverId: ''
  });
  const [loanImage, setLoanImage] = useState(null);
  const [borrowing, setBorrowing] = useState(false);

  // Return Modal State
  const [returnItem, setReturnItem] = useState(null);
  const [returnImage, setReturnImage] = useState(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [returning, setReturning] = useState(false);

  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(u => setUser(u));

    const unsubItems = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setItems(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const loadAdmins = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'culture_admin']));
        const snapshot = await getDocs(q);
        const adminList = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.firstName && data.lastName) ? `${data.firstName} ${data.lastName}` : (data.name || data.email)
          };
        });
        setAdmins(adminList);
      } catch (e) {
        console.error("Failed to load admins", e);
      }
    };
    loadAdmins();

    return () => { unsubAuth(); unsubItems(); };
  }, []);

  useEffect(() => {
    if (!user) {
      setMyLoans([]);
      return;
    }
    const q = query(
      collection(db, 'equipmentLoans'),
      where('userId', '==', user.uid),
      where('status', '==', 'active')
    );
    const unsubLoans = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setMyLoans(data);
    });
    return () => unsubLoans();
  }, [user]);

  // פונקציית עזר לעיבוד תמונה (Resize)
  const processImage = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        callback(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleBorrowCapture = (e) => {
    const file = e.target.files[0];
    if (file) processImage(file, setLoanImage);
  };

  const handleReturnCapture = (e) => {
    const file = e.target.files[0];
    if (file) processImage(file, setReturnImage);
  };

  const handleBorrow = async (e) => {
    e.preventDefault();
    if (!user || !selectedItem) return;

    const qty = parseInt(borrowForm.quantity);
    const available = selectedItem.totalQuantity - (selectedItem.inUse || 0);

    if (qty <= 0) return alert("הכמות חייבת להיות לפחות 1");
    if (qty > available) return alert(`מצטערים, נותרו רק ${available} יחידות במלאי.`);
    if (!borrowForm.approverId) return alert('נא לבחור מי הגורם שאישר את ההשאלה');

    setBorrowing(true);
    try {
      const approver = admins.find(a => a.id === borrowForm.approverId);
      const batch = writeBatch(db);

      const loanRef = doc(collection(db, 'equipmentLoans'));
      batch.set(loanRef, {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        userId: user.uid,
        userName: user.displayName || 'משתמש',
        approverId: borrowForm.approverId,
        approverName: approver?.name || 'לא ידוע',
        quantity: qty,
        borrowDate: serverTimestamp(),
        status: 'active',
        loanImage: loanImage || null
      });

      const itemRef = doc(db, 'equipment', selectedItem.id);
      batch.update(itemRef, { inUse: increment(qty) });

      await batch.commit();
      alert('ההשאלה נרשמה בהצלחה!');
      setSelectedItem(null);
      setBorrowForm({ quantity: 1, approverId: '' });
      setLoanImage(null);
    } catch (error) {
      console.error(error);
      alert('אירעה שגיאה ברישום ההשאלה');
    } finally {
      setBorrowing(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!returnItem) return;

    // בדיקת חובה לתמונה
    if (!returnImage) {
      alert('חובה לצלם את הפריט במקומו כדי להחזיר.');
      return;
    }

    setReturning(true);
    try {
      const batch = writeBatch(db);

      // 1. עדכון ההשאלה לסטטוס הוחזר עם פרטי ההחזרה
      const loanRef = doc(db, 'equipmentLoans', returnItem.id);
      batch.update(loanRef, {
        status: 'returned',
        returnDate: serverTimestamp(),
        returnImage: returnImage,
        returnNotes: returnNotes || ''
      });

      // 2. עדכון המלאי (שחרור הפריטים)
      const itemRef = doc(db, 'equipment', returnItem.itemId);
      batch.update(itemRef, {
        inUse: increment(-returnItem.quantity)
      });

      await batch.commit();
      alert('הציוד הוחזר בהצלחה! תודה רבה.');

      // איפוס
      setReturnItem(null);
      setReturnImage(null);
      setReturnNotes('');
    } catch (error) {
      console.error(error);
      alert('אירעה שגיאה בהחזרת הציוד');
    } finally {
      setReturning(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <h1 className="page-title">מחסן ציוד</h1>

      {!user && (
        <div className="login-notice">
          <Info size={24} weight="fill" color="var(--accent-color)" />
          <div>
            לצפייה במלאי אין צורך להתחבר, אך כדי לשאול ציוד - <button onClick={() => navigate('/login')} style={{ cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold', border: 'none', background: 'none', color: 'inherit', padding: 0 }}>התחבר כאן</button>.
          </div>
        </div>
      )}

      {/* החזקות שלי */}
      {myLoans.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 className="text-bold" style={{ fontSize: '1.2rem', marginBottom: 12 }}>ציוד שאצלי</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {myLoans.map(loan => (
              <div key={loan.id} className="card" style={{ padding: 16, borderRight: '4px solid var(--accent-color)' }}>
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="text-bold">{loan.itemName} <span className="chip chip-blue" style={{ marginLeft: 8 }}>x{loan.quantity}</span></div>
                    <div className="text-sm text-muted mt-1">נלקח ב: {loan.borrowDate?.toDate().toLocaleDateString('he-IL')}</div>
                  </div>

                  <button
                    onClick={() => { setReturnItem(loan); setReturnImage(null); setReturnNotes(''); }}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '8px 16px', fontSize: '0.9rem', gap: 6 }}
                  >
                    <ArrowUUpLeft size={18} weight="bold" /> החזר ציוד
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* חיפוש ורשימה */}
      <div className="pro-search" style={{ position: 'relative', marginBottom: 20 }}>
        <span className="icon" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
          <MagnifyingGlass size={20} />
        </span>
        <input
          type="text"
          className="form-input"
          placeholder="חפש ציוד (למשל: שולחנות, כבלים...)"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ paddingRight: 40 }}
        />
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {filteredItems.map(item => {
          const inUse = item.inUse || 0;
          const available = Math.max(0, item.totalQuantity - inUse);
          const isOutOfStock = available <= 0;

          return (
            <div key={item.id} className="card" style={{ padding: 16, opacity: isOutOfStock ? 0.7 : 1 }}>
              <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="flex-between mb-2" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <h3 className="text-bold" style={{ fontSize: '1.1rem', margin: 0 }}>{item.name}</h3>
                    <span className={`chip ${!isOutOfStock ? 'chip-green' : 'chip-gray'}`}>
                      {!isOutOfStock ? `זמין: ${available}` : 'לא במלאי'}
                    </span>
                  </div>
                  <div className="text-sm text-muted" style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MapPin size={16} />
                    {item.location} {item.subLocation && `• ${item.subLocation}`}
                  </div>
                  {item.description && <div className="text-sm text-muted">{item.description}</div>}
                </div>

                {user && !isOutOfStock && (
                  <button
                    onClick={() => { setSelectedItem(item); setBorrowForm({ ...borrowForm, quantity: 1 }); setLoanImage(null); }}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '8px 16px', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}
                  >
                    <HandGrabbing size={20} /> קח
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && <div className="empty-state"><div className="empty-state-text">לא נמצאו פריטים</div></div>}
      </div>

      {/* Borrow Modal */}
      {selectedItem && (
        <div className="modal-overlay">
          <div className="card modal-content">
            <h3 className="text-bold mb-4">השאלת {selectedItem.name}</h3>
            <form onSubmit={handleBorrow}>
              <div className="form-group">
                <label className="form-label">כמות להשאלה (עד {selectedItem.totalQuantity - (selectedItem.inUse || 0)})</label>
                <input type="number" className="form-input" min="1" max={selectedItem.totalQuantity - (selectedItem.inUse || 0)} value={borrowForm.quantity} onChange={e => setBorrowForm({ ...borrowForm, quantity: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">מי אישר? *</label>
                <select className="form-input" value={borrowForm.approverId} onChange={e => setBorrowForm({ ...borrowForm, approverId: e.target.value })} required>
                  <option value="">בחר...</option>
                  {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">צילום בעת לקיחה (אופציונלי)</label>
                <ImageCapture value={loanImage} onChange={handleBorrowCapture} label="צלם/בחר תמונה" onClear={() => setLoanImage(null)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={borrowing || admins.length === 0}>{borrowing ? 'רושם...' : 'אשר השאלה'}</button>
                <button type="button" onClick={() => { setSelectedItem(null); setLoanImage(null); }} className="btn btn-secondary">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnItem && (
        <div className="modal-overlay">
          <div className="card modal-content">
            <h3 className="text-bold mb-4">החזרת {returnItem.itemName}</h3>
            <div className="alert-box" style={{ background: '#EFF6FF', border: '1px solid #3B82F6', color: '#1E3A8A', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
              <Info size={20} style={{ float: 'right', marginLeft: 8 }} />
              עליך לצלם את הציוד במקומו כדי לוודא החזרה תקינה.
            </div>

            <form onSubmit={handleReturn}>
              <div className="form-group">
                <label className="form-label">צילום הפריט במקום (חובה) *</label>
                <ImageCapture value={returnImage} onChange={handleReturnCapture} label="צלם תמונה במקום" onClear={() => setReturnImage(null)} />
              </div>

              <div className="form-group">
                <label className="form-label">הערות על מצב הציוד / תקלות</label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="האם הכל תקין? האם משהו נשבר?"
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                  />
                  <NotePencil size={20} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-secondary)' }} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-success" disabled={returning || !returnImage}>
                  {returning ? 'מחזיר...' : 'אשר החזרה'}
                </button>
                <button type="button" onClick={() => { setReturnItem(null); setReturnImage(null); setReturnNotes(''); }} className="btn btn-secondary">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BackButton pageKey="equipment" />
      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 2000;
          display: flex; justifyContent: center; alignItems: center; padding: 20px;
        }
        .modal-content {
          width: 100%; max-width: 400px; margin: 0; max-height: 90vh; overflow-y: auto;
        }
        .modal-actions {
          display: flex; gap: 12px; margin-top: 24px;
        }
      `}</style>
    </div>
  );
}

// קומפוננטת עזר לצילום
const ImageCapture = ({ value, onChange, label, onClear }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <label className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', border: '1px dashed var(--text-secondary)' }}>
      <Camera size={20} /> {value ? 'החלף תמונה' : label}
      <input type="file" accept="image/*" capture="environment" onChange={onChange} style={{ display: 'none' }} />
    </label>
    {value && (
      <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <img src={value} alt="תצוגה" style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'contain', background: '#f0f0f0' }} />
        <button type="button" onClick={onClear} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>
    )}
  </div>
);

export default Equipment;