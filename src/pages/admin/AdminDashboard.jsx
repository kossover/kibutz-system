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
  Calendar,
  Beer,
  Users,
  Wrench,
  BookOpen,
  Map,
  List,
  Package,
  Utensils,
  Settings,
  Gift,
  Link as LinkIcon,
  Archive,
  Search,
  Scissors,
  FileText,
  Image as Images,
  Youtube,
  PenTool,
  Users as UsersThree
} from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-emerald-600 font-bold text-xl animate-pulse">בודק הרשאות...</div>
      </div>
    );
  }

  const tabs = [];

  if (userRole === 'admin') {
    tabs.push({ id: 'settings', label: 'הגדרות', icon: Settings });
    tabs.push({ id: 'pages', label: 'דפי נחיתה', icon: LinkIcon });
  }

  if (userRole === 'admin' || userRole === 'culture_admin') {
    tabs.push({ id: 'events', label: 'אירועים', icon: Calendar });
    tabs.push({ id: 'equipment', label: 'מחסן ציוד', icon: Package });
    tabs.push({ id: 'mishloach', label: 'משלוחי מנות', icon: Gift });
  }

  if (userRole === 'admin' || userRole === 'archive_admin' || userRole === 'culture_admin') {
    tabs.push({ id: 'archive_documents', label: 'ארכיון: מסמכים', icon: FileText });
    tabs.push({ id: 'album_digitizer', label: 'ארכיון: תמונות', icon: Images });
    tabs.push({ id: 'archive_scanner', label: 'ארכיון: סרטונים', icon: Youtube });
  }

  if (userRole === 'admin' || userRole === 'pub_admin') {
    tabs.push({ id: 'pub', label: 'פאב', icon: Beer });
  }

  if (userRole === 'admin' || userRole === 'professionals_admin') {
    tabs.push({ id: 'professionals', label: 'בעלי מקצוע', icon: Wrench });
    tabs.push({ id: 'categories', label: 'קטגוריות', icon: List });
  }

  if (userRole === 'admin' || userRole === 'librarian') {
    tabs.push({ id: 'library', label: 'ספרייה', icon: BookOpen });
  }

  if (userRole === 'admin' || userRole === 'recipes_admin') {
    tabs.push({ id: 'recipes', label: 'מתכונים', icon: Utensils });
  }

  if (userRole === 'admin' || userRole === 'document_admin') {
    tabs.push({ id: 'signatures', label: 'חתימת מסמכים', icon: PenTool });
  }
  if (userRole === 'admin') {
    tabs.push({ id: 'map', label: 'מפה', icon: Map });
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
    <div className="max-w-7xl mx-auto px-4 pt-12 pb-32" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="glass-card mb-8 p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-right">
          <h1 className="text-3xl md:text-4xl font-black text-emerald-600 tracking-tight mb-3">
            פאנל ניהול
          </h1>
          <div className="inline-block bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200">
            {getRoleLabel()}
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="glass-pill flex items-center gap-2 font-bold text-slate-600 hover:bg-slate-50 border-slate-200"
        >
          חזרה לאפליקציה
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Navigation Tabs */}
        <div className="w-full lg:w-64 glass-card p-4 flex lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:sticky lg:top-24 z-10 shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-bold whitespace-nowrap transition-all flex-shrink-0 lg:flex-shrink ${
                  isActive 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 3 : 2.5} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full glass-card p-6 md:p-8 min-h-[500px]">
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