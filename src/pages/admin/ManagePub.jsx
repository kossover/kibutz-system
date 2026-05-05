import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
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
  Plus,
  CurrencyCircleDollar
} from '@phosphor-icons/react';

function ManagePub() {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('menu'); 
  const [formData, setFormData] = useState({
    name: '',
    category: 'משקאות קלים',
    price: '',
    available: true,
    description: '',
    imageUrl: ''
  });

  const categories = ['משקאות קלים', 'משקאות חריפים', 'אוכל', 'חטיפים', 'אחר'];

  useEffect(() => {
    // Fetch users for phone numbers
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const umap = {};
        usersSnap.forEach(d => {
          umap[d.id] = d.data();
        });
        setUsersMap(umap);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();

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
        price: parseFloat(formData.price), available: formData.available,
        description: formData.description, imageUrl: formData.imageUrl
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
      price: item.price.toString(), available: item.available,
      description: item.description || '', imageUrl: item.imageUrl || ''
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

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק הזמנה זו לגמרי? פעולה זו אינה הפיכה.')) {
      try { await deleteDoc(doc(db, 'pubOrders', orderId)); } 
      catch (error) { console.error('Error:', error); alert('אירעה שגיאה במחיקת ההזמנה'); }
    }
  };

  const handleTogglePaid = async (order) => {
    try { 
      await updateDoc(doc(db, 'pubOrders', order.id), { isPaid: !order.isPaid }); 
    } 
    catch (error) { console.error('Error:', error); alert('אירעה שגיאה בעדכון התשלום'); }
  };

  const toggleAvailability = async (item) => {
    try { await updateDoc(doc(db, 'pubMenu', item.id), { available: !item.available }); } 
    catch (error) { console.error('Error:', error); alert('אירעה שגיאה'); }
  };

  const exportMonthlyReport = () => {
    try {
      const monthlyData = {};
      
      orders.forEach(order => {
        // Skip pending/canceled tabs if we only want completed tabs? 
        // We'll export all 'completed' (which means closed tabs) or any order with a total price > 0
        if (order.status !== 'completed' && order.status !== 'pending') return;
        if (!order.createdAt) return;

        const date = order.createdAt.toDate();
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthStr]) monthlyData[monthStr] = {};
        
        const uid = order.userId || 'unknown';
        if (!monthlyData[monthStr][uid]) {
          const u = usersMap[uid];
          monthlyData[monthStr][uid] = {
            'שם לקוח': order.userName || (u ? u.name : 'לא ידוע'),
            'טלפון': u ? (u.phone || '') : '',
            'סה"כ חוב (לא שולם)': 0,
            'סה"כ שולם': 0,
            'מספר הזמנות בחודש': 0
          };
        }
        
        monthlyData[monthStr][uid]['מספר הזמנות בחודש'] += 1;
        if (order.isPaid) {
          monthlyData[monthStr][uid]['סה"כ שולם'] += order.totalPrice || 0;
        } else {
          monthlyData[monthStr][uid]['סה"כ חוב (לא שולם)'] += order.totalPrice || 0;
        }
      });

      const wb = XLSX.utils.book_new();
      let hasData = false;

      // Create a sheet for each month
      Object.keys(monthlyData).sort((a,b) => b.localeCompare(a)).forEach(month => {
        const usersArray = Object.values(monthlyData[month]).sort((a,b) => b['סה"כ חוב (לא שולם)'] - a['סה"כ חוב (לא שולם)']);
        if (usersArray.length > 0) {
          hasData = true;
          const ws = XLSX.utils.json_to_sheet(usersArray);
          XLSX.utils.book_append_sheet(wb, ws, month);
        }
      });

      if (!hasData) {
        alert('אין נתונים ליצוא דוח חודשי');
        return;
      }

      XLSX.writeFile(wb, `דוח_חודשי_פאב_${new Date().toLocaleDateString('he-IL')}.xlsx`);
    } catch (error) { 
      console.error(error); 
      alert('שגיאה ביצוא דוח חודשי'); 
    }
  };

  const exportAllOrders = () => {
    try {
      const ordersData = orders.map(order => {
        const u = usersMap[order.userId];
        return {
          'תאריך': order.createdAt?.toDate().toLocaleDateString('he-IL'),
          'שעה': order.createdAt?.toDate().toLocaleTimeString('he-IL'),
          'לקוח': order.userName || (u ? u.name : 'לא ידוע'),
          'טלפון': u ? (u.phone || '') : '',
          'פריטים': order.items?.map(i => `${i.name} x${i.quantity}`).join(', '),
          'סה"כ': order.totalPrice,
          'סטטוס הזמנה': order.status === 'completed' ? 'הושלם (חשבון נסגר)' : order.status === 'pending' ? 'ממתין (חשבון פתוח)' : 'בוטל',
          'שולם?': order.isPaid ? 'כן' : 'לא'
        };
      });
      const ws = XLSX.utils.json_to_sheet(ordersData);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'כל ההזמנות');
      XLSX.writeFile(wb, `הזמנות_פאב_${new Date().toLocaleDateString('he-IL')}.xlsx`);
    } catch (error) { console.error(error); alert('שגיאה ביצוא'); }
  };

  const resetForm = () => {
    setFormData({ name: '', category: 'משקאות קלים', price: '', available: true, description: '', imageUrl: '' });
    setEditingItem(null); setShowForm(false);
  };

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול פאב</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportMonthlyReport} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            <DownloadSimple size={18} /> דוח חודשי מסכם
          </button>
          <button onClick={exportAllOrders} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            <DownloadSimple size={18} /> כל ההזמנות (פירוט)
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
                  <div className="form-group">
                    <label className="form-label">תיאור</label>
                    <input type="text" className="form-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">תמונה (העלאת קובץ)</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="form-input" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, imageUrl: reader.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    {formData.imageUrl && (
                      <div style={{ marginTop: 8 }}>
                        <img src={formData.imageUrl} alt="תצוגה מקדימה" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }} />
                        <button type="button" onClick={() => setFormData({ ...formData, imageUrl: '' })} className="btn btn-secondary" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', marginTop: 4, display: 'block' }}>הסר תמונה</button>
                      </div>
                    )}
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
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />
                      )}
                      <div>
                        <div className="font-bold text-lg">{item.name}</div>
                        <div className="text-sm text-muted">{item.category}</div>
                        {item.description && <div className="text-sm mt-1">{item.description}</div>}
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
            orders.map((order) => {
              const u = usersMap[order.userId];
              const phone = u ? u.phone : '';
              
              return (
                <div key={order.id} className="card" style={{ padding: 16, borderRight: `4px solid ${order.isPaid ? 'var(--success-color)' : (order.status === 'completed' ? 'var(--primary-color)' : 'var(--warning-color)')}`}}>
                  
                  <div className="flex-between mb-4" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '12px'}}>
                    <div>
                      <div className="font-bold text-lg">{order.userName || (u ? u.name : 'לא ידוע')}</div>
                      {phone && <div className="text-sm text-muted" dir="ltr" style={{textAlign: 'right'}}>{phone}</div>}
                    </div>
                    
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                      <span className={`chip ${order.status === 'completed' ? 'chip-blue' : order.status === 'pending' ? 'chip-amber' : 'chip-gray'}`}>
                        {order.status === 'completed' ? 'חשבון נסגר' : order.status === 'pending' ? 'חשבון פתוח' : 'בוטל'}
                      </span>
                      <button 
                        onClick={() => handleTogglePaid(order)}
                        className={`btn ${order.isPaid ? 'btn-success' : 'btn-secondary'}`} 
                        style={{width: 'auto', padding: '6px 12px', fontSize: '0.85rem'}}
                      >
                        <CurrencyCircleDollar size={18} /> {order.isPaid ? 'שולם' : 'סמן כשולם'}
                      </button>
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="btn btn-danger" 
                        style={{width: 'auto', padding: '6px 12px', fontSize: '0.85rem'}}
                        title="מחק הזמנה לחלוטין"
                      >
                        <Trash size={18} /> 
                      </button>
                    </div>
                  </div>

                  <div className="text-sm font-bold text-muted mb-2">
                    {order.createdAt?.toDate().toLocaleDateString('he-IL')} • {order.createdAt?.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex-between text-sm py-1" style={{borderBottom: '1px dashed var(--border-color)'}}>
                        <span>{item.name} x{item.quantity}</span>
                        <span>₪{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex-between font-bold" style={{fontSize: '1.2rem', color: order.isPaid ? 'var(--success-color)' : 'var(--text-color)'}}>
                    <span>סה"כ:</span>
                    <span>₪{order.totalPrice}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default ManagePub;