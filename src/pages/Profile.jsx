import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  UserCircle,
  Crown,
  Smile,
  Beer,
  Wrench,
  PenTool,
  Calendar,
  Banknote,
  Briefcase,
  Settings,
  LogOut,
  CheckCircle,
  X,
  BookOpen,
  Package,
  ArrowLeft
} from 'lucide-react';

function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });

  useEffect(() => {
    const getUserRole = async () => {
      if (auth.currentUser) {
        try {
          const docRef = doc(db, 'users', auth.currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRole(data.role);
            setUserDoc(data);
            setPersonalForm({
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              phone: data.phone || ''
            });
          } else {
            setUserDoc(null);
          }
        } catch (error) {
          console.error('Error getting user role:', error);
        }
      }
      setLoadingRole(false);
    };
    getUserRole();
  }, []);

  const handleLogout = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
      setLoading(true);
      try {
        await signOut(auth);
        navigate('/login');
      } catch (error) {
        console.error('Error signing out:', error);
        alert('אירעה שגיאה בהתנתקות');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAdminAccess = () => {
    if (!userDoc) {
      alert('⚠ לא נמצא מסמך משתמש ב-Firestore!');
      return;
    }

    const allowedRoles = ['admin', 'culture_admin', 'pub_admin', 'professionals_admin', 'librarian', 'recipes_admin', 'archive_admin'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      alert('⚠ אין לך הרשאות מנהל!');
      return;
    }

    navigate('/admin');
  };

  const handleSavePersonal = async () => {
    if (!auth.currentUser) return;

    setSaving(true);
    try {
      const updateData = {
        firstName: personalForm.firstName.trim(),
        lastName: personalForm.lastName.trim(),
        phone: personalForm.phone.trim()
      };

      if (updateData.firstName && updateData.lastName) {
        updateData.name = `${updateData.firstName} ${updateData.lastName}`;
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);

      const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (docSnap.exists()) {
        setUserDoc(docSnap.data());
      }

      setEditingPersonal(false);
      alert('הפרטים עודכנו בהצלחה!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('שגיאה בעדכון הפרטים');
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    {
      icon: <Calendar size={28} className="text-emerald-500" strokeWidth={2} />,
      title: 'האירועים שלי',
      subtitle: 'אירועים שנרשמת אליהם',
      onClick: () => alert('בשלב הבא - רשימת אירועים')
    },
    {
      icon: <Package size={28} className="text-emerald-500" strokeWidth={2} />,
      title: 'מחסן ציוד',
      subtitle: 'השאלות וציוד זמין',
      onClick: () => navigate('/equipment')
    },
    {
      icon: <Banknote size={28} className="text-emerald-500" strokeWidth={2} />,
      title: 'חשבון הפאב',
      subtitle: 'היסטוריה ויתרה',
      onClick: () => navigate('/pub')
    },
    {
      icon: <BookOpen size={28} className="text-emerald-500" strokeWidth={2} />,
      title: 'הספרים שלי',
      subtitle: 'ספרים מושאלים מהספרייה',
      onClick: () => navigate('/library')
    },
    {
      icon: <Briefcase size={28} className="text-emerald-500" strokeWidth={2} />,
      title: 'הפרופיל המקצועי שלי',
      subtitle: 'ערוך פרטי בעל מקצוע',
      onClick: () => alert('בשלב הבא - עריכת פרופיל מקצועי')
    }
  ];

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-emerald-600 font-bold text-xl animate-pulse">טוען...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-32">
      <h1 className="text-4xl font-black text-emerald-600 tracking-tight mb-8">האזור שלי</h1>

      {/* User Card */}
      <div className="glass-card mb-8 overflow-hidden relative border-none shadow-2xl shadow-emerald-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-700 opacity-90 mix-blend-multiply"></div>
        <div className="relative z-10 p-8 text-center text-white">
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md mx-auto mb-4 flex items-center justify-center border-2 border-white/40 shadow-lg">
            <UserCircle size={64} className="text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">
            שלום, {userDoc?.firstName && userDoc?.lastName
              ? `${userDoc.firstName} ${userDoc.lastName}`
              : auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0]}!
          </h2>
          <p className="text-emerald-100 font-medium text-lg">
            {auth.currentUser?.email}
          </p>
          
          {userRole && userRole !== 'user' && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 text-sm font-bold shadow-sm">
              {userRole === 'admin' ? <><Crown size={18} /> מנהל</> :
                userRole === 'culture_admin' ? <><Smile size={18} /> מנהל תרבות</> :
                  userRole === 'pub_admin' ? <><Beer size={18} /> מנהל פאב</> :
                    userRole === 'professionals_admin' ? <><Wrench size={18} /> מנהל בעלי מקצוע</> :
                      userRole === 'librarian' ? <><BookOpen size={18} /> מנהל ספרייה</> : ''}
            </div>
          )}
        </div>
      </div>

      {/* Personal Details */}
      <div className="glass-card p-6 md:p-8 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <PenTool size={28} strokeWidth={2.5} />
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">פרטים אישיים</h3>
          </div>
          {!editingPersonal && (
            <button
              onClick={() => setEditingPersonal(true)}
              className="glass-pill text-emerald-600 flex items-center gap-2 border-emerald-200"
            >
              <PenTool size={16} strokeWidth={3} />
              ערוך
            </button>
          )}
        </div>

        {editingPersonal ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-500 mb-1">שם פרטי</label>
              <input
                type="text"
                className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={personalForm.firstName}
                onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 mb-1">שם משפחה</label>
              <input
                type="text"
                className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={personalForm.lastName}
                onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-500 mb-1">טלפון</label>
              <input
                type="tel"
                className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                value={personalForm.phone}
                onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSavePersonal}
                disabled={saving}
                className="flex-1 bg-emerald-500 text-white font-bold rounded-2xl py-3 flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle size={20} strokeWidth={2.5} />
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => {
                  setEditingPersonal(false);
                  setPersonalForm({
                    firstName: userDoc?.firstName || '',
                    lastName: userDoc?.lastName || '',
                    phone: userDoc?.phone || ''
                  });
                }}
                disabled={saving}
                className="flex-1 bg-slate-200 text-slate-700 font-bold rounded-2xl py-3 flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-sm font-bold text-slate-400 mb-1 tracking-wide uppercase">שם מלא</div>
              <div className="text-xl font-black text-slate-800">
                {userDoc?.firstName && userDoc?.lastName
                  ? `${userDoc.firstName} ${userDoc.lastName}`
                  : 'לא הוגדר'}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400 mb-1 tracking-wide uppercase">טלפון</div>
              <div className="text-xl font-black text-slate-800">
                {userDoc?.phone || 'לא הוגדר'}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400 mb-1 tracking-wide uppercase">אימייל</div>
              <div className="text-xl font-black text-slate-800">
                {auth.currentUser?.email}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Panel Button */}
      <button
        onClick={handleAdminAccess}
        className={`w-full mb-8 flex items-center justify-center gap-3 p-6 rounded-[32px] text-white font-black text-xl transition-all duration-300 shadow-xl ${
          (userRole && userRole !== 'user')
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] shadow-blue-500/30 cursor-pointer'
            : 'bg-slate-400 cursor-not-allowed opacity-70 shadow-slate-400/20'
        }`}
      >
        <Settings size={28} strokeWidth={2.5} />
        פאנל ניהול {!userRole || userRole === 'user' ? '(נדרשת הרשאה)' : ''}
      </button>

      {/* Menu Options (Bento list) */}
      <div className="flex flex-col gap-4 mb-12">
        {menuItems.map((item, index) => (
          <div
            key={index}
            onClick={item.onClick}
            className="glass-card p-5 cursor-pointer group flex items-center gap-4 hover:bg-emerald-50/50 transition-colors"
          >
            <div className="bg-emerald-100 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              {item.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">
                {item.title}
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {item.subtitle}
              </p>
            </div>
            <div className="text-slate-300 group-hover:text-emerald-500 transition-colors group-hover:-translate-x-2 duration-300">
              <ArrowLeft size={24} strokeWidth={2.5} />
            </div>
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-red-50 text-red-600 font-black text-lg border border-red-200 hover:bg-red-100 transition-colors"
      >
        <LogOut size={24} strokeWidth={2.5} />
        <span>{loading ? 'מתנתק...' : 'התנתק'}</span>
      </button>
    </div>
  );
}

export default Profile;