import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  Calendar,
  Beer,
  Wrench,
  Book,
  Map,
  Megaphone,
  Utensils,
  ListTodo,
  User,
  BookOpen,
  Archive,
  LogIn,
  ArrowLeft,
  PenTool,
  Gift,
  ShoppingCart
} from 'lucide-react';

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

  // Bento Card Component
  const DashboardCard = ({ title, subtitle, icon: Icon, colorClass, bgLightClass, onClick, badge, span = 1 }) => (
    <div
      onClick={onClick}
      className={`glass-card relative flex flex-col justify-between p-6 cursor-pointer group ${span === 2 ? 'md:col-span-2' : ''}`}
    >
      <div className={`absolute top-0 right-0 w-2 h-full ${bgLightClass} opacity-50`}></div>
      
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-3xl ${bgLightClass} ${colorClass} transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={32} strokeWidth={2} />
        </div>
        {badge && (
          <span className="bg-amber-100 text-amber-600 text-xs font-black px-3 py-1 rounded-full shadow-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="z-10">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">{title}</h3>
        <p className="text-slate-500 font-medium text-sm leading-snug">{subtitle}</p>
      </div>

      <div className={`mt-6 flex items-center text-sm font-bold ${colorClass} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`}>
        כניסה <ArrowLeft size={16} className="mr-2" strokeWidth={3} />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 pt-12 pb-32">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tight mb-2">
            {loading ? '...' : (currentUser ? `היי, ${userName}` : 'ברוכים הבאים')}
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            {currentUser ? 'מה תרצו לעשות היום?' : 'מערכת ה-Lifestyle של הקהילה'}
          </p>
        </div>

        <button
          onClick={() => navigate(currentUser ? '/profile' : '/login')}
          className="bg-white/40 backdrop-blur-md p-2 rounded-full border border-white/60 shadow-xl hover:scale-105 transition-transform"
        >
          {currentUser && currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <User size={48} className="text-slate-400 p-2" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {!currentUser && (
        <div className="glass-card p-6 mb-8 flex items-center gap-6 cursor-pointer hover:bg-white/80" onClick={() => navigate('/login')}>
          <div className="bg-emerald-100 p-4 rounded-3xl text-emerald-600">
            <LogIn size={32} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-slate-800 mb-1">אורח במערכת?</h3>
            <p className="text-slate-500 font-medium text-sm">התחבר כדי לגשת לכל השירותים, להזמין תורים ולהירשם לאירועים.</p>
          </div>
          <div className="hidden md:block">
            <button className="bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors">
              התחברות
            </button>
          </div>
        </div>
      )}

      {isDocumentAdmin && (
        <div className="mb-10">
          <h2 className="text-slate-400 font-bold tracking-widest text-xs uppercase mb-4 pl-2">ניהול מיוחד</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard
              title="ניהול חתימות על מסמכים"
              subtitle="כניסה לאזור הניהול למסמכים שבאחריותך"
              icon={PenTool}
              colorClass="text-red-500"
              bgLightClass="bg-red-50"
              onClick={() => navigate('/admin')}
            />
          </div>
        </div>
      )}

      {/* Main Services (Bento Grid) */}
      <div className="mb-10">
        <h2 className="text-slate-400 font-bold tracking-widest text-xs uppercase mb-4 pl-2">שירותים מרכזיים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {homeSettings?.events !== false && (
            <DashboardCard
              title="לוח אירועים"
              subtitle="תרבות, חגים ופעילויות בקהילה"
              icon={Calendar}
              colorClass="text-blue-500"
              bgLightClass="bg-blue-50"
              onClick={() => navigate('/events')}
              span={2}
            />
          )}
          {homeSettings?.professionals !== false && (
            <DashboardCard
              title="בעלי מקצוע"
              subtitle="אינדקס נותני שירות מומלצים"
              icon={Wrench}
              colorClass="text-emerald-500"
              bgLightClass="bg-emerald-50"
              onClick={() => navigate('/professionals')}
              span={2}
            />
          )}
        </div>
      </div>

      {/* Community Life (Bento Grid) */}
      <div className="mb-10">
        <h2 className="text-slate-400 font-bold tracking-widest text-xs uppercase mb-4 pl-2">חיי קהילה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {homeSettings?.pub !== false && (
            <DashboardCard
              title="הפאב הקהילתי"
              subtitle="שעות פתיחה ומידע"
              icon={Beer}
              colorClass="text-amber-500"
              bgLightClass="bg-amber-50"
              onClick={() => navigate('/pub')}
            />
          )}
          {homeSettings?.pub_orders !== false && (
            <DashboardCard
              title="הזמנות לפאב"
              subtitle="תפריט ורכישה ישירה"
              icon={ShoppingCart}
              colorClass="text-orange-500"
              bgLightClass="bg-orange-50"
              onClick={() => navigate('/pub/order')}
            />
          )}
          {homeSettings?.pool_orders !== false && (
            <DashboardCard
              title="הזמנות לבריכה"
              subtitle="תפריט ורכישה ליושבים בבריכה"
              icon={ShoppingCart}
              colorClass="text-cyan-500"
              bgLightClass="bg-cyan-50"
              onClick={() => navigate('/pub/pool-order')}
            />
          )}
          {homeSettings?.library !== false && (
            <DashboardCard
              title="ספרייה"
              subtitle="קטלוג ספרים והשאלות"
              icon={Book}
              colorClass="text-violet-500"
              bgLightClass="bg-violet-50"
              onClick={() => navigate('/library')}
            />
          )}
          {homeSettings?.map !== false && (
            <DashboardCard
              title="מפת הקיבוץ"
              subtitle="ניווט ואיתור מבנים"
              icon={Map}
              colorClass="text-teal-500"
              bgLightClass="bg-teal-50"
              onClick={() => navigate('/map')}
            />
          )}
          {homeSettings?.archive !== false && (
            <DashboardCard
              title="ארכיון היסטורי"
              subtitle="תמונות, סרטונים וזכרונות"
              icon={Archive}
              colorClass="text-indigo-500"
              bgLightClass="bg-indigo-50"
              badge="חדש!"
              onClick={() => navigate('/archive')}
            />
          )}
          {homeSettings?.announcements !== false && (
            <DashboardCard
              title="מודעות"
              subtitle="עדכונים חשובים מהמזכירות"
              icon={Megaphone}
              colorClass="text-pink-500"
              bgLightClass="bg-pink-50"
              onClick={() => navigate('/announcements')}
            />
          )}

          {homeSettings?.benefits !== false && (
            <DashboardCard
              title="זכויות והטבות"
              subtitle="מידע על זכויות בעמק המעיינות"
              icon={Gift}
              colorClass="text-emerald-500"
              bgLightClass="bg-emerald-50"
              onClick={() => navigate('/benefits')}
            />
          )}

          {homeSettings?.recipe_book !== false && (
            <DashboardCard
              title="ספר המתכונים"
              subtitle="טעמים וזכרונות מהקהילה"
              icon={BookOpen}
              colorClass="text-orange-500"
              bgLightClass="bg-orange-50"
              badge="חדש!"
              onClick={() => navigate('/recipes/book')}
            />
          )}
          {homeSettings?.recipes_upload !== false && (
            <DashboardCard
              title="העלאת מתכון"
              subtitle="הוסיפו מתכון חדש לספר"
              icon={Utensils}
              colorClass="text-orange-400"
              bgLightClass="bg-orange-50"
              onClick={() => navigate('/recipes/upload')}
            />
          )}
          {homeSettings?.voting !== false && (
            <DashboardCard
              title="הצבעות"
              subtitle="מעבר לאתר קהילנט"
              icon={ListTodo}
              colorClass="text-teal-600"
              bgLightClass="bg-teal-50"
              onClick={() => window.open('http://neveur.co.il/', '_blank')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;