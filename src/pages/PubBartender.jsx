import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { Users, Plus, Minus, X, CalendarBlank, MagnifyingGlass, Check, CaretLeft, ListChecks, Package, Info, Trash } from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router-dom';

function PubBartender() {
  const { token } = useParams();
  const navigate = useNavigate();

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2);
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const [activeEvent, setActiveEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [menu, setMenu] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [users, setUsers] = useState([]);

  // Tasks expansion state
  const [expandedTasks, setExpandedTasks] = useState({});

  // Modals state
  const [showAddUser, setShowAddUser] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Create New User State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newShortage, setNewShortage] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [checklists, setChecklists] = useState({ opening: [], closing: [] });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [frequentDrinks, setFrequentDrinks] = useState([]);
  const selectedUserId = selectedOrder?.userId;

  useEffect(() => {
    if (!selectedUserId) {
      setFrequentDrinks([]);
      return;
    }

    const fetchFrequentDrinks = async () => {
      try {
        const q = query(
          collection(db, 'pubOrders'),
          where('userId', '==', selectedUserId),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);

        const drinkIds = new Set();
        snapshot.forEach(doc => {
          const order = doc.data();
          if (order.items) {
            order.items.forEach(item => {
              drinkIds.add(item.itemId);
            });
          }
        });

        setFrequentDrinks(Array.from(drinkIds));
      } catch (err) {
        console.error("Error fetching past orders", err);
      }
    };

    fetchFrequentDrinks();
  }, [selectedUserId]);

  useEffect(() => {
    if (!token) {
      setLoadingEvent(false);
      return;
    }

    // Fetch the specific event using the token (which is the document ID)
    const unsubEvent = onSnapshot(doc(db, 'pubEvents', token), (snapshot) => {
      if (snapshot.exists()) {
        setActiveEvent({ id: snapshot.id, ...snapshot.data() });
      } else {
        setActiveEvent(null);
      }
      setLoadingEvent(false);
    });

    // Fetch menu
    const unsubMenu = onSnapshot(query(collection(db, 'pubMenu'), where('available', '==', true)), (snapshot) => {
      const items = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
      setMenu(items);
    });

    // Fetch separate inventory
    const unsubInventory = onSnapshot(collection(db, 'pubInventory'), (snapshot) => {
      const items = [];
      snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
      setInventoryItems(items);
    });

    // Fetch users (for search)
    getDocs(collection(db, 'users')).then(snapshot => {
      const usrs = [];
      snapshot.forEach(d => usrs.push({ id: d.id, ...d.data() }));
      setUsers(usrs);
    });

    // Fetch checklists
    const unsubChecklists = onSnapshot(doc(db, 'pubSettings', 'checklists'), (docSnap) => {
      if (docSnap.exists()) {
        setChecklists(docSnap.data());
      } else {
        setChecklists({ opening: [], closing: [] });
      }
    });

    return () => { unsubEvent(); unsubMenu(); unsubInventory(); unsubChecklists(); };
  }, [token]);

  // When active event changes, fetch its orders (tabs)
  useEffect(() => {
    if (!activeEvent) return;
    const qOrders = query(collection(db, 'pubOrders'), where('eventId', '==', activeEvent.id));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const ordrs = [];
      snapshot.forEach(d => ordrs.push({ id: d.id, ...d.data() }));
      setOrders(ordrs);

      // Update selected order if it changed
      if (selectedOrder) {
        const updated = ordrs.find(o => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    });
    return () => unsubOrders();
  }, [activeEvent]);

  const addUserToEvent = async (user) => {
    // Check if user already has a tab in this event
    const exists = orders.find(o => o.userId === user.id);
    if (exists) {
      alert('למשתמש זה כבר יש חשבון פתוח באירוע זה');
      return;
    }

    try {
      await addDoc(collection(db, 'pubOrders'), {
        eventId: activeEvent.id,
        userId: user.id,
        userName: user.name,
        items: [],
        totalPrice: 0,
        status: 'pending', // pending means tab is open
        source: 'pub',
        createdAt: serverTimestamp()
      });
      setShowAddUser(false);
      setUserSearch('');
    } catch (err) {
      console.error(err);
      alert('שגיאה בהוספת משתמש');
    }
  };

  const updateItemQuantity = async (item, delta) => {
    if (!selectedOrder) return;

    let currentItems = [...(selectedOrder.items || [])];
    const existingIdx = currentItems.findIndex(i => i.itemId === item.id);

    if (existingIdx >= 0) {
      currentItems[existingIdx].quantity += delta;

      // Handle history timestamps
      if (!currentItems[existingIdx].history) {
        currentItems[existingIdx].history = Array(Math.max(0, currentItems[existingIdx].quantity - delta)).fill(new Date().toISOString());
      }
      if (delta > 0) {
        currentItems[existingIdx].history.push(new Date().toISOString());
      } else if (delta < 0) {
        currentItems[existingIdx].history.pop();
      }

      if (currentItems[existingIdx].quantity <= 0) {
        currentItems.splice(existingIdx, 1);
      }
    } else if (delta > 0) {
      currentItems.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        history: [new Date().toISOString()]
      });
    }

    const newTotal = currentItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

    // Optimistic UI update to prevent visual lag and rapid click issues
    setSelectedOrder({
      ...selectedOrder,
      items: currentItems,
      totalPrice: newTotal
    });

    try {
      await updateDoc(doc(db, 'pubOrders', selectedOrder.id), {
        items: currentItems,
        totalPrice: newTotal
      });
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון ההזמנה');
    }
  };

  const removeItemByHistory = async (item, historyIndex) => {
    if (!selectedOrder) return;
    let currentItems = [...(selectedOrder.items || [])];
    const existingIdx = currentItems.findIndex(i => i.itemId === item.id);
    if (existingIdx >= 0) {
      currentItems[existingIdx].quantity -= 1;
      if (currentItems[existingIdx].history) {
        currentItems[existingIdx].history.splice(historyIndex, 1);
      }
      if (currentItems[existingIdx].quantity <= 0) {
        currentItems.splice(existingIdx, 1);
      }

      const newTotal = currentItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

      setSelectedOrder({
        ...selectedOrder,
        items: currentItems,
        totalPrice: newTotal
      });

      try {
        await updateDoc(doc(db, 'pubOrders', selectedOrder.id), {
          items: currentItems,
          totalPrice: newTotal
        });
      } catch (err) {
        console.error(err);
        alert('שגיאה במחיקת פריט');
      }
    }
  };

  const closeOrder = async (orderId) => {
    if (window.confirm('האם אתה בטוח שברצונך לסגור חשבון זה? לא ניתן יהיה להוסיף אליו פריטים.')) {
      try {
        await updateDoc(doc(db, 'pubOrders', orderId), { status: 'completed' });
        setSelectedOrder(null);
      } catch (err) {
        console.error(err);
        alert('שגיאה בסגירת החשבון');
      }
    }
  };

  const handleCreateNewUser = async () => {
    if (!newFirstName || !newLastName || !newPhone) {
      alert("נא למלא את כל השדות: שם פרטי, משפחה וטלפון");
      return;
    }
    const displayName = `${newFirstName} ${newLastName}`.trim();
    const userData = {
      firstName: newFirstName,
      lastName: newLastName,
      name: displayName,
      displayName: displayName,
      phone: newPhone.replace(/-/g, ''), // Strip any hyphens
      email: '',
      role: 'user',
      groups: [],
      source: 'pub_bartender',
      status: 'approved'
    };

    try {
      const docRef = await addDoc(collection(db, 'users'), userData);
      const newUserObj = { id: docRef.id, ...userData };

      // Clear form
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setIsCreatingUser(false);

      // Auto open tab
      addUserToEvent(newUserObj);
    } catch (error) {
      console.error(error);
      alert("שגיאה ביצירת לקוח חדש");
    }
  };

  const handleDeleteTab = async () => {
    if (!selectedOrder) return;

    if (selectedOrder.totalPrice > 0 || (selectedOrder.items && selectedOrder.items.length > 0)) {
      alert('לא ניתן למחוק חשבון שיש בו חיובים. כדי למחוק את החשבון, נא להסיר קודם את כל המשקאות והפריטים שהוזמנו.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'pubOrders', selectedOrder.id));
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקת החשבון');
    }
  };

  const toggleChecklistTask = async (taskName) => {
    if (!activeEvent) return;
    const currentCompleted = activeEvent.completedTasks || [];
    const isCompleted = currentCompleted.includes(taskName);

    let newCompleted;
    if (isCompleted) {
      newCompleted = currentCompleted.filter(t => t !== taskName);
    } else {
      newCompleted = [...currentCompleted, taskName];
    }

    // Optimistic update
    setActiveEvent({ ...activeEvent, completedTasks: newCompleted });

    try {
      await updateDoc(doc(db, 'pubEvents', activeEvent.id), {
        completedTasks: newCompleted
      });
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון משימה');
    }
  };

  const handleAddShortage = async (e) => {
    e.preventDefault();
    if (!newShortage.trim() || !activeEvent) return;
    try {
      const currentShortages = activeEvent.shortages || [];
      await updateDoc(doc(db, 'pubEvents', activeEvent.id), {
        shortages: [...currentShortages, newShortage.trim()]
      });
      setNewShortage('');
    } catch (err) {
      console.error(err);
      alert('שגיאה בהוספת חוסר');
    }
  };

  const handleRemoveShortage = async (idx) => {
    if (!activeEvent) return;
    try {
      const currentShortages = [...(activeEvent.shortages || [])];
      currentShortages.splice(idx, 1);
      await updateDoc(doc(db, 'pubEvents', activeEvent.id), {
        shortages: currentShortages
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateActualInventory = async (itemId, actualValue) => {
    try {
      await updateDoc(doc(db, 'pubInventory', itemId), {
        actualQuantity: actualValue !== '' ? parseInt(actualValue) : ''
      });
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון המלאי');
    }
  };

  const toggleTaskExplanation = (taskIdx, e) => {
    e.stopPropagation();
    setExpandedTasks(prev => ({ ...prev, [taskIdx]: !prev[taskIdx] }));
  };

  const filteredUsers = userSearch.length > 1
    ? users.filter(u => u.name?.includes(userSearch) || u.phone?.includes(userSearch))
    : [];

  if (loadingEvent) {
    return <div className="loading">טוען נתוני אירוע...</div>;
  }

  if (!activeEvent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card text-center" style={{ padding: 40, maxWidth: 400 }}>
          <CalendarBlank size={48} color="var(--danger-color)" style={{ margin: '0 auto 16px' }} />
          <h2 className="text-xl font-bold mb-2">קישור לא תקין</h2>
          <p className="text-muted">האירוע שאתה מנסה לגשת אליו לא נמצא או שהקישור אינו חוקי.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>מערכת ברמנים</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowChecklistModal(true)} className="btn btn-secondary" style={{ padding: '6px 12px', width: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListChecks size={18} /> משימות פאב
            </button>
            <div className="chip chip-blue" style={{ fontWeight: 'bold' }}>{activeEvent.name}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex-between mb-4">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>חשבונות פתוחים ({orders.filter(o => o.status === 'pending').length})</h2>
          <button onClick={() => setShowAddUser(true)} className="btn btn-accent" style={{ width: 'auto', padding: '8px 16px', borderRadius: 20 }}>
            <Plus size={16} /> הוסף לקוח
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {orders.map(order => (
            <div
              key={order.id}
              className="card"
              style={{
                padding: 16,
                cursor: 'pointer',
                border: order.status === 'completed' ? '2px solid var(--success-color)' : '2px solid transparent',
                opacity: order.status === 'completed' ? 0.7 : 1,
                textAlign: 'center'
              }}
              onClick={() => setSelectedOrder(order)}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '1.2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                {order.userName ? getInitials(order.userName) : <Users />}
              </div>
              <div className="font-bold line-clamp-1">{order.userName}</div>
              <div className="text-sm font-bold mt-2" style={{ color: 'var(--primary-color)' }}>₪{order.totalPrice}</div>
              {order.status === 'completed' && <div className="text-xs text-muted mt-1">סגור</div>}
            </div>
          ))}
          {orders.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              אין לקוחות באירוע. הוסף לקוח כדי להתחיל.
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', height: '80vh', marginTop: 'auto', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="font-bold text-lg">{isCreatingUser ? 'יצירת לקוח חדש' : 'בחר לקוח'}</h3>
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setIsCreatingUser(false);
                  setNewFirstName('');
                  setNewLastName('');
                  setNewPhone('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {!isCreatingUser ? (
              <>
                <div className="form-group relative">
                  <div style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }}><MagnifyingGlass size={20} /></div>
                  <input type="text" className="form-input" style={{ paddingRight: 40 }} placeholder="חיפוש לפי שם או טלפון..." value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredUsers.length === 0 && userSearch.length > 1 && (
                    <div className="text-center text-muted mt-4">
                      <p>לא נמצאו תוצאות חיפוש.</p>
                      <button className="btn btn-primary mt-4" style={{ width: 'auto', display: 'inline-block' }} onClick={() => setIsCreatingUser(true)}>
                        <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} /> צור לקוח חדש
                      </button>
                    </div>
                  )}
                  {userSearch.length <= 1 && (
                    <div className="text-center text-muted mt-4">
                      <button className="btn btn-secondary mt-2" style={{ width: 'auto', display: 'inline-block', fontSize: '0.9rem', padding: '6px 12px' }} onClick={() => setIsCreatingUser(true)}>
                        <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} /> לקוח לא במערכת? צור חדש
                      </button>
                    </div>
                  )}
                  {filteredUsers.map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div className="font-bold">{u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'ללא שם'}</div>
                        <div className="text-sm text-muted" dir="ltr">{u.phone}</div>
                      </div>
                      <button onClick={() => addUserToEvent(u)} className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', minWidth: 'auto' }}>הוסף</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 'bold' }}>שם פרטי</label>
                  <input type="text" className="form-input" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="לדוגמה: משה" />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 'bold' }}>שם משפחה</label>
                  <input type="text" className="form-input" value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="לדוגמה: כהן" />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 'bold' }}>מספר טלפון</label>
                  <input type="tel" className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="0501234567" dir="ltr" style={{ textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button onClick={handleCreateNewUser} className="btn btn-primary" style={{ flex: 1 }}>שמור חשבון</button>
                  <button onClick={() => setIsCreatingUser(false)} className="btn btn-secondary" style={{ flex: 1 }}>חזור לחיפוש</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Modal (Tab details) */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', height: '90vh', marginTop: 'auto', borderTopLeftRadius: 24, borderTopRightRadius: 24, display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 className="font-bold text-lg">{selectedOrder.userName}</h3>
                <div className="text-sm text-muted">סה"כ לתשלום: <span className="font-bold text-color">₪{selectedOrder.totalPrice}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {selectedOrder.status !== 'completed' && (
                  <button onClick={handleDeleteTab} style={{ background: 'var(--danger-color)', color: 'white', border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="מחק חשבון">
                    <Trash size={20} />
                  </button>
                )}
                <button onClick={() => setSelectedOrder(null)} style={{ background: 'var(--bg-color)', border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>
            </div>

            {/* Modal Body (Menu) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {selectedOrder.status === 'completed' ? (
                <>
                  <div className="card mb-4" style={{ background: 'var(--success-color)20', color: 'var(--success-color)', border: 'none', textAlign: 'center', padding: 12 }}>
                    חשבון זה סגור ולא ניתן לערוך אותו.
                  </div>
                  <h4 className="font-bold mb-3" style={{ fontSize: '1.1rem' }}>פירוט הזמנה</h4>
                  {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                    <div className="text-muted text-sm mb-6">טרם הוזמנו פריטים</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-body)', borderRadius: 8 }}>
                          <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                          <span className="font-bold">₪{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {[...menu].sort((a, b) => {
                      const isADrink = a.category !== 'אוכל' && a.category !== 'חטיפים';
                      const isBDrink = b.category !== 'אוכל' && b.category !== 'חטיפים';

                      const aIdx = frequentDrinks.indexOf(a.id);
                      const bIdx = frequentDrinks.indexOf(b.id);

                      const aIsFrequent = isADrink && aIdx !== -1;
                      const bIsFrequent = isBDrink && bIdx !== -1;

                      if (aIsFrequent && bIsFrequent) return aIdx - bIdx;
                      if (aIsFrequent) return -1;
                      if (bIsFrequent) return 1;

                      return a.name.localeCompare(b.name);
                    }).map(item => {
                      const orderItem = selectedOrder.items?.find(i => i.itemId === item.id);
                      const qty = orderItem ? orderItem.quantity : 0;
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div className="font-bold">{item.name}</div>
                              <div className="text-sm text-muted">₪{item.price}</div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-body)', borderRadius: 20, padding: 4 }}>
                              <button onClick={() => updateItemQuantity(item, -1)} style={{ background: qty > 0 ? 'var(--bg-card)' : 'transparent', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: qty > 0 ? 'var(--danger-color)' : 'var(--text-muted)' }} disabled={qty === 0}>
                                <Minus size={18} />
                              </button>
                              <span style={{ fontWeight: 'bold', minWidth: 20, textAlign: 'center', fontSize: '1.1rem' }}>{qty}</span>
                              <button onClick={() => updateItemQuantity(item, 1)} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={18} />
                              </button>
                            </div>
                          </div>

                          {qty > 0 && orderItem?.history && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {orderItem.history.map((timestamp, hIdx) => {
                                const dateObj = new Date(timestamp);
                                const timeStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div key={hIdx} onClick={() => removeItemByHistory(item, hIdx)} className="chip chip-blue" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--danger-color)10', color: 'var(--danger-color)', border: '1px solid var(--danger-color)50' }} title="לחץ כדי למחוק פריט זה">
                                    {timeStr || 'לא ידוע'} <X size={12} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {showChecklistModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-card)', height: '90vh', marginTop: 'auto', borderTopLeftRadius: 24, borderTopRightRadius: 24, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="font-bold text-lg" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListChecks size={24} color="var(--primary-color)" /> משימות - {activeEvent.name}</h3>
              <button onClick={() => setShowChecklistModal(false)} style={{ background: 'var(--bg-color)', border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <h4 className="font-bold mb-4 text-lg">צ'קליסט פתיחה</h4>
              <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
                {checklists.opening?.length === 0 && <div className="text-muted">אין משימות פתיחה</div>}
                {checklists.opening?.map((task, idx) => {
                  const tName = typeof task === 'string' ? task : task.name;
                  const tDesc = typeof task === 'string' ? '' : task.description;
                  const isDone = activeEvent.completedTasks?.includes(tName);
                  const isExpanded = expandedTasks[`opening_${idx}`];

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div onClick={() => toggleChecklistTask(tName)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, border: `2px solid ${isDone ? 'var(--success-color)' : 'var(--text-muted)'}`, background: isDone ? 'var(--success-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                          {isDone && <Check size={16} weight="bold" />}
                        </div>
                        <span style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text-muted)' : 'inherit', flex: 1, fontWeight: 'bold' }}>{tName}</span>
                        {tDesc && (
                          <button onClick={(e) => toggleTaskExplanation(`opening_${idx}`, e)} style={{ background: isExpanded ? 'var(--primary-color)20' : 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={22} weight={isExpanded ? "fill" : "regular"} />
                          </button>
                        )}
                      </div>
                      {isExpanded && tDesc && (
                        <div style={{ padding: '12px 16px', background: 'var(--primary-color)10', borderRadius: 8, borderRight: '4px solid var(--primary-color)', color: 'var(--text-color)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 4 }}>
                          {tDesc}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h4 className="font-bold mb-4 text-lg">צ'קליסט סגירה</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {checklists.closing?.length === 0 && <div className="text-muted">אין משימות סגירה</div>}
                {checklists.closing?.map((task, idx) => {
                  const tName = typeof task === 'string' ? task : task.name;
                  const tDesc = typeof task === 'string' ? '' : task.description;
                  const isDone = activeEvent.completedTasks?.includes(tName);
                  const isExpanded = expandedTasks[`closing_${idx}`];

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div onClick={() => toggleChecklistTask(tName)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <div style={{ width: 24, height: 24, borderRadius: 4, border: `2px solid ${isDone ? 'var(--success-color)' : 'var(--text-muted)'}`, background: isDone ? 'var(--success-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                          {isDone && <Check size={16} weight="bold" />}
                        </div>
                        <span style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text-muted)' : 'inherit', flex: 1, fontWeight: 'bold' }}>{tName}</span>
                        {tDesc && (
                          <button onClick={(e) => toggleTaskExplanation(`closing_${idx}`, e)} style={{ background: isExpanded ? 'var(--primary-color)20' : 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={22} weight={isExpanded ? "fill" : "regular"} />
                          </button>
                        )}
                      </div>
                      {isExpanded && tDesc && (
                        <div style={{ padding: '12px 16px', background: 'var(--primary-color)10', borderRadius: 8, borderRight: '4px solid var(--primary-color)', color: 'var(--text-color)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 4 }}>
                          {tDesc}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <h4 className="font-bold mb-4 text-lg" style={{ marginTop: 32, paddingTop: 32, borderTop: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ListChecks size={22} color="var(--primary-color)" /> דיווח חוסרים
              </h4>
              <p className="text-sm text-muted mb-4">דווח כאן על חוסרים בפאב כדי שההנהלה תוכל להזמין לקראת הערב הבא.</p>
              
              <form onSubmit={handleAddShortage} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ margin: 0, flex: 1 }} 
                  placeholder="לדוגמה: נגמר סמירנוף, חסר לימונים..." 
                  value={newShortage} 
                  onChange={e => setNewShortage(e.target.value)} 
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }} disabled={!newShortage.trim()}>
                  <Plus size={16} /> הוסף
                </button>
              </form>

              <div style={{ display: 'grid', gap: 8 }}>
                {(!activeEvent.shortages || activeEvent.shortages.length === 0) && (
                  <div className="text-muted text-sm text-center py-4 bg-gray-50" style={{ borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                    לא דווחו חוסרים במשמרת זו.
                  </div>
                )}
                {activeEvent.shortages?.map((shortage, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-body)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <span>{shortage}</span>
                    <button onClick={() => handleRemoveShortage(idx)} className="btn btn-secondary" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-color)', borderRadius: '50%' }}>
                      <Trash size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <h4 className="font-bold mb-4 text-lg" style={{ marginTop: 32, paddingTop: 32, borderTop: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={22} color="var(--primary-color)" /> ספירת מלאי (סוף ערב)
              </h4>
              <div style={{ marginBottom: 16, background: '#EFF6FF', color: '#1E40AF', padding: 12, borderRadius: 8, fontSize: '0.9rem' }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>💡 רשות: ספירת מלאי (לבקבוקים/פחיות סגורים בלבד)</strong>
                הזנת הכמויות כאן היא **לא חובה**, אבל היא תעזור להבין מה חסר ומה צריך להזמין מבלי שנצטרך ללכת לספור ידנית מחר.
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {inventoryItems.length === 0 ? (
                  <div className="text-muted text-center py-6">לא הוגדרו פריטי מלאי.</div>
                ) : (
                  [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name)).map(item => {
                    const req = item.requiredQuantity || 0;
                    const act = (item.actualQuantity === undefined || item.actualQuantity === '') ? '' : parseInt(item.actualQuantity);
                    const diff = act !== '' ? act - req : 0;

                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-body)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1, paddingLeft: 12 }}>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-sm text-muted">יעד נדרש: {req}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 120, flexShrink: 0 }}>

                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: 20, padding: 2, width: '100%', border: '1px solid var(--border-color)' }}>
                            <button onClick={() => updateActualInventory(item.id, act !== '' ? Math.max(0, act - 1) : 0)} style={{ border: 'none', background: act !== '' && act > 0 ? 'var(--bg-color)' : 'transparent', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: act !== '' && act > 0 ? 'var(--danger-color)' : 'var(--text-muted)' }}>
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              className="form-input"
                              style={{ flex: 1, padding: 0, textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', minHeight: 36, border: 'none', background: 'transparent' }}
                              placeholder="ריק"
                              value={act}
                              onChange={(e) => updateActualInventory(item.id, e.target.value)}
                            />
                            <button onClick={() => updateActualInventory(item.id, act !== '' ? act + 1 : 1)} style={{ border: 'none', background: 'var(--primary-color)', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={16} />
                            </button>
                          </div>

                          {act !== '' && (
                            <div style={{
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              marginTop: 4,
                              color: diff < 0 ? 'var(--danger-color)' : 'var(--success-color)'
                            }}>
                              {diff < 0 ? `חסר: ${Math.abs(diff)}` : (diff === 0 ? 'מדויק' : `חורג: +${diff}`)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PubBartender;
