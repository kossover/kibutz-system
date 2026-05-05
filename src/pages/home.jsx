import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  CalendarBlank,
  BeerBottle,
  Wrench,
  Books,
  MapTrifold,
  Megaphone,
  CookingPot,
  ListChecks,
  Warning,
  UserCircle,
  BookOpen, // Import BookOpen for Recipe Book
  Archive,
  SignIn,
  ArrowLeft,
  PenNib,
  Gift,
  ShoppingCart
} from '@phosphor-icons/react';

function Home() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [homeSettings, setHomeSettings] = useState({});
  const [isDocumentAdmin, setIsDocumentAdmin] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'config', 'appSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.showInHome) {
            setHomeSettings(data.showInHome);
          }
        }
      } catch (err) {
        console.error('Error loading home settings:', err);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        // ניסיון לשלוף שם פרטי מהפרופיל המורחב, אם קיים
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserName(data.firstName || user.displayName || 'חבר');
          } else {
            setUserName(user.displayName || 'חבר');
          }
        } catch (e) {
          setUserName(user.displayName || 'חבר');
        }

        if (user.email) {
          try {
            const qDocs = query(collection(db, 'documents_for_signature'), where('documentAdmins', 'array-contains', user.email));
            const docsSnapshot = await getDocs(qDocs);
            if (!docsSnapshot.empty) {
              setIsDocumentAdmin(true);
            }
          } catch (e) {
            console.error('Error checking document admin:', e);
          }
        }
      } else {
        setIsDocumentAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // רכיב כרטיס מהיר לדאשבורד
  const DashboardCard = ({ title, subtitle, icon: Icon, color, onClick, badge }) => (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
      className="dashboard-card"
    >
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '4px',
        height: '100%',
        background: color
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div style={{
          background: `${color}15`, // 15% opacity
          padding: '12px',
          borderRadius: '12px',
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={28} weight="duotone" />
        </div>
        {badge && (
          <span style={{
            background: '#fee2e2',
            color: '#ef4444',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '2px 8px',
            borderRadius: '99px'
          }}>
            {badge}
          </span>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{subtitle}</p>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: '600', color: color }}>
        כניסה <ArrowLeft size={14} style={{ marginRight: '4px' }} />
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ paddingBottom: '120px' }}>
      <style>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .dashboard-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .welcome-header {
          margin-bottom: 32px;
        }
        
        .section-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-light);
          font-weight: 700;
          margin-bottom: 16px;
          margin-top: 32px;
        }

        @media (max-width: 480px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header Section */}
      <div className="welcome-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary-color)', marginBottom: '4px' }}>
              {loading ? '...' : (currentUser ? `היי, ${userName}` : 'ברוכים הבאים')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
              {currentUser ? 'מה תרצו לעשות היום?' : 'מערכת ניהול הקהילה'}
            </p>
          </div>

          <div
            onClick={() => navigate(currentUser ? '/profile' : '/login')}
            style={{
              background: 'white',
              padding: '4px',
              borderRadius: '50%',
              border: '2px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            {currentUser && currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <UserCircle size={48} weight="light" color="var(--text-light)" />
            )}
          </div>
        </div>
      </div>

      {!currentUser && (
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <SignIn size={24} color="var(--primary-color)" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>אורח במערכת?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>התחבר כדי לגשת לכל השירותים, להזמין תורים ולהירשם לאירועים.</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }}
            onClick={() => navigate('/login')}
          >
            התחבר
          </button>
        </div>
      )}

      {isDocumentAdmin && (
        <>
          <div className="section-title">ניהול מיוחד</div>
          <div className="dashboard-grid">
            <DashboardCard
              title="ניהול חתימות על מסמכים"
              subtitle="כניסה לאזור הניהול למסמכים שבאחריותך"
              icon={PenNib}
              color="#dc2626"
              onClick={() => navigate('/admin')}
            />
          </div>
        </>
      )}

      {/* Main Services */}
      <div className="section-title">שירותים מרכזיים</div>
      <div className="dashboard-grid">
        {homeSettings?.events !== false && (
          <DashboardCard
            title="לוח אירועים"
            subtitle="תרבות, חגים ופעילויות בקהילה"
            icon={CalendarBlank}
            color="#2563eb" // Blue
            onClick={() => navigate('/events')}
          />
        )}
        {homeSettings?.professionals !== false && (
          <DashboardCard
            title="בעלי מקצוע"
            subtitle="אינדקס נותני שירות מומלצים"
            icon={Wrench}
            color="#059669" // Emerald
            onClick={() => navigate('/professionals')}
          />
        )}
      </div>

      {/* Community Life */}
      <div className="section-title">חיי קהילה</div>
      <div className="dashboard-grid">
        {homeSettings?.pub !== false && (
          <DashboardCard
            title="הפאב הקהילתי"
            subtitle="שעות פתיחה ומידע"
            icon={BeerBottle}
            color="#d97706" // Amber
            onClick={() => navigate('/pub')}
          />
        )}
        {homeSettings?.pub_orders !== false && (
          <DashboardCard
            title="הזמנות לפאב"
            subtitle="תפריט ורכישה ישירה"
            icon={ShoppingCart}
            color="#f59e0b" // Amber variant
            onClick={() => navigate('/pub/order')}
          />
        )}
        {homeSettings?.pool_orders !== false && (
          <DashboardCard
            title="הזמנות לבריכה"
            subtitle="תפריט ורכישה ליושבים בבריכה"
            icon={ShoppingCart}
            color="#0ea5e9" // Light Blue
            onClick={() => navigate('/pub/pool-order')}
          />
        )}
        {homeSettings?.library !== false && (
          <DashboardCard
            title="ספרייה"
            subtitle="קטלוג ספרים והשאלות"
            icon={Books}
            color="#7c3aed" // Violet
            onClick={() => navigate('/library')}
          />
        )}
        {homeSettings?.map !== false && (
          <DashboardCard
            title="מפת הקיבוץ"
            subtitle="ניווט ואיתור מבנים"
            icon={MapTrifold}
            color="#0891b2" // Cyan
            onClick={() => navigate('/map')}
          />
        )}
        {homeSettings?.archive !== false && (
          <DashboardCard
            title="ארכיון היסטורי"
            subtitle="תמונות, סרטונים וזכרונות"
            icon={Archive}
            color="#4f46e5" // Indigo
            badge="חדש!"
            onClick={() => navigate('/archive')}
          />
        )}
        {homeSettings?.announcements !== false && (
          <DashboardCard
            title="מודעות"
            subtitle="עדכונים חשובים מהמזכירות"
            icon={Megaphone}
            color="#db2777" // Pink
            onClick={() => navigate('/announcements')}
          />
        )}

        {homeSettings?.benefits !== false && (
          <DashboardCard
            title="זכויות והטבות"
            subtitle="מידע על זכויות בעמק המעיינות"
            icon={Gift}
            color="#10b981" // Emerald
            onClick={() => navigate('/benefits')}
          />
        )}

        {homeSettings?.recipe_book !== false && (
          <DashboardCard
            title="ספר המתכונים (צפייה)"
            subtitle="טעמים וזכרונות מהקהילה"
            icon={BookOpen}
            color="#ea580c" // Orange
            badge="חדש!"
            onClick={() => navigate('/recipes/book')}
          />
        )}
        {homeSettings?.recipes_upload !== false && (
          <DashboardCard
            title="העלאת מתכון"
            subtitle="הוסיפו מתכון חדש לספר"
            icon={CookingPot}
            color="#f97316" // Slightly lighter orange
            onClick={() => navigate('/recipes/upload')}
          />
        )}
        {homeSettings?.voting !== false && (
          <DashboardCard
            title="הצבעות לחברים בלבד - קהילנט"
            subtitle="מעבר לאתר חיצוני להצבעה"
            icon={ListChecks}
            color="#0d9488" // Teal
            onClick={() => window.open('http://neveur.co.il/', '_blank')}
          />
        )}
      </div>
    </div>
  );
}

export default Home;