import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc } from 'firebase/firestore';
import { 
  ClockCounterClockwise, 
  Plus, 
  Minus, 
  ArrowRight, 
  CheckCircle, 
  UserSwitch, 
  List,
  BeerBottle,
  Martini,
  ShoppingCart,
  Phone
} from '@phosphor-icons/react';
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
  const [successMessage, setSuccessMessage] = useState('');

  const funnyMessages = [
    `"בירה היא ההוכחה שאלוהים אוהב אותנו ורוצה שנהיה מאושרים" - בנימין פרנקלין. קח/י את המשקה ותהנה/י!`,
    `אלכוהול אולי לא פותר את הבעיות שלך, אבל בינינו... גם חלב לא. לרוויה!`,
    `"לבירה! הסיבה והפתרון לכל בעיות החיים" - הומר סימפסון. לחיים!`,
    `"לקחתי יותר מהאלכוהול ממה שהאלכוהול לקח ממני" - ווינסטון צ'רצ'יל. עכשיו תורך!`,
    `"אני מרחם על אנשים שלא שותים, כשהם קמים בבוקר זה הכי טוב שהם הולכים להרגיש כל היום" - פרנק סינטרה. לחיים!`,
    `"כשמשהו רע קורה אתה שותה כדי לשכוח; כשמשהו טוב קורה אתה שותה כדי לחגוג" - צ'ארלס בוקובסקי. מה חוגגים היום?`,
    `ההזמנה נרשמה! הזמן טס כשנהנים, אבל הוא טס הרבה יותר מהר כששותים. קח/י את המשקה!`
  ];

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
        isPaid: false,
        createdAt: serverTimestamp()
      });
      setCart({});
      setSuccessMessage(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);
      setActiveTab('success');
    } catch (err) {
      console.error(err);
      alert('שגיאה בשליחת ההזמנה');
    }
    setLoading(false);
  };

  if (loading && !user && !error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div className="loading" style={{ color: 'white' }}>טוען...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pub-login-container">
        <style>{`
          .pub-login-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            position: relative;
            overflow: hidden;
            font-family: 'Inter', system-ui, sans-serif;
          }

          .pub-login-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at center, rgba(245,158,11,0.08) 0%, transparent 60%);
            animation: pulse-glow 15s ease-in-out infinite alternate;
            z-index: 0;
          }

          @keyframes pulse-glow {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(1.1); opacity: 1; }
          }

          .pub-login-card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 32px;
            padding: 48px 32px;
            text-align: center;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            position: relative;
            z-index: 1;
            transform: translateY(0);
            animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }

          @keyframes slide-up {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          .pub-icon-wrapper {
            width: 88px;
            height: 88px;
            background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 32px;
            border: 1px solid rgba(245,158,11,0.3);
            box-shadow: 0 0 30px rgba(245,158,11,0.2);
            color: #f59e0b;
          }

          .pub-title {
            font-size: 2.25rem;
            font-weight: 800;
            color: white;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #ffffff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .pub-subtitle {
            color: #94a3b8;
            font-size: 1.1rem;
            margin-bottom: 40px;
            line-height: 1.5;
          }

          .pub-input-wrapper {
            position: relative;
            margin-bottom: 24px;
          }

          .pub-input-icon {
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
          }

          .pub-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: white !important;
            font-size: 1.25rem !important;
            padding: 18px 24px 18px 56px !important;
            border-radius: 20px !important;
            text-align: left !important;
            letter-spacing: 2px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }

          .pub-input:focus {
            border-color: #f59e0b !important;
            box-shadow: 0 0 0 4px rgba(245,158,11,0.15) !important;
            outline: none;
            background: rgba(0, 0, 0, 0.4) !important;
          }

          .pub-input::placeholder {
            color: #475569;
            letter-spacing: normal;
            text-align: right;
          }

          .pub-btn-primary {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            font-size: 1.15rem !important;
            padding: 18px !important;
            border-radius: 20px !important;
            border: none !important;
            width: 100%;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 4px 14px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.2) !important;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }

          .pub-btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.2) !important;
          }
          
          .pub-btn-primary:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
        `}</style>
        
        <div className="pub-login-card">
          <div className="pub-icon-wrapper">
            <BeerBottle size={40} weight="duotone" />
          </div>
          <h1 className="pub-title">הפאב הקהילתי</h1>
          <p className="pub-subtitle">הזן את מספר הנייד שלך כדי לגשת לתפריט הדיגיטלי ולהזמין</p>
          
          <form onSubmit={handleLogin}>
            <div className="pub-input-wrapper">
              <Phone size={24} className="pub-input-icon" weight="fill" />
              <input 
                type="tel" 
                className="pub-input" 
                placeholder="מספר טלפון נייד" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                required
              />
            </div>
            {error && (
              <div style={{ color: '#ef4444', marginBottom: 20, fontSize: '0.95rem', background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}
            <button type="submit" className="pub-btn-primary" disabled={loading}>
              {loading ? 'מתחבר...' : (
                <>
                  כניסה <ArrowRight size={20} weight="bold" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 120, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .pub-header {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          padding: 16px 24px;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }

        .pub-header-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          background: linear-gradient(90deg, #0f172a, #334155);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .pub-nav-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .pub-nav-btn.active {
          background: #0f172a;
          color: white;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
        }

        .pub-nav-btn.inactive {
          background: white;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .pub-nav-btn.inactive:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .pub-menu-item {
          background: white;
          border-radius: 24px;
          padding: 20px;
          display: flex;
          gap: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .pub-menu-item:active {
          transform: scale(0.98);
        }

        .pub-item-image {
          width: 96px;
          height: 96px;
          border-radius: 20px;
          object-fit: cover;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .pub-item-placeholder {
          width: 96px;
          height: 96px;
          border-radius: 20px;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }

        .pub-qty-controls {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #f8fafc;
          border-radius: 100px;
          padding: 6px;
          border: 1px solid #e2e8f0;
        }

        .pub-qty-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .pub-qty-btn.minus {
          background: white;
          color: #475569;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .pub-qty-btn.plus {
          background: #f59e0b;
          color: white;
          box-shadow: 0 2px 8px rgba(245,158,11,0.3);
        }

        .pub-qty-btn:active {
          transform: scale(0.9);
        }

        .pub-cart-bar {
          position: fixed;
          bottom: 24px;
          left: 24px;
          right: 24px;
          background: #0f172a;
          border-radius: 28px;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: white;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.4);
          z-index: 40;
          max-width: 600px;
          margin: 0 auto;
          animation: slide-up-bar 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slide-up-bar {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .pub-cart-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #ffffff;
          border: none;
          padding: 14px 28px;
          border-radius: 100px;
          font-weight: 700;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 14px rgba(245,158,11,0.3);
        }

        .pub-cart-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(245,158,11,0.4);
        }
        
        .pub-cart-btn:active {
          transform: translateY(0);
        }

        .pub-success-card {
          background: white;
          border-radius: 32px;
          padding: 64px 32px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.05);
          animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .success-icon-wrapper {
          width: 100px;
          height: 100px;
          background: #ecfdf5;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 32px;
          color: #10b981;
        }

        .history-card {
          background: white;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.04);
          margin-bottom: 16px;
        }
      `}</style>

      {/* Header */}
      <div className="pub-header">
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/')} className="pub-nav-btn inactive">
              <ArrowRight size={20} weight="bold" />
            </button>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>ברוכים השבים</div>
              <h1 className="pub-header-title">{user.name}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`pub-nav-btn ${activeTab === 'history' ? 'active' : 'inactive'}`}
              title="היסטוריית הזמנות"
            >
              <ClockCounterClockwise size={22} weight={activeTab === 'history' ? "fill" : "regular"} />
            </button>
            <button 
              onClick={() => setActiveTab('menu')} 
              className={`pub-nav-btn ${activeTab === 'menu' ? 'active' : 'inactive'}`}
              title="תפריט"
            >
              <List size={22} weight={activeTab === 'menu' ? "fill" : "regular"} />
            </button>
            <button 
              onClick={handleLogout} 
              className="pub-nav-btn inactive"
              title="החלף משתמש"
              style={{ background: '#f8fafc' }}
            >
              <UserSwitch size={22} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: 600, margin: '0 auto' }}>
        {activeTab === 'success' && (
          <div className="pub-success-card">
            <div className="success-icon-wrapper">
              <CheckCircle size={60} weight="fill" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>נרשם בהצלחה!</h2>
            <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: 40, lineHeight: 1.6 }}>
              {successMessage}
            </p>
            <button 
              onClick={() => setActiveTab('menu')} 
              className="pub-cart-btn" 
              style={{ margin: '0 auto', padding: '16px 32px' }}
            >
              <Plus size={20} weight="bold" /> הזמן משהו נוסף
            </button>
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            <div style={{ display: 'grid', gap: 20 }}>
              {menu.map(item => (
                <div key={item.id} className="pub-menu-item">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="pub-item-image" />
                  ) : (
                    <div className="pub-item-placeholder">
                      {item.category === 'משקאות חריפים' ? <Martini size={40} weight="duotone" /> : <BeerBottle size={40} weight="duotone" />}
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.4 }}>{item.description}</div>}
                    </div>
                    <div className="flex-between" style={{ marginTop: 12 }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>₪{item.price}</div>
                      
                      <div className="pub-qty-controls">
                        <button 
                          onClick={() => updateCart(item.id, -1)} 
                          className="pub-qty-btn minus"
                          style={{ opacity: cart[item.id] ? 1 : 0.5, cursor: cart[item.id] ? 'pointer' : 'default' }}
                          disabled={!cart[item.id]}
                        >
                          <Minus size={16} weight="bold" />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 24, textAlign: 'center', color: '#0f172a' }}>
                          {cart[item.id] || 0}
                        </span>
                        <button onClick={() => updateCart(item.id, 1)} className="pub-qty-btn plus">
                          <Plus size={16} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary Bar */}
            {Object.keys(cart).length > 0 && (
              <div className="pub-cart-bar">
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>סה"כ לתשלום</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>₪{cartTotal}</div>
                </div>
                <button onClick={placeOrder} disabled={loading} className="pub-cart-btn">
                  {loading ? 'שולח...' : (
                    <>
                      שלח הזמנה <ShoppingCart size={20} weight="fill" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>היסטוריית רכישות</h2>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 20px', background: 'white', borderRadius: 32, border: '1px solid #f1f5f9' }}>
                <ClockCounterClockwise size={64} weight="duotone" color="#cbd5e1" style={{ margin: '0 auto 20px' }} />
                <div style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>טרם ביצעת הזמנות</div>
              </div>
            ) : (
              <div>
                {history.map(order => (
                  <div key={order.id} className="history-card">
                    <div className="flex-between" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                          {order.createdAt?.toDate().toLocaleDateString('he-IL')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {order.createdAt?.toDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '100px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        background: order.status === 'completed' ? '#ecfdf5' : order.status === 'pending' ? '#fef3c7' : '#f1f5f9',
                        color: order.status === 'completed' ? '#059669' : order.status === 'pending' ? '#d97706' : '#64748b'
                      }}>
                        {order.status === 'completed' ? 'הושלם' : order.status === 'pending' ? 'בטיפול' : 'בוטל'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex-between" style={{ fontSize: '0.95rem' }}>
                          <span style={{ color: '#334155', fontWeight: 500 }}>
                            {item.name} <span style={{ color: '#94a3b8', margin: '0 4px' }}>x{item.quantity}</span>
                          </span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>₪{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex-between" style={{ borderTop: '1px dashed #e2e8f0', marginTop: 16, paddingTop: 16, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
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
