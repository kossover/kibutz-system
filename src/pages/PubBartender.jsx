import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Users, Plus, Minus, X, CalendarBlank, MagnifyingGlass, Check, CaretLeft } from '@phosphor-icons/react';
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
  const [users, setUsers] = useState([]);
  
  // Modals state
  const [showAddUser, setShowAddUser] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);

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

    // Fetch users (for search)
    getDocs(collection(db, 'users')).then(snapshot => {
      const usrs = [];
      snapshot.forEach(d => usrs.push({ id: d.id, ...d.data() }));
      setUsers(usrs);
    });

    return () => { unsubEvent(); unsubMenu(); };
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
      if (currentItems[existingIdx].quantity <= 0) {
        currentItems.splice(existingIdx, 1);
      }
    } else if (delta > 0) {
      currentItems.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1
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
            <div className="chip chip-blue" style={{ fontWeight: 'bold' }}>{activeEvent.name}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex-between mb-4">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>חשבונות פתוחים ({orders.filter(o=>o.status==='pending').length})</h2>
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
              <h3 className="font-bold text-lg">בחר לקוח</h3>
              <button onClick={() => setShowAddUser(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div className="form-group relative">
              <div style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }}><MagnifyingGlass size={20} /></div>
              <input type="text" className="form-input" style={{ paddingRight: 40 }} placeholder="חיפוש לפי שם או טלפון..." value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredUsers.length === 0 && userSearch.length > 1 && <div className="text-center text-muted mt-4">לא נמצאו תוצאות</div>}
              {filteredUsers.map(u => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div className="font-bold">{u.name}</div>
                    <div className="text-sm text-muted" dir="ltr">{u.phone}</div>
                  </div>
                  <button onClick={() => addUserToEvent(u)} className="btn btn-primary" style={{ width: 'auto', padding: '6px 12px', minWidth: 'auto' }}>הוסף</button>
                </div>
              ))}
            </div>
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
                {selectedOrder.status === 'pending' && (
                  <button onClick={() => closeOrder(selectedOrder.id)} className="btn btn-success" style={{ width: 'auto', padding: '8px 16px', minWidth: 'auto' }}><Check size={16} /> סגור חשבון</button>
                )}
                <button onClick={() => setSelectedOrder(null)} style={{ background: 'var(--bg-color)', border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>
            </div>

            {/* Modal Body (Menu) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {selectedOrder.status === 'completed' && (
                <div className="card mb-4" style={{ background: 'var(--success-color)20', color: 'var(--success-color)', border: 'none', textAlign: 'center', padding: 12 }}>
                  חשבון זה סגור ולא ניתן לערוך אותו.
                </div>
              )}
              
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

              {selectedOrder.status === 'pending' && (
                <>
                  <h4 className="font-bold mb-3 mt-6" style={{ fontSize: '1.1rem' }}>הוסף פריטים</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {menu.map(item => {
                      const orderItem = selectedOrder.items?.find(i => i.itemId === item.id);
                      const qty = orderItem ? orderItem.quantity : 0;
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
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
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PubBartender;
