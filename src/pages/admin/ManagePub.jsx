import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  BeerBottle, 
  List, 
  Receipt, 
  PencilSimple, 
  Trash, 
  Check, 
  X, 
  DownloadSimple,
  Plus
} from '@phosphor-icons/react';

function ManagePub() {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('menu'); 
  const [formData, setFormData] = useState({
    name: '',
    category: 'משקאות קלים',
    price: '',
    available: true
  });

  const categories = ['משקאות קלים', 'משקאות חריפים', 'אוכל', 'חטיפים', 'אחר'];

  useEffect(() => {
    const unsubscribeMenu = onSnapshot(collection(db, 'pubMenu'), (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setMenuItems(items.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const ordersQuery = query(collection(db, 'pubOrders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = [];
      snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    });

    return () => { unsubscribeMenu(); unsubscribeOrders(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        name: formData.name, category: formData.category,
        price: parseFloat(formData.price), available: formData.available
      };
      if (editingItem) {
        await updateDoc(doc(db, 'pubMenu', editingItem.id), itemData);
        alert('הפריט עודכן בהצלחה!');
      } else {
        await addDoc(collection(db, 'pubMenu'), itemData);
        alert('הפריט נוסף בהצלחה!');
      }
      resetForm();
    } catch (error) { console.error('Error:', error); alert('אירעה שגיאה: ' + error.message); }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name, category: item.category,
      price: item.price.toString(), available: item.available
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הפריט?')) {
      try { await deleteDoc(doc(db, 'pubMenu', itemId)); } 
      catch (error) { console.error('Error:', error); alert('אירעה שגיאה במחיקה'); }
    }
  };

  const toggleAvailability = async (item) => {
    try { await updateDoc(doc(db, 'pubMenu', item.id), { available: !item.available }); } 
    catch (error) { console.error('Error:', error); alert('אירעה שגיאה'); }
  };

  const exportDebts = async () => {
    try {
      const userDebts = {};
      for (const order of orders) {
        if (order.status === 'completed') {
          if (!userDebts[order.userId]) {
            const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', order.userId)));
            const userData = userDoc.docs[0]?.data();
            userDebts[order.userId] = {
              'שם': userData?.name || 'לא ידוע', 'מייל': userData?.email || '',
              'טלפון': userData?.phone || '', 'סה"כ חוב': 0, 'מספר הזמנות': 0
            };
          }
          userDebts[order.userId]['סה"כ חוב'] += order.totalPrice;
          userDebts[order.userId]['מספר הזמנות'] += 1;
        }
      }
      const debtsArray = Object.values(userDebts).filter(u => u['סה"כ חוב'] > 0);
      if (debtsArray.length === 0) { alert('אין חובות'); return; }
      const ws = XLSX.utils.json_to_sheet(debtsArray);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'חובות');
      XLSX.writeFile(wb, `חובות_פאב_${new Date().toLocaleDateString('he-IL')}.xlsx`);
    } catch (error) { console.error(error); alert('שגיאה ביצוא'); }
  };

  const exportAllOrders = () => {
    try {
      const ordersData = orders.map(order => ({
        'תאריך': order.createdAt?.toDate().toLocaleDateString('he-IL'),
        'שעה': order.createdAt?.toDate().toLocaleTimeString('he-IL'),
        'פריטים': order.items?.map(i => `${i.name} x${i.quantity}`).join(', '),
        'סה"כ': order.totalPrice,
        'סטטוס': order.status === 'completed' ? 'הושלם' : order.status === 'pending' ? 'ממתין' : 'בוטל'
      }));
      const ws = XLSX.utils.json_to_sheet(ordersData);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'הזמנות');
      XLSX.writeFile(wb, `הזמנות_פאב_${new Date().toLocaleDateString('he-IL')}.xlsx`);
    } catch (error) { console.error(error); alert('שגיאה ביצוא'); }
  };

  const resetForm = () => {
    setFormData({ name: '', category: 'משקאות קלים', price: '', available: true });
    setEditingItem(null); setShowForm(false);
  };

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול פאב</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportDebts} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            <DownloadSimple size={18} /> חובות
          </button>
          <button onClick={exportAllOrders} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            <DownloadSimple size={18} /> הזמנות
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
        <button onClick={() => setActiveTab('menu')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'menu' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'menu' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'menu' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <List size={20} /> תפריט
        </button>
        <button onClick={() => setActiveTab('orders')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'orders' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'orders' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'orders' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <Receipt size={20} /> הזמנות
        </button>
      </div>

      {activeTab === 'menu' ? (
        <>
          <button onClick={() => setShowForm(!showForm)} className={`btn ${showForm ? 'btn-danger' : 'btn-accent'}`} style={{width: 'auto', marginBottom: 24}}>
            {showForm ? <><X size={18} /> ביטול</> : <><Plus size={18} /> פריט חדש</>}
          </button>

          {showForm && (
            <div className="card">
              <h3 className="text-bold mb-4" style={{ fontSize: '1.25rem' }}>{editingItem ? 'ערוך פריט' : 'פריט חדש'}</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">שם הפריט *</label>
                    <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">קטגוריה *</label>
                    <select className="form-input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">מחיר (₪) *</label>
                    <input type="number" step="0.01" className="form-input" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.available} onChange={(e) => setFormData({ ...formData, available: e.target.checked })} style={{width: 20, height: 20}} />
                    <span className="form-label" style={{margin: 0}}>זמין להזמנה</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary">{editingItem ? 'עדכן פריט' : 'הוסף פריט'}</button>
                  <button type="button" onClick={resetForm} className="btn btn-secondary">ביטול</button>
                </div>
              </form>
            </div>
          )}

          {/* Menu Items List */}
          <div style={{ display: 'grid', gap: 12 }}>
            {menuItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><BeerBottle size={48} /></div>
                <div className="empty-state-text">אין פריטים בתפריט</div>
              </div>
            ) : (
              menuItems.map((item) => (
                <div key={item.id} className="card" style={{ padding: 16 }}>
                  <div className="flex-between">
                    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                      <div>
                        <div className="font-bold text-lg">{item.name}</div>
                        <div className="text-sm text-muted">{item.category}</div>
                      </div>
                      <div className="chip chip-blue" style={{fontSize: '1rem', fontWeight: 'bold'}}>₪{item.price}</div>
                    </div>
                    
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <button onClick={() => toggleAvailability(item)} className={`chip ${item.available ? 'chip-green' : 'chip-gray'}`} style={{border: 'none', cursor: 'pointer'}}>
                        {item.available ? 'זמין' : 'לא זמין'}
                      </button>
                      <button onClick={() => handleEdit(item)} className="btn btn-secondary" style={{width: 'auto', padding: 8, minWidth: 'auto'}}>
                        <PencilSimple size={18} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="btn btn-danger" style={{width: 'auto', padding: 8, minWidth: 'auto'}}>
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Orders List */
        <div style={{ display: 'grid', gap: 12 }}>
          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt size={48} /></div>
              <div className="empty-state-text">אין הזמנות עדיין</div>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="card" style={{ padding: 16, borderRight: `4px solid ${order.status === 'completed' ? 'var(--success-color)' : order.status === 'pending' ? 'var(--warning-color)' : 'var(--text-light)'}`}}>
                <div className="flex-between mb-2">
                  <div className="text-sm font-bold">
                    {order.createdAt?.toDate().toLocaleDateString('he-IL')} • {order.createdAt?.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className={`chip ${order.status === 'completed' ? 'chip-green' : order.status === 'pending' ? 'chip-amber' : 'chip-gray'}`}>
                    {order.status === 'completed' ? 'הושלם' : order.status === 'pending' ? 'ממתין' : 'בוטל'}
                  </span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex-between text-sm py-1" style={{borderBottom: '1px dashed var(--border-color)'}}>
                      <span>{item.name} x{item.quantity}</span>
                      <span>₪{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-between font-bold" style={{fontSize: '1.1rem'}}>
                  <span>סה"כ:</span>
                  <span>₪{order.totalPrice}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ManagePub;