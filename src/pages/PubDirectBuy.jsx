import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc } from 'firebase/firestore';
import { ClockCounterClockwise, Plus, Minus, ArrowRight, CheckCircle, UserSwitch, List } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

function PubDirectBuy() {
  const [phone, setPhone] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'history' | 'success'

  const navigate = useNavigate();

  useEffect(() => {
    // Check for saved login
    const savedUserId = localStorage.getItem('pubUserId');
    if (savedUserId) {
      setLoading(true);
      getDoc(doc(db, 'users', savedUserId)).then(docSnap => {
        if (docSnap.exists()) {
          const userData = { id: docSnap.id, ...docSnap.data() };
          setUser(userData);
          fetchHistory(userData.id);
        } else {
          localStorage.removeItem('pubUserId');
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }

    // Fetch available menu items
    const q = query(collection(db, 'pubMenu'), where('available', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setMenu(items);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Format phone number to match how it is stored in users collection
    const cleanPhone = phone.trim().replace(/\D/g, '');

    try {
      const q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
        setUser(userData);
        localStorage.setItem('pubUserId', userData.id);
        fetchHistory(userData.id);
      } else {
        setError('מספר טלפון לא נמצא במערכת');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בחיבור למערכת');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('pubUserId');
    setUser(null);
    setPhone('');
    setHistory([]);
    setCart({});
    setActiveTab('menu');
  };

  const fetchHistory = (userId) => {
    const q = query(collection(db, 'pubOrders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    onSnapshot(q, (snapshot) => {
      const orders = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
      setHistory(orders);
    });
  };

  const updateCart = (itemId, delta) => {
    setCart(prev => {
      const newQuantity = (prev[itemId] || 0) + delta;
      if (newQuantity <= 0) {
        const newCart = { ...prev };
        delete newCart[itemId];
        return newCart;
      }
      return { ...prev, [itemId]: newQuantity };
    });
  };

  const cartTotal = Object.entries(cart).reduce((total, [itemId, quantity]) => {
    const item = menu.find(i => i.id === itemId);
    return total + (item ? item.price * quantity : 0);
  }, 0);

  const placeOrder = async () => {
    if (Object.keys(cart).length === 0) return;
    setLoading(true);
    
    const items = Object.entries(cart).map(([itemId, quantity]) => {
      const item = menu.find(i => i.id === itemId);
      return {
        itemId,
        name: item.name,
        price: item.price,
        quantity
      };
    });

    try {
      await addDoc(collection(db, 'pubOrders'), {
        userId: user.id,
        userName: user.name,
        items,
        totalPrice: cartTotal,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setCart({});
      setActiveTab('success');
    } catch (err) {
      console.error(err);
      alert('שגיאה בשליחת ההזמנה');
    }
    setLoading(false);
  };

  if (loading && !user && !error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div className="loading">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: 20 }}>
        <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🍺</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 8 }}>הפאב שלנו</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>הזן מספר טלפון כדי להמשיך</p>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <input 
                type="tel" 
                className="form-input" 
                placeholder="מספר טלפון נייד" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                style={{ textAlign: 'center', fontSize: '1.2rem', padding: 16 }}
                required
              />
            </div>
            {error && <div style={{ color: 'var(--danger-color)', marginBottom: 16 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 16, fontSize: '1.1rem' }} disabled={loading}>
              {loading ? 'מתחבר...' : 'כניסה'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', padding: '20px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: 8, minWidth: 'auto', borderRadius: '50%' }}>
              <ArrowRight size={20} />
            </button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>היי, {user.name} 👋</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px', minWidth: 'auto', borderRadius: '50%' }}
              title="היסטוריית הזמנות"
            >
              <ClockCounterClockwise size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('menu')} 
              className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px', minWidth: 'auto', borderRadius: '50%' }}
              title="תפריט"
            >
              <List size={20} />
            </button>
            <button 
              onClick={handleLogout} 
              className="btn btn-secondary"
              style={{ padding: '8px', minWidth: 'auto', borderRadius: '50%' }}
              title="החלף משתמש"
            >
              <UserSwitch size={20} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {activeTab === 'success' && (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--success-color)15', border: '1px solid var(--success-color)' }}>
            <CheckCircle size={80} color="var(--success-color)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: 8 }}>ההזמנה התקבלה בהצלחה!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              ההזמנה שלך נשלחה לברמן ויוצאת אליך בקרוב 🍻
            </p>
            <button 
              onClick={() => setActiveTab('menu')} 
              className="btn btn-primary" 
              style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: 30, margin: '0 auto', display: 'flex', gap: 8 }}
            >
              <Plus size={20} /> הזמן משהו נוסף
            </button>
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <div style={{ display: 'grid', gap: 16, marginBottom: 100 }}>
              {menu.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', gap: 16, padding: 16 }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 12, background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🍻</div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div className="font-bold text-lg">{item.name}</div>
                      {item.description && <div className="text-sm text-muted line-clamp-2">{item.description}</div>}
                    </div>
                    <div className="flex-between" style={{ marginTop: 8 }}>
                      <div className="font-bold" style={{ color: 'var(--primary-color)' }}>₪{item.price}</div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-color)', borderRadius: 20, padding: 4 }}>
                        <button onClick={() => updateCart(item.id, -1)} style={{ background: cart[item.id] ? 'var(--card-bg)' : 'transparent', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: cart[item.id] ? 'var(--text-color)' : 'var(--text-muted)' }} disabled={!cart[item.id]}>
                          <Minus size={16} />
                        </button>
                        <span style={{ fontWeight: 'bold', minWidth: 20, textAlign: 'center' }}>{cart[item.id] || 0}</span>
                        <button onClick={() => updateCart(item.id, 1)} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary Bar */}
            {Object.keys(cart).length > 0 && (
              <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 20, background: 'var(--card-bg)', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 20 }}>
                <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סה"כ לתשלום</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₪{cartTotal}</div>
                  </div>
                  <button onClick={placeOrder} disabled={loading} className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: 30 }}>
                    {loading ? 'שולח...' : 'שלח הזמנה'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: 16 }}>היסטוריית רכישות</h2>
            {history.length === 0 ? (
              <div className="empty-state">
                <ClockCounterClockwise size={48} />
                <div style={{ marginTop: 16 }}>טרם ביצעת הזמנות</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {history.map(order => (
                  <div key={order.id} className="card" style={{ padding: 16 }}>
                    <div className="flex-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <div className="text-sm font-bold">
                        {order.createdAt?.toDate().toLocaleDateString('he-IL')}
                      </div>
                      <span className={`chip ${order.status === 'completed' ? 'chip-green' : order.status === 'pending' ? 'chip-amber' : 'chip-gray'}`}>
                        {order.status === 'completed' ? 'הושלם' : order.status === 'pending' ? 'בטיפול' : 'בוטל'}
                      </span>
                    </div>
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex-between text-sm py-2">
                        <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                        <span>₪{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div className="flex-between mt-4 pt-4 font-bold" style={{ borderTop: '1px solid var(--border-color)', fontSize: '1.1rem' }}>
                      <span>סה"כ</span>
                      <span>₪{order.totalPrice}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PubDirectBuy;
