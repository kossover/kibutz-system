import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { Home, Calendar, Beer, Wrench, User, Package, Book, Map, Megaphone, Utensils, ListTodo, Archive, Gift, Info } from 'lucide-react';

function BottomNav() {
  const location = useLocation();
  const isDark = location.pathname.includes('/pub');

  const [visibleItems, setVisibleItems] = useState({
    events: true,
    professionals: true,
    library: false,
    map: false,
    pub: true,
    announcements: false,
    benefits: true,
    equipment: true,
    recipes_upload: false,
    recipe_book: true,
    voting: false,
    profile: true,
    archive: false,
    recipes_list: false,
    mishloach_manot: false,
    professionals_guide: false,
    library_schedule: false,
    map_view: false,
    guests: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'appSettings'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.showInBottomNav) {
          setVisibleItems(prev => ({ ...prev, ...data.showInBottomNav }));
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  const allItems = [
    { key: 'home', to: '/', label: 'בית', icon: Home, alwaysShow: true },
    { key: 'events', to: '/events', label: 'אירועים', icon: Calendar },
    { key: 'equipment', to: '/equipment', label: 'ציוד', icon: Package },
    { key: 'professionals', to: '/professionals', label: 'מקצוע', icon: Wrench },
    { key: 'pub', to: '/pub', label: 'פאב', icon: Beer },
    { key: 'library', to: '/library', label: 'ספרייה', icon: Book },
    { key: 'map', to: '/map', label: 'מפה', icon: Map },
    { key: 'announcements', to: '/announcements', label: 'מודעות', icon: Megaphone },
    { key: 'benefits', to: '/benefits', label: 'הטבות', icon: Gift },
    { key: 'recipes_upload', to: '/recipes/upload', label: 'העלאת מתכון', icon: Utensils },
    { key: 'recipes_list', to: '/recipes/list', label: 'רשימת מתכונים', icon: Utensils },
    { key: 'recipe_book', to: '/recipes/book', label: 'מתכונים', icon: Book },
    { key: 'archive', to: '/archive', label: 'ארכיון', icon: Archive },
    { key: 'professionals_guide', to: '/professionals-guide', label: 'מדריך בע"מ', icon: Wrench },
    { key: 'library_schedule', to: '/library-schedule', label: 'משמרות', icon: Calendar },
    { key: 'mishloach_manot', to: '/mishloach-manot/register', label: 'משלוח מנות', icon: Package },
    { key: 'map_view', to: '/map-view', label: 'מפה מלאה', icon: Map },
    { key: 'guests', to: '/guests', label: 'אורחים', icon: Info },
    { key: 'voting', to: 'http://neveur.co.il/', label: 'הצבעות', icon: ListTodo, external: true },
    { key: 'profile', to: '/profile', label: 'אני', icon: User },
  ];

  const itemsToShow = allItems.filter(item => item.alwaysShow || visibleItems[item.key]);

  if (itemsToShow.length === 0) return null;

  const glassStyle = isDark
    ? 'bg-slate-900/60 border-slate-700/80 text-slate-300 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]'
    : 'bg-white/60 border-white/80 text-slate-500 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]';

  const activeStyle = isDark
    ? 'text-amber-500 bg-slate-800/80'
    : 'text-emerald-600 bg-white/90 shadow-sm scale-110 -translate-y-2';

  const hoverStyle = isDark
    ? 'hover:text-amber-400 hover:bg-slate-800/50 active:scale-95'
    : 'hover:text-emerald-500 hover:bg-white/50 hover:-translate-y-1 active:scale-95';

  return (
    <div className="flex justify-center pb-6 px-4 w-full">
      <nav className={`flex items-center justify-center gap-1 sm:gap-2 p-2 rounded-[32px] backdrop-blur-[20px] border transition-all duration-300 ${glassStyle} max-w-full overflow-x-auto hide-scrollbar`}>
        {itemsToShow.map(item => {
          const Icon = item.icon;
          
          if (item.external) {
            return (
              <a
                key={item.key}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 group ${hoverStyle}`}
              >
                <Icon size={24} strokeWidth={2.5} className="transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-bold mt-1 opacity-0 group-hover:opacity-100 absolute -bottom-6 bg-slate-800 text-white px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {item.label}
                </span>
              </a>
            );
          }
          
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-12 sm:w-14 h-12 sm:h-14 rounded-2xl transition-all duration-300 group ${isActive ? activeStyle : hoverStyle}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 3 : 2.5} className="transition-transform group-hover:scale-110" />
                  
                  {/* Tooltip for desktop hover */}
                  <span className="hidden sm:block text-[11px] font-bold mt-1 opacity-0 group-hover:opacity-100 absolute -top-10 bg-slate-800 text-white px-3 py-1.5 rounded-xl pointer-events-none whitespace-nowrap z-50 transition-all translate-y-2 group-hover:translate-y-0 shadow-xl">
                    {item.label}
                  </span>
                  
                  {/* Mobile label shown on active only or just rely on icons */}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current absolute bottom-1 sm:hidden"></span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default BottomNav;