import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ManageEvents from './ManageEvents';
import ManagePub from './ManagePub';
import ManageUsers from './ManageUsers';
import ManageProfessionals from './ManageProfessionals';
import ManageCategories from './ManageCategories';
import ManageLibrary from './ManageLibrary';
import ManageMap from './ManageMap';
import ManageEquipment from './ManageEquipment';
import ManageRecipes from './ManageRecipes';
import ManageSettings from './ManageSettings';
import ManageLandingPages from './ManageLandingPages';
import ManageMishloachManot from './ManageMishloachManot';
import ManageArchive from './ManageArchive';
import ManageArchiveScanner from './ManageArchiveScanner';
import ManageAlbumDigitizer from './ManageAlbumDigitizer';
import ManageDocuments from './ManageDocuments';
import ManageSignatures from './ManageSignatures';
import ManageGroups from './ManageGroups';
import {
  CalendarBlank,
  BeerBottle,
  Users,
  Wrench,
  Books,
  MapTrifold,
  List,
  Package,
  CookingPot,
  Gear,
  Gift,
  Link as LinkIcon,
  Archive,
  MagnifyingGlass,
  Scissors,
  FileText,
  Images,
  YoutubeLogo,
  PenNib,
  UsersThree
} from '@phosphor-icons/react';

function AdminDashboard() {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = searchParams.get('tab') || '';
  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  useEffect(() => {
    const checkRole = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          let role = userDoc.data().role;
          const allowedRoles = ['admin', 'culture_admin', 'pub_admin', 'professionals_admin', 'librarian', 'recipes_admin', 'archive_admin'];

          let hasAccess = allowedRoles.includes(role);

          if (!hasAccess && auth.currentUser.email) {
            // Check if they are listed as a document admin
            const qDocs = query(collection(db, 'documents_for_signature'), where('documentAdmins', 'array-contains', auth.currentUser.email));
            const docsSnapshot = await getDocs(qDocs);
            if (!docsSnapshot.empty) {
                hasAccess = true;
                role = 'document_admin';
            }
          }

          if (!hasAccess) {
            alert('אין לך הרשאות גישה לדף זה');
            navigate('/');
            return;
          }
          setUserRole(role);

          // קבע טאב התחלתי לפי התפקיד אם אין כזה ב-URL
          const currentTab = new URLSearchParams(window.location.search).get('tab');
          if (!currentTab) {
            let defaultTab = '';
            if (role === 'admin' || role === 'culture_admin') defaultTab = 'events';
            else if (role === 'pub_admin') defaultTab = 'pub';
            else if (role === 'professionals_admin') defaultTab = 'professionals';
            else if (role === 'librarian') defaultTab = 'library';
            else if (role === 'recipes_admin') defaultTab = 'recipes';
            else if (role === 'archive_admin') defaultTab = 'archive_documents';
            else if (role === 'document_admin') defaultTab = 'signatures';

            if (defaultTab) setSearchParams({ tab: defaultTab }, { replace: true });
          }

        } else {
          alert('משתמש לא נמצא במערכת');
          navigate('/');
        }
      } catch (error) {
        console.error('Error checking role:', error);
        alert('שגיאה בבדיקת הרשאות');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [navigate]);

  if (loading) {
    return (
      <div className="loading">
        בודק הרשאות...
      </div>
    );
  }

  const tabs = [];

  if (userRole === 'admin') {
    tabs.push({ id: 'settings', label: 'הגדרות', icon: Gear });
    tabs.push({ id: 'pages', label: 'דפי נחיתה', icon: LinkIcon });
  }

  if (userRole === 'admin' || userRole === 'culture_admin') {
    tabs.push({ id: 'events', label: 'אירועים', icon: CalendarBlank });
    tabs.push({ id: 'equipment', label: 'מחסן ציוד', icon: Package });
    tabs.push({ id: 'mishloach', label: 'משלוחי מנות', icon: Gift });
  }

  if (userRole === 'admin' || userRole === 'archive_admin' || userRole === 'culture_admin') {
    tabs.push({ id: 'archive_documents', label: 'ארכיון: מסמכים', icon: FileText });
    tabs.push({ id: 'album_digitizer', label: 'ארכיון: תמונות', icon: Images });
    tabs.push({ id: 'archive_scanner', label: 'ארכיון: סרטונים', icon: YoutubeLogo });
  }

  if (userRole === 'admin' || userRole === 'pub_admin') {
    tabs.push({ id: 'pub', label: 'פאב', icon: BeerBottle });
  }

  if (userRole === 'admin' || userRole === 'professionals_admin') {
    tabs.push({ id: 'professionals', label: 'בעלי מקצוע', icon: Wrench });
    tabs.push({ id: 'categories', label: 'קטגוריות', icon: List });
  }

  if (userRole === 'admin' || userRole === 'librarian') {
    tabs.push({ id: 'library', label: 'ספרייה', icon: Books });
  }

  if (userRole === 'admin' || userRole === 'recipes_admin') {
    tabs.push({ id: 'recipes', label: 'מתכונים', icon: CookingPot });
  }

  if (userRole === 'admin' || userRole === 'document_admin') {
    tabs.push({ id: 'signatures', label: 'חתימת מסמכים', icon: PenNib });
  }
  if (userRole === 'admin') {
    tabs.push({ id: 'map', label: 'מפה', icon: MapTrifold });
    tabs.push({ id: 'users', label: 'משתמשים', icon: Users });
    tabs.push({ id: 'groups', label: 'קבוצות משתמשים', icon: UsersThree });
  }

  const getRoleLabel = () => {
    const roles = {
      'admin': 'מנהל מערכת',
      'culture_admin': 'מנהל תרבות',
      'pub_admin': 'מנהל פאב',
      'professionals_admin': 'מנהל בעלי מקצוע',
      'librarian': 'ספרן',
      'recipes_admin': 'מנהל מתכונים',
      'archive_admin': 'מנהל ארכיון',
      'document_admin': 'מנהל מסמכים'
    };
    return roles[userRole] || 'משתמש';
  };

  return (
    <div className="admin-page-wrapper">
      <style>{`
        /* Modern Admin Layout */
        .admin-page-wrapper {
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
          padding: 24px;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 20px;
          background: linear-gradient(135deg, var(--bg-card) 0%, #f8fafc 100%);
          padding: 24px 32px;
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }

        .admin-header .page-title {
          margin: 0;
          font-size: 2rem;
          background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .role-badge {
          background: rgba(37, 99, 235, 0.1);
          color: var(--accent-color);
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 700;
          border: 1px solid rgba(37, 99, 235, 0.2);
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.05);
        }

        .admin-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }

        /* Tabs as a modern sidebar on desktop */
        .tabs-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 240px;
          background: var(--bg-card);
          padding: 16px;
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid rgba(226, 232, 240, 0.8);
          position: sticky;
          top: 24px;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          border-radius: var(--radius-lg);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: right;
          position: relative;
          overflow: hidden;
        }

        .tab-btn::before {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--accent-color);
          border-radius: 4px 0 0 4px;
          transform: scaleY(0);
          transition: transform 0.3s ease;
        }

        .tab-btn:hover {
          color: var(--primary-color);
          background: var(--bg-subtle);
          transform: translateX(-4px);
        }

        .tab-btn.active {
          color: var(--accent-color);
          background: rgba(37, 99, 235, 0.08);
          box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
        }

        .tab-btn.active::before {
          transform: scaleY(0.6);
        }

        .admin-content {
          flex: 1;
          min-width: 0; /* Prevents overflow */
          background: var(--bg-card);
          padding: 32px;
          border-radius: var(--radius-xl);
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          border: 1px solid rgba(226, 232, 240, 0.8);
          min-height: 500px;
        }

        /* Mobile adjustments */
        @media (max-width: 900px) {
          .admin-layout {
            flex-direction: column;
            gap: 16px;
          }
          
          .admin-page-wrapper {
            padding: 12px;
            padding-bottom: 100px;
          }

          .admin-header {
            margin-bottom: 8px;
            padding: 20px 16px;
            flex-direction: column;
            align-items: center;
            text-align: center;
            border-radius: var(--radius-lg);
            gap: 16px;
          }
          
          .admin-header .page-title {
            font-size: 1.75rem;
          }

          .admin-header button {
            width: 100% !important;
            justify-content: center;
            padding: 12px 24px !important;
          }

          .tabs-container {
            flex-direction: row;
            overflow-x: auto;
            position: relative;
            top: 0;
            width: calc(100% + 24px);
            margin-left: -12px;
            margin-right: -12px;
            padding: 8px 12px 16px 12px;
            background: transparent;
            border: none;
            box-shadow: none;
            gap: 10px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .tabs-container::-webkit-scrollbar {
            display: none;
          }

          .tab-btn {
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap;
            padding: 12px 20px;
            font-size: 0.95rem;
            font-weight: 600;
            background: var(--bg-card);
            border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 999px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.03);
            color: var(--text-secondary);
            flex-shrink: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: center;
          }

          .tab-btn:hover {
            transform: none;
          }

          .tab-btn::before {
            display: none !important;
          }

          .tab-btn.active {
            background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
            color: white;
            border-color: transparent;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
          }
          
          .tab-btn.active svg {
            color: white !important;
            fill: white !important;
          }

          .admin-content {
            padding: 16px;
            width: 100%;
            border-radius: var(--radius-lg);
          }
        }
      `}</style>

      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="page-title">
            פאנל ניהול מורחב
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '8px' }}>
            <span className="role-badge">{getRoleLabel()}</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="btn btn-secondary"
          style={{ width: 'auto', borderRadius: '999px', padding: '10px 24px', fontWeight: 600 }}
        >
          חזרה לאפליקציה
        </button>
      </div>

      <div className="admin-layout">
        {/* Navigation Tabs */}
        <div className="tabs-container">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={24} weight={activeTab === tab.id ? "duotone" : "regular"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="admin-content">
          {activeTab === 'events' && <ManageEvents />}
          {activeTab === 'equipment' && <ManageEquipment />}
          {activeTab === 'pub' && <ManagePub />}
          {activeTab === 'categories' && <ManageCategories />}
          {activeTab === 'professionals' && <ManageProfessionals />}
          {activeTab === 'library' && <ManageLibrary />}
          {activeTab === 'map' && <ManageMap />}
          {activeTab === 'users' && <ManageUsers />}
          {activeTab === 'recipes' && <ManageRecipes />}
          {activeTab === 'settings' && <ManageSettings />}
          {activeTab === 'pages' && <ManageLandingPages />}
          {activeTab === 'mishloach' && <ManageMishloachManot />}
          {activeTab === 'archive' && <ManageArchive />}
          {activeTab === 'archive_scanner' && <ManageArchiveScanner />}
          {activeTab === 'album_digitizer' && <ManageAlbumDigitizer />}
          {activeTab === 'archive_documents' && <ManageDocuments />}
          {activeTab === 'signatures' && <ManageSignatures userRole={userRole} />}
          {activeTab === 'groups' && <ManageGroups />}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;