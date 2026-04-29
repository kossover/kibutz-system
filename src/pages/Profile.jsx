import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  UserCircle,
  Crown,
  MaskHappy,
  BeerBottle,
  Toolbox,
  NotePencil,
  CalendarBlank,
  Money,
  Briefcase,
  Gear,
  SignOut,
  CheckCircle,
  X,
  BookOpen,
  Package // Added import
} from '@phosphor-icons/react';

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
      icon: <CalendarBlank size={28} weight="duotone" color="var(--primary-color)" />,
      title: 'האירועים שלי',
      subtitle: 'אירועים שנרשמת אליהם',
      onClick: () => alert('בשלב הבא - רשימת אירועים')
    },
    {
      icon: <Package size={28} weight="duotone" color="var(--primary-color)" />,
      title: 'מחסן ציוד',
      subtitle: 'השאלות וציוד זמין',
      onClick: () => navigate('/equipment')
    },
    {
      icon: <Money size={28} weight="duotone" color="var(--primary-color)" />,
      title: 'חשבון הפאב',
      subtitle: 'היסטוריה ויתרה',
      onClick: () => navigate('/pub')
    },
    {
      icon: <BookOpen size={28} weight="duotone" color="var(--primary-color)" />,
      title: 'הספרים שלי',
      subtitle: 'ספרים מושאלים מהספרייה',
      onClick: () => navigate('/library')
    },
    {
      icon: <Briefcase size={28} weight="duotone" color="var(--primary-color)" />,
      title: 'הפרופיל המקצועי שלי',
      subtitle: 'ערוך פרטי בעל מקצוע',
      onClick: () => alert('בשלב הבא - עריכת פרופיל מקצועי')
    }
  ];

  if (loadingRole) {
    return (
      <div className="page-container">
        <div className="loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">האזור שלי</h1>

      {/* כרטיס משתמש */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        marginBottom: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'white',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserCircle size={64} weight="duotone" color="#667eea" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            שלום, {userDoc?.firstName && userDoc?.lastName
              ? `${userDoc.firstName} ${userDoc.lastName}`
              : auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0]}!
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>
            {auth.currentUser?.email}
          </p>
          {userRole && userRole !== 'user' && (
            <div style={{
              marginTop: '12px',
              padding: '6px 16px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '14px'
            }}>
              {userRole === 'admin' ? <><Crown size={18} weight="fill" /> מנהל</> :
                userRole === 'culture_admin' ? <><MaskHappy size={18} weight="duotone" /> מנהל תרבות</> :
                  userRole === 'pub_admin' ? <><BeerBottle size={18} weight="duotone" /> מנהל פאב</> :
                    userRole === 'professionals_admin' ? <><Toolbox size={18} weight="duotone" /> מנהל בעלי מקצוע</> :
                      userRole === 'librarian' ? <><BookOpen size={18} weight="duotone" /> מנהל ספרייה</> : ''}
            </div>
          )}
        </div>
      </div>

      {/* פרטים אישיים */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotePencil size={28} weight="duotone" color="var(--primary-color)" />
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
              פרטים אישיים
            </h3>
          </div>
          {!editingPersonal && (
            <button
              onClick={() => setEditingPersonal(true)}
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '8px 16px' }}
            >
              <NotePencil size={16} weight="bold" />
              ערוך
            </button>
          )}
        </div>

        {editingPersonal ? (
          <div>
            <div className="form-group">
              <label className="form-label">שם פרטי</label>
              <input
                type="text"
                className="form-input"
                value={personalForm.firstName}
                onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">שם משפחה</label>
              <input
                type="text"
                className="form-input"
                value={personalForm.lastName}
                onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">טלפון</label>
              <input
                type="tel"
                className="form-input"
                value={personalForm.phone}
                onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSavePersonal}
                disabled={saving}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                <CheckCircle size={20} weight="fill" />
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
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                <X size={20} weight="bold" />
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div className="text-sm text-muted mb-1">שם מלא</div>
              <div className="text-bold text-lg">
                {userDoc?.firstName && userDoc?.lastName
                  ? `${userDoc.firstName} ${userDoc.lastName}`
                  : 'לא הוגדר'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">טלפון</div>
              <div className="text-bold text-lg">
                {userDoc?.phone || 'לא הוגדר'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">אימייל</div>
              <div className="text-bold text-lg">
                {auth.currentUser?.email}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* כפתור ניהול */}
      <button
        onClick={handleAdminAccess}
        className="btn"
        style={{
          marginBottom: '24px',
          background: (userRole && userRole !== 'user')
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : '#9CA3AF',
          color: 'white',
          fontSize: '18px',
          padding: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}
      >
        <Gear size={24} weight="duotone" />
        פאנל ניהול {!userRole || userRole === 'user' ? '(נדרשת הרשאה)' : ''}
      </button>

      {/* תפריט */}
      <div>
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="card"
            onClick={item.onClick}
            style={{ cursor: 'pointer', marginBottom: 12 }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  marginBottom: '4px'
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  margin: 0
                }}>
                  {item.subtitle}
                </p>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                ←
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* כפתור התנתקות */}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="btn btn-danger"
        style={{
          marginTop: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}
      >
        <SignOut size={24} weight="bold" />
        <span>{loading ? 'מתנתק...' : 'התנתק'}</span>
      </button>
    </div>
  );
}

export default Profile;