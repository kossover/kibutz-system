import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  Package, 
  Plus, 
  PencilSimple, 
  Trash, 
  MapPin, 
  ClockCounterClockwise,
  CheckCircle,
  FileXls,
  X,
  Camera,
  Note
} from '@phosphor-icons/react';

function ManageEquipment() {
  const [items, setItems] = useState([]);
  const [loans, setLoans] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewReturnData, setViewReturnData] = useState(null); // לצפייה בפרטי החזרה/לקיחה
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',      
    subLocation: '',   
    totalQuantity: 1,
    inUse: 0
  });

  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setItems(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const qLoans = query(collection(db, 'equipmentLoans'), orderBy('borrowDate', 'desc'));
    const unsubLoans = onSnapshot(qLoans, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setLoans(data);
    });

    return () => { unsubItems(); unsubLoans(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        totalQuantity: parseInt(formData.totalQuantity),
        updatedAt: serverTimestamp()
      };

      if (editingItem) {
        const { inUse, ...dataToUpdate } = payload; 
        await updateDoc(doc(db, 'equipment', editingItem.id), dataToUpdate);
        alert('הפריט עודכן בהצלחה');
      } else {
        payload.inUse = 0;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'equipment'), payload);
        alert('הפריט נוסף בהצלחה');
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert('שגיאה בשמירה: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק את הפריט?')) return;
    try { await deleteDoc(doc(db, 'equipment', id)); } 
    catch (error) { alert('שגיאה במחיקה'); }
  };

  // פונקציה להחזרה ידנית ע"י אדמין (למקרה שהמשתמש לא החזיר עצמאית)
  const handleAdminReturn = async (loan) => {
    if (!window.confirm(`האם לסמן ש-${loan.itemName} הוחזר?`)) return;
    
    try {
      const batch = writeBatch(db);
      const loanRef = doc(db, 'equipmentLoans', loan.id);
      batch.update(loanRef, { status: 'returned', returnDate: serverTimestamp() });
      const itemRef = doc(db, 'equipment', loan.itemId);
      batch.update(itemRef, { inUse: increment(-loan.quantity) });
      await batch.commit();
    } catch (error) {
      alert('שגיאה: ' + error.message);
    }
  };

  const exportInventory = () => {
    // ... יצוא לאקסל נשאר זהה ...
    const data = items.map(i => ({
      'שם': i.name,
      'תיאור': i.description,
      'מיקום': i.location,
      'סה"כ': i.totalQuantity,
      'בשימוש': i.inUse,
      'זמין': i.totalQuantity - (i.inUse || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מלאי");
    XLSX.writeFile(wb, "Inventory.xlsx");
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', location: '', subLocation: '', totalQuantity: 1, inUse: 0 });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeLoansCount = loans.filter(l => l.status === 'active').length;

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול מחסן ציוד</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportInventory} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 12px' }}>
            <FileXls size={18} /> יצוא לאקסל
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => setActiveTab('inventory')} style={{
            padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'inventory' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'inventory' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 'bold'
          }}>
          <Package size={20} /> מלאי
        </button>
        <button onClick={() => setActiveTab('loans')} style={{
            padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'loans' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'loans' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: 'bold'
          }}>
          <ClockCounterClockwise size={20} /> השאלות
          {activeLoansCount > 0 && <span className="chip chip-amber" style={{fontSize: '0.75rem', padding: '2px 6px', marginRight: 6}}>{activeLoansCount}</span>}
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className={`btn ${showForm ? 'btn-danger' : 'btn-accent'}`} style={{ width: 'auto', marginBottom: 20 }}>
            {showForm ? <><X size={18}/> ביטול</> : <><Plus size={18}/> פריט חדש</>}
          </button>

          {showForm && (
            <div className="card">
              <h3 className="text-bold mb-4">{editingItem ? 'ערוך' : 'חדש'}</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div className="form-group"><label className="form-label">שם *</label><input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                  <div className="form-group"><label className="form-label">כמות *</label><input type="number" className="form-input" min="1" value={formData.totalQuantity} onChange={e => setFormData({...formData, totalQuantity: e.target.value})} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div className="form-group"><label className="form-label">מחסן *</label><input className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required /></div>
                  <div className="form-group"><label className="form-label">מיקום</label><input className="form-input" value={formData.subLocation} onChange={e => setFormData({...formData, subLocation: e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">תיאור</label><textarea className="form-input" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}><button type="submit" className="btn btn-primary">שמור</button></div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {items.map(item => {
              const inUse = item.inUse || 0;
              const available = Math.max(0, item.totalQuantity - inUse);
              return (
                <div key={item.id} className="card" style={{ padding: 16 }}>
                  <div className="flex-between">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h3 className="text-bold">{item.name}</h3>
                        <span className={`chip ${available > 0 ? 'chip-green' : 'chip-danger'}`}>{available}/{item.totalQuantity}</span>
                      </div>
                      <div className="text-sm text-muted">{item.location} {item.subLocation && `• ${item.subLocation}`} {inUse > 0 && `• ${inUse} בחוץ`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEdit(item)} className="btn btn-secondary" style={{width:'auto', padding:8}}><PencilSimple size={18} /></button>
                      <button onClick={() => handleDelete(item.id)} className="btn btn-danger" style={{width:'auto', padding:8}}><Trash size={18} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'loans' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {loans.map(loan => {
            // אם ההשאלה פעילה (active), מציגים אותה ברשימה הרגילה למעלה (כפי שהיה קודם)
            // אם ההשאלה הוחזרה (returned), לא מציגים אותה כאן אלא בחלק התחתון "היסטוריית החזרות"
            if (loan.status !== 'active') return null;

            const isActive = true;
            const hasReturnInfo = loan.returnImage || loan.returnNotes;
            const hasBorrowImage = !!loan.loanImage;

            return (
              <div key={loan.id} className="card" style={{ padding: 16, borderRight: '4px solid #F59E0B' }}>
                <div className="flex-between" style={{flexWrap: 'wrap', gap: 16}}>
                  <div>
                    <div className="text-bold">{loan.itemName} <span className="chip chip-gray">x{loan.quantity}</span></div>
                    <div className="text-sm mt-1">👤 {loan.userName}</div>
                    <div className="text-sm text-muted">
                        נלקח: {loan.borrowDate?.toDate().toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(hasReturnInfo || hasBorrowImage) && (
                      <button 
                        onClick={() => setViewReturnData(loan)}
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        {hasReturnInfo ? 'פרטי החזרה' : 'תמונת לקיחה'}
                        {hasReturnInfo && <Camera size={16} />}
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleAdminReturn(loan)} 
                      className="btn btn-success" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      סמן כהוחזר
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {loans.filter(l => l.status === 'active').length === 0 && (
            <div className="empty-state">
              <div className="empty-state-text">אין השאלות פעילות כרגע 👍</div>
            </div>
          )}

          {/* היסטוריית החזרות */}
          {loans.filter(l => l.status === 'returned').length > 0 && (
             <div style={{ marginTop: 32 }}>
               <h3 className="text-bold mb-3" style={{fontSize: '1rem', color: 'var(--text-secondary)'}}>היסטוריית החזרות</h3>
               {loans.filter(l => l.status === 'returned').slice(0, 10).map(loan => (
                 <div key={loan.id} style={{ padding: 12, borderBottom: '1px solid var(--border-color)', opacity: 0.7 }}>
                   <div className="flex-between text-sm">
                     <span><b>{loan.userName}</b> החזיר/ה <b>{loan.quantity} x {loan.itemName}</b></span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <span className="text-muted">{loan.returnDate?.toDate().toLocaleDateString('he-IL')}</span>
                       {(loan.returnImage || loan.returnNotes || loan.loanImage) && (
                         <button 
                           onClick={() => setViewReturnData(loan)}
                           className="btn btn-secondary"
                           style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', minWidth: 'auto', borderRadius: '6px' }}
                           title="צפה בפרטי החזרה/לקיחה"
                         >
                           <Camera size={16} />
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      {/* Modal לצפייה בפרטים */}
      {viewReturnData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 3000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={() => setViewReturnData(null)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h3 className="text-bold">פרטי ציוד: {viewReturnData.itemName}</h3>
              <button onClick={() => setViewReturnData(null)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={24} /></button>
            </div>

            {viewReturnData.loanImage && (
                <div style={{marginBottom: 16}}>
                    <div className="text-sm font-bold mb-1">תמונה בעת לקיחה:</div>
                    <img src={viewReturnData.loanImage} style={{width:'100%', borderRadius: 8, maxHeight: 300, objectFit: 'contain', background: '#f0f0f0'}} />
                </div>
            )}

            {viewReturnData.returnImage && (
                <div style={{marginBottom: 16}}>
                    <div className="text-sm font-bold mb-1">תמונה בעת החזרה:</div>
                    <img src={viewReturnData.returnImage} style={{width:'100%', borderRadius: 8, maxHeight: 300, objectFit: 'contain', background: '#f0f0f0'}} />
                </div>
            )}

            {viewReturnData.returnNotes && (
                <div style={{background: '#FEF3C7', padding: 12, borderRadius: 8}}>
                    <div className="text-sm font-bold mb-1" style={{display:'flex', alignItems:'center', gap:6}}>
                        <Note size={16} /> הערות המשתמש:
                    </div>
                    <div>{viewReturnData.returnNotes}</div>
                </div>
            )}
            
            {!viewReturnData.returnImage && !viewReturnData.returnNotes && !viewReturnData.loanImage && (
                <div className="text-center text-muted">אין מידע נוסף זמין</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageEquipment;