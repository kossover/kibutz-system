import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, setDoc } from 'firebase/firestore';
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
  CurrencyCircleDollar,
  Table,
  CaretDown,
  CaretUp,
  CalendarBlank,
  Copy,
  ListChecks,
  Eye,
  Package,
  DotsSixVertical
} from '@phosphor-icons/react';

function ManagePub() {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('menu'); 
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedUsers, setExpandedUsers] = useState({});
  const [checklists, setChecklists] = useState({ opening: [], closing: [] });
  const [newOpeningTask, setNewOpeningTask] = useState('');
  const [newOpeningTaskDesc, setNewOpeningTaskDesc] = useState('');
  const [newClosingTask, setNewClosingTask] = useState('');
  const [newClosingTaskDesc, setNewClosingTaskDesc] = useState('');
  const [viewingEvent, setViewingEvent] = useState(null);
  const [bartendersPool, setBartendersPool] = useState([]);
  const [bartenderSearch, setBartenderSearch] = useState('');
  
  const [editingTask, setEditingTask] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  
  const [inventoryItems, setInventoryItems] = useState([]);
  const [newInvName, setNewInvName] = useState('');
  const [newInvReq, setNewInvReq] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'משקאות קלים',
    price: '',
    available: true,
    availableAtPool: false,
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
          umap[d.id] = { id: d.id, ...d.data() };
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

    const eventsQuery = query(collection(db, 'pubEvents'), orderBy('createdAt', 'desc'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = [];
      snapshot.forEach((doc) => eventsData.push({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);
    });

    const unsubscribeChecklists = onSnapshot(doc(db, 'pubSettings', 'checklists'), (docSnap) => {
      if (docSnap.exists()) {
        setChecklists(docSnap.data());
      } else {
        setChecklists({ opening: [], closing: [] });
      }
    });

    const unsubscribeInventory = onSnapshot(collection(db, 'pubInventory'), (snapshot) => {
      const items = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setInventoryItems(items.sort((a,b) => a.name.localeCompare(b.name)));
    });

    const unsubscribeBartenders = onSnapshot(doc(db, 'pubSettings', 'bartenders'), (docSnap) => {
      if (docSnap.exists()) {
        setBartendersPool(docSnap.data().pool || []);
      } else {
        setBartendersPool([]);
      }
    });

    return () => { unsubscribeMenu(); unsubscribeOrders(); unsubscribeEvents(); unsubscribeChecklists(); unsubscribeInventory(); unsubscribeBartenders(); };
  }, []);

  const handleAddBartender = async (userId) => {
    if (bartendersPool.includes(userId)) return;
    const newPool = [...bartendersPool, userId];
    try {
      await setDoc(doc(db, 'pubSettings', 'bartenders'), { pool: newPool }, { merge: true });
      setBartenderSearch('');
    } catch (err) {
      console.error(err);
      alert('שגיאה בהוספת ברמן');
    }
  };

  const handleRemoveBartender = async (userId) => {
    const newPool = bartendersPool.filter(id => id !== userId);
    try {
      await setDoc(doc(db, 'pubSettings', 'bartenders'), { pool: newPool }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChecklistTask = async (type) => {
    const taskName = type === 'opening' ? newOpeningTask : newClosingTask;
    const taskDesc = type === 'opening' ? newOpeningTaskDesc : newClosingTaskDesc;
    if (!taskName) return;
    
    const taskObj = { name: taskName, description: taskDesc || '' };
    
    const newTasks = [...(checklists[type] || [])];
    if (editingTask && editingTask.type === type) {
      newTasks[editingTask.index] = taskObj;
    } else {
      newTasks.push(taskObj);
    }
    
    try {
      await setDoc(doc(db, 'pubSettings', 'checklists'), {
        ...checklists,
        [type]: newTasks
      }, { merge: true });
      
      if (editingTask && editingTask.type === type) setEditingTask(null);
      if (type === 'opening') { setNewOpeningTask(''); setNewOpeningTaskDesc(''); }
      else { setNewClosingTask(''); setNewClosingTaskDesc(''); }
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת משימה');
    }
  };

  const handleEditTaskInit = (type, index) => {
    const task = checklists[type][index];
    const tName = typeof task === 'string' ? task : task.name;
    const tDesc = typeof task === 'string' ? '' : task.description;
    
    if (type === 'opening') {
      setNewOpeningTask(tName);
      setNewOpeningTaskDesc(tDesc);
      if (editingTask?.type === 'closing') { setNewClosingTask(''); setNewClosingTaskDesc(''); }
    } else {
      setNewClosingTask(tName);
      setNewClosingTaskDesc(tDesc);
      if (editingTask?.type === 'opening') { setNewOpeningTask(''); setNewOpeningTaskDesc(''); }
    }
    setEditingTask({ type, index });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDragStart = (e, index, type) => {
    setDraggedItem({ index, type });
  };
  
  const handleDragEnter = (e, index, type) => {
    e.preventDefault();
    if (draggedItem && draggedItem.type === type && draggedItem.index !== index) {
      const newList = [...(checklists[type] || [])];
      const draggedObj = newList.splice(draggedItem.index, 1)[0];
      newList.splice(index, 0, draggedObj);
      setChecklists({ ...checklists, [type]: newList }); // optimistic
      setDraggedItem({ index, type });
    }
  };
  
  const handleDragEnd = async () => {
    if (draggedItem) {
      try {
        await setDoc(doc(db, 'pubSettings', 'checklists'), checklists, { merge: true });
      } catch (err) {
        console.error(err);
      }
      setDraggedItem(null);
    }
  };

  const handleRemoveChecklistTask = async (type, index) => {
    const newTasks = [...(checklists[type] || [])];
    newTasks.splice(index, 1);
    try {
      await setDoc(doc(db, 'pubSettings', 'checklists'), {
        ...checklists,
        [type]: newTasks
      }, { merge: true });
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקת משימה');
    }
  };

  const handleAddInventory = async (e) => {
    e.preventDefault();
    if (!newInvName || !newInvReq) return;
    try {
      await addDoc(collection(db, 'pubInventory'), {
        name: newInvName,
        requiredQuantity: parseInt(newInvReq),
        actualQuantity: 0
      });
      setNewInvName('');
      setNewInvReq('');
    } catch(err) {
      console.error(err);
      alert('שגיאה בהוספת פריט למלאי');
    }
  };

  const handleDeleteInventory = async (id) => {
    if (window.confirm('האם למחוק פריט זה מהמלאי?')) {
      try {
        await deleteDoc(doc(db, 'pubInventory', id));
      } catch(err) {
        console.error(err);
      }
    }
  };

  const createEvent = async () => {
    const name = window.prompt("הזן שם לאירוע (למשל: פאב חמישי 5.5):");
    if (!name) return;
    try {
      await addDoc(collection(db, 'pubEvents'), {
        name,
        date: new Date().toISOString(),
        createdAt: new Date(),
        active: true
      });
      alert('האירוע נוצר בהצלחה!');
    } catch (err) {
      console.error(err);
      alert('שגיאה ביצירת אירוע');
    }
  };

  const copyBartenderLink = (eventId) => {
    const url = `${window.location.origin}/pub/bartender/${eventId}`;
    navigator.clipboard.writeText(url);
    alert('הקישור הועתק! ניתן לשלוח אותו לברמנים.');
  };

  const availableMonths = [...new Set(orders.map(o => {
    if (!o.createdAt) return null;
    const d = o.createdAt.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const toggleUserExpanded = (userId) => {
    setExpandedUsers(prev => ({...prev, [userId]: !prev[userId]}));
  };

  const getMonthlyData = () => {
    const data = {};
    orders.forEach(order => {
      if (order.status !== 'completed' && order.status !== 'pending') return;
      if (!order.createdAt) return;
      
      const d = order.createdAt.toDate();
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (mStr !== selectedMonth) return;

      const uid = order.userId || 'unknown';
      if (!data[uid]) {
        const u = usersMap[uid];
        data[uid] = {
          userId: uid,
          name: order.userName || (u ? u.name : 'לא ידוע'),
          phone: u ? (u.phone || '') : '',
          totalPaid: 0,
          totalDebt: 0,
          orders: []
        };
      }
      
      data[uid].orders.push(order);
      if (order.isPaid) {
        data[uid].totalPaid += order.totalPrice || 0;
      } else {
        data[uid].totalDebt += order.totalPrice || 0;
      }
    });
    return Object.values(data).sort((a,b) => b.totalDebt - a.totalDebt);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        name: formData.name, category: formData.category,
        price: parseFloat(formData.price), available: formData.available,
        availableAtPool: formData.availableAtPool,
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
      price: item.price.toString(), available: item.available !== false,
      availableAtPool: item.availableAtPool || false,
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
    catch (error) { console.error('Error:', error); alert('אירעה שגיאה בעדכון זמינות פאב'); }
  };

  const togglePoolAvailability = async (item) => {
    try { await updateDoc(doc(db, 'pubMenu', item.id), { availableAtPool: !item.availableAtPool }); } 
    catch (error) { console.error('Error:', error); alert('אירעה שגיאה בעדכון זמינות בריכה'); }
  };

  const exportMonthlyReport = () => {
    try {
      const monthlyData = {};
      
      orders.forEach(order => {
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
          'מקור': order.source === 'pool' ? 'בריכה' : 'פאב',
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

  const exportDebtReport = () => {
    try {
      const data = getMonthlyData();
      const exportData = data.filter(u => u.totalDebt > 0).map(u => ({
        'שם לקוח': u.name,
        'טלפון': u.phone,
        'סכום לחיוב (₪)': u.totalDebt
      }));
      if (exportData.length === 0) {
        alert('אין חובות לחודש זה');
        return;
      }
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, `חיוב חודש ${selectedMonth}`);
      XLSX.writeFile(wb, `חיוב_לקוחות_פאב_${selectedMonth}.xlsx`);
    } catch(err) {
      console.error(err);
      alert('שגיאה ביצוא דוח חובות');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: 'משקאות קלים', price: '', available: true, availableAtPool: false, description: '', imageUrl: '' });
    setEditingItem(null); setShowForm(false);
  };

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול פאב</h2>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/pub/order'); alert('הקישור להזמנות פאב הועתק') }} style={{ width: 'auto' }}>
            <Copy size={18} /> העתק קישור פאב
          </button>
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/pub/pool-order'); alert('הקישור להזמנות בריכה הועתק') }} style={{ width: 'auto' }}>
            <Copy size={18} /> העתק קישור בריכה
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
          <Receipt size={20} /> הזמנות לחשבון
        </button>
        <button onClick={() => setActiveTab('reports')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'reports' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'reports' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'reports' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <Table size={20} /> דוחות וייצוא חודשי
        </button>
        <button onClick={() => setActiveTab('events')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'events' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'events' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'events' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <CalendarBlank size={20} /> אירועים וברמנים
        </button>
        <button onClick={() => setActiveTab('checklists')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'checklists' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'checklists' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'checklists' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <ListChecks size={20} /> צ'קליסט פתיחה/סגירה
        </button>
        <button onClick={() => setActiveTab('inventory')} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--primary-color)' : 'none',
            color: activeTab === 'inventory' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'inventory' ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
          <Package size={20} /> ניהול מלאי
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
                          reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 500;
                              const MAX_HEIGHT = 500;
                              let width = img.width;
                              let height = img.height;

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
                              setFormData({ ...formData, imageUrl: dataUrl });
                            };
                            img.src = event.target.result;
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

                <div className="form-group" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.available} onChange={(e) => setFormData({ ...formData, available: e.target.checked })} style={{width: 20, height: 20}} />
                    <span className="form-label" style={{margin: 0}}>זמין להזמנה בפאב</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.availableAtPool} onChange={(e) => setFormData({ ...formData, availableAtPool: e.target.checked })} style={{width: 20, height: 20}} />
                    <span className="form-label" style={{margin: 0}}>זמין להזמנה בבריכה</span>
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
                    
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                      <button onClick={() => toggleAvailability(item)} className={`chip ${item.available ? 'chip-green' : 'chip-gray'}`} style={{border: 'none', cursor: 'pointer'}}>
                        פאב: {item.available ? 'זמין' : 'לא זמין'}
                      </button>
                      <button onClick={() => togglePoolAvailability(item)} className={`chip ${item.availableAtPool ? 'chip-green' : 'chip-gray'}`} style={{border: 'none', cursor: 'pointer'}}>
                        בריכה: {item.availableAtPool ? 'זמין' : 'לא זמין'}
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
      ) : activeTab === 'orders' ? (
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
                      <span className={`chip ${order.source === 'pool' ? 'chip-blue' : 'chip-amber'}`} style={{background: order.source === 'pool' ? '#e0f2fe' : '#fef3c7', color: order.source === 'pool' ? '#0284c7' : '#d97706'}}>
                        {order.source === 'pool' ? 'בריכה' : 'פאב'}
                      </span>
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
      ) : activeTab === 'reports' ? (
        /* Reports Tab */
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div className="flex-between mb-4 flex-wrap gap-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 className="text-xl font-bold">סיכום לקוחות לחודש:</h3>
                <select 
                  className="form-input" 
                  style={{ width: 'auto', minWidth: 150, padding: '8px 16px' }}
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={exportDebtReport} className="btn btn-primary" style={{width: 'auto', padding: '8px 16px', background: 'var(--success-color)'}}>
                  <DownloadSimple size={18} /> הורד דוח לקוחות לחיוב (סכום בלבד)
                </button>
                <button onClick={exportMonthlyReport} className="btn btn-secondary" style={{width: 'auto', padding: '8px 16px'}}>
                  <DownloadSimple size={18} /> הורד דוח אקסל מלא
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: 24 }}>
              {getMonthlyData().length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-text">אין הזמנות בחודש זה</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {getMonthlyData().map(userData => (
                    <div key={userData.userId} style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                      <div 
                        className="flex-between" 
                        style={{ padding: '16px 20px', background: 'var(--bg-subtle)', cursor: 'pointer' }}
                        onClick={() => toggleUserExpanded(userData.userId)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <button className="btn btn-secondary" style={{ padding: 4, minWidth: 'auto', borderRadius: '50%' }}>
                            {expandedUsers[userData.userId] ? <CaretUp size={16} /> : <CaretDown size={16} />}
                          </button>
                          <div>
                            <div className="font-bold text-lg">{userData.name}</div>
                            <div className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{userData.phone}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 24, textAlign: 'center' }}>
                          <div>
                            <div className="text-sm text-muted">חוב (לחיוב)</div>
                            <div className="font-bold" style={{ color: 'var(--danger-color)', fontSize: '1.2rem' }}>₪{userData.totalDebt}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted">כבר שולם</div>
                            <div className="font-bold" style={{ color: 'var(--success-color)', fontSize: '1.2rem' }}>₪{userData.totalPaid}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted">הזמנות</div>
                            <div className="font-bold" style={{ fontSize: '1.2rem' }}>{userData.orders.length}</div>
                          </div>
                        </div>
                      </div>

                      {expandedUsers[userData.userId] && (
                        <div style={{ padding: 20, background: 'var(--bg-body)', borderTop: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'grid', gap: 12 }}>
                            {userData.orders.map(order => (
                              <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'white', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                <div>
                                  <div className="text-sm font-bold text-muted mb-1" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span>{order.createdAt?.toDate().toLocaleDateString('he-IL')} • {order.createdAt?.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      background: order.source === 'pool' ? '#e0f2fe' : '#fef3c7',
                                      color: order.source === 'pool' ? '#0284c7' : '#d97706'
                                    }}>
                                      {order.source === 'pool' ? 'בריכה' : 'פאב'}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    {order.items?.map(i => `${i.name} x${i.quantity}`).join(', ')}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                  <div className="font-bold">₪{order.totalPrice}</div>
                                  <span className={`chip ${order.isPaid ? 'chip-green' : 'chip-gray'}`} style={{ marginTop: 4, display: 'inline-block', fontSize: '0.75rem', padding: '2px 8px' }}>
                                    {order.isPaid ? 'שולם' : 'חוב'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'events' ? (
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 className="text-xl font-bold mb-4">צוות ברמנים</h3>
            <p className="text-muted mb-4">הגדר כאן את המשתמשים שהם חלק מצוות הברמנים. הם יוכלו להיבחר כברמנים פעילים במשמרת במסך הברמן.</p>
            
            <div className="form-group relative mb-4">
              <input 
                type="text" 
                className="form-input" 
                placeholder="חיפוש משתמש להוספה כברמן (שם או טלפון)..." 
                value={bartenderSearch}
                onChange={e => setBartenderSearch(e.target.value)}
              />
              {bartenderSearch.length > 1 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {Object.values(usersMap).filter(u => (u.name?.includes(bartenderSearch) || u.phone?.includes(bartenderSearch)) && !bartendersPool.includes(u.id)).map(u => (
                    <div key={u.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="font-bold">{u.name}</div>
                        <div className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{u.phone}</div>
                      </div>
                      <button onClick={() => handleAddBartender(u.id)} className="btn btn-primary" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}>הוסף לצוות</button>
                    </div>
                  ))}
                  {Object.values(usersMap).filter(u => (u.name?.includes(bartenderSearch) || u.phone?.includes(bartenderSearch)) && !bartendersPool.includes(u.id)).length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>לא נמצאו משתמשים או שהם כבר בצוות</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {bartendersPool.map(userId => {
                const u = usersMap[userId];
                if (!u) return null;
                return (
                  <div key={userId} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{u.phone}</div>
                    </div>
                    <button onClick={() => handleRemoveBartender(userId)} className="btn btn-danger" style={{ width: 32, height: 32, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash size={16} />
                    </button>
                  </div>
                );
              })}
              {bartendersPool.length === 0 && <div className="text-muted">לא הוגדרו ברמנים עדיין</div>}
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div className="flex-between mb-4">
              <h3 className="text-xl font-bold">ניהול אירועים וקישורים לברמנים</h3>
              <button onClick={createEvent} className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>
                <Plus size={18} /> יצירת אירוע חדש
              </button>
            </div>
            <p className="text-muted mb-4" style={{ lineHeight: 1.5 }}>
              לכל אירוע נוצר קישור ייחודי ומאובטח המכיל קוד סודי (Token). <br/>
              אתה יכול להעתיק את הקישור ולשלוח אותו בווטסאפ לברמנים - הם יוכלו להיכנס למסך הברמן של האירוע הספציפי בלי צורך להזדהות במערכת, ולא יוכלו לראות שום דבר אחר.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              {events.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-text">אין אירועים פעילים. צור אירוע כדי להתחיל.</div>
                </div>
              ) : (
                events.map(ev => {
                  const dateStr = ev.createdAt?.toDate ? ev.createdAt.toDate().toLocaleDateString('he-IL') : new Date(ev.createdAt).toLocaleDateString('he-IL');
                  const url = `${window.location.origin}/pub/bartender/${ev.id}`;
                  return (
                    <div key={ev.id} className="card" style={{ padding: 16, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <div className="font-bold text-lg">{ev.name}</div>
                        <div className="text-sm text-muted">נוצר ב: {dateStr}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ background: 'var(--bg-body)', padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-muted)', direction: 'ltr', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {url}
                        </div>
                        <button onClick={() => setViewingEvent(ev)} className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>
                          <Eye size={18} /> צפה בדוח אירוע
                        </button>
                        <button onClick={() => copyBartenderLink(ev.id)} className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }}>
                          <Copy size={18} /> העתק קישור לברמן
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'checklists' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 className="text-xl font-bold mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListChecks size={24} color="var(--primary-color)" /> צ'קליסט פתיחה
            </h3>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="כותרת המשימה בעמדת הפתיחה..." 
                value={newOpeningTask}
                onChange={(e) => setNewOpeningTask(e.target.value)}
              />
              <textarea 
                className="form-input" 
                placeholder="הסבר אופציונלי על ביצוע המשימה (טקסט ארוך לברמנים)" 
                value={newOpeningTaskDesc}
                onChange={(e) => setNewOpeningTaskDesc(e.target.value)}
                rows={2}
              />
              <button 
                onClick={() => {
                  if (editingTask && editingTask.type !== 'opening') setEditingTask(null);
                  handleAddChecklistTask('opening');
                }} 
                className="btn btn-primary" 
                style={{ width: 'auto' }}
              >
                {editingTask && editingTask.type === 'opening' ? <><Check size={20} /> שמור עריכה</> : <><Plus size={20} /> הוסף משימה</>}
              </button>
              {editingTask && editingTask.type === 'opening' && (
                <button onClick={() => { setEditingTask(null); setNewOpeningTask(''); setNewOpeningTaskDesc(''); }} className="btn btn-secondary" style={{ width: 'auto' }}>
                  <X size={20} /> ביטול
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(!checklists.opening || checklists.opening.length === 0) && <div className="text-muted">אין משימות.</div>}
              {checklists.opening?.map((task, idx) => {
                const tName = typeof task === 'string' ? task : task.name;
                const tDesc = typeof task === 'string' ? '' : task.description;
                return (
                  <div 
                    key={idx} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx, 'opening')}
                    onDragEnter={(e) => handleDragEnter(e, idx, 'opening')}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className="flex-between" 
                    style={{ padding: '12px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', alignItems: 'flex-start', cursor: 'grab', opacity: draggedItem && draggedItem.index === idx && draggedItem.type === 'opening' ? 0.4 : 1 }}
                  >
                    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                      <DotsSixVertical size={24} color="var(--text-muted)" style={{ cursor: 'grab', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="font-bold">{tName}</div>
                        {tDesc && <div className="text-sm text-muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{tDesc}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEditTaskInit('opening', idx)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: 4 }}><PencilSimple size={18} /></button>
                      <button onClick={() => handleRemoveChecklistTask('opening', idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 4 }}><Trash size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 className="text-xl font-bold mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListChecks size={24} color="var(--primary-color)" /> צ'קליסט סגירה
            </h3>
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="כותרת המשימה בעמדת הסגירה..." 
                value={newClosingTask}
                onChange={(e) => setNewClosingTask(e.target.value)}
              />
              <textarea 
                className="form-input" 
                placeholder="הסבר אופציונלי על ביצוע המשימה (טקסט ארוך לברמנים)" 
                value={newClosingTaskDesc}
                onChange={(e) => setNewClosingTaskDesc(e.target.value)}
                rows={2}
              />
              <button 
                onClick={() => {
                  if (editingTask && editingTask.type !== 'closing') setEditingTask(null);
                  handleAddChecklistTask('closing');
                }} 
                className="btn btn-primary" 
                style={{ width: 'auto' }}
              >
                {editingTask && editingTask.type === 'closing' ? <><Check size={20} /> שמור עריכה</> : <><Plus size={20} /> הוסף משימה</>}
              </button>
              {editingTask && editingTask.type === 'closing' && (
                <button onClick={() => { setEditingTask(null); setNewClosingTask(''); setNewClosingTaskDesc(''); }} className="btn btn-secondary" style={{ width: 'auto' }}>
                  <X size={20} /> ביטול
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(!checklists.closing || checklists.closing.length === 0) && <div className="text-muted">אין משימות.</div>}
              {checklists.closing?.map((task, idx) => {
                const tName = typeof task === 'string' ? task : task.name;
                const tDesc = typeof task === 'string' ? '' : task.description;
                return (
                  <div 
                    key={idx} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx, 'closing')}
                    onDragEnter={(e) => handleDragEnter(e, idx, 'closing')}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className="flex-between" 
                    style={{ padding: '12px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)', alignItems: 'flex-start', cursor: 'grab', opacity: draggedItem && draggedItem.index === idx && draggedItem.type === 'closing' ? 0.4 : 1 }}
                  >
                    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                      <DotsSixVertical size={24} color="var(--text-muted)" style={{ cursor: 'grab', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="font-bold">{tName}</div>
                        {tDesc && <div className="text-sm text-muted mt-1" style={{ whiteSpace: 'pre-wrap' }}>{tDesc}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleEditTaskInit('closing', idx)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: 4 }}><PencilSimple size={18} /></button>
                      <button onClick={() => handleRemoveChecklistTask('closing', idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: 4 }}><Trash size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'inventory' ? (
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 className="text-xl font-bold mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={24} color="var(--primary-color)" /> יחידות מלאי כללי
            </h3>
            <p className="text-muted mb-4">כאן ננהל מלאי פיזי (בקבוקי אלכוהול שלמים, חביות, ארגזים) ולא פריטי תפריט בודדים (קוקטיילים/כוסות). זה מה שהברמנים יספרו.</p>
            
            <form onSubmit={handleAddInventory} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24, padding: 16, background: 'var(--bg-subtle)', borderRadius: 12 }}>
              <div className="form-group" style={{ flex: 2, margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.9rem' }}>שם פריט המלאי (למשל: בקבוקי וודקה סמירנוף)</label>
                <input type="text" className="form-input" value={newInvName} onChange={e => setNewInvName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.9rem' }}>יעד מלאי בתחילת ערב</label>
                <input type="number" className="form-input" value={newInvReq} onChange={e => setNewInvReq(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto', marginBottom: 2 }}>
                <Plus size={20} /> הוסף פריט
              </button>
            </form>

            <div style={{ display: 'grid', gap: 12 }}>
              {inventoryItems.length === 0 ? (
                <div className="text-center text-muted py-8">אין פריטי מלאי במערכת.</div>
              ) : (
                inventoryItems.map((item) => {
                  const req = item.requiredQuantity || 0;
                  const act = item.actualQuantity || 0;
                  const diff = act - req;
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-body)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div>
                        <div className="font-bold text-lg">{item.name}</div>
                        <div className="text-sm mt-1" style={{ display: 'flex', gap: 16 }}>
                          <span><span style={{color:'var(--text-muted)'}}>הוגדר מראש:</span> {req}</span>
                          <span>
                            <span style={{color:'var(--text-muted)'}}>קיים בפועל:</span>{' '}
                            <span style={{ color: diff < 0 ? 'var(--danger-color)' : 'var(--success-color)', fontWeight: 'bold' }}>{act}</span>
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteInventory(item.id)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, padding: 0, minWidth: 44, borderRadius: '50%', color: 'var(--danger-color)', flexShrink: 0 }}>
                        <Trash size={22} weight="bold" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Event Details Modal */}
      {viewingEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 800, margin: 'auto', height: '90vh', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
              <h3 className="font-bold text-xl">דוח אירוע: {viewingEvent.name}</h3>
              <button onClick={() => setViewingEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
              {/* Checklists status */}
              <div className="card mb-6" style={{ padding: 20 }}>
                <h4 className="font-bold text-lg mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListChecks size={20} /> מצב צ'קליסטים</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <h5 className="font-bold mb-3 text-muted">פתיחה</h5>
                    {(!checklists.opening || checklists.opening.length === 0) ? <div className="text-sm">אין משימות פתיחה</div> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {checklists.opening.map((task, idx) => {
                          const tName = typeof task === 'string' ? task : task.name;
                          const isDone = viewingEvent.completedTasks?.includes(tName);
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 20, height: 20, borderRadius: 4, background: isDone ? 'var(--success-color)' : 'transparent', border: `1px solid ${isDone ? 'var(--success-color)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                {isDone && <Check size={14} weight="bold" />}
                              </div>
                              <span style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text-muted)' : 'inherit' }}>{tName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold mb-3 text-muted">סגירה</h5>
                    {(!checklists.closing || checklists.closing.length === 0) ? <div className="text-sm">אין משימות סגירה</div> : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {checklists.closing.map((task, idx) => {
                          const tName = typeof task === 'string' ? task : task.name;
                          const isDone = viewingEvent.completedTasks?.includes(tName);
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 20, height: 20, borderRadius: 4, background: isDone ? 'var(--success-color)' : 'transparent', border: `1px solid ${isDone ? 'var(--success-color)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                {isDone && <Check size={14} weight="bold" />}
                              </div>
                              <span style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text-muted)' : 'inherit' }}>{tName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Shortages */}
              <div className="card mb-6" style={{ padding: 20 }}>
                <h4 className="font-bold text-lg mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Package size={20} /> חוסרים שדווחו במשמרת</h4>
                {(!viewingEvent.shortages || viewingEvent.shortages.length === 0) ? (
                  <div className="text-muted text-sm">לא דווחו חוסרים.</div>
                ) : (
                  <ul style={{ paddingRight: 20, margin: 0, display: 'grid', gap: 8 }}>
                    {viewingEvent.shortages.map((item, idx) => (
                      <li key={idx} style={{ fontWeight: 'bold', color: 'var(--danger-color)' }}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Event Orders */}
              <div className="card" style={{ padding: 20 }}>
                <h4 className="font-bold text-lg mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={20} /> הזמנות שבוצעו באירוע</h4>
                {orders.filter(o => o.eventId === viewingEvent.id).length === 0 ? (
                  <div className="text-muted text-center" style={{ padding: '20px 0' }}>לא בוצעו הזמנות באירוע זה</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {orders.filter(o => o.eventId === viewingEvent.id).map(order => (
                      <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div>
                          <div className="font-bold">{order.userName}</div>
                          <div className="text-sm mt-1">
                            {order.items?.map(i => `${i.name} x${i.quantity}`).join(', ')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left', minWidth: 60 }}>
                          <div className="font-bold text-lg">₪{order.totalPrice}</div>
                          <div className="text-xs text-muted mt-1">{order.status === 'completed' ? 'סגור' : 'פתוח'}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, background: 'var(--primary-color)20', borderRadius: 8, marginTop: 8 }}>
                      <span className="font-bold">סה"כ הכנסות מארוע (כולל חשבונות פתוחים):</span>
                      <span className="font-bold text-lg">
                        ₪{orders.filter(o => o.eventId === viewingEvent.id).reduce((acc, curr) => acc + curr.totalPrice, 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagePub;