import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { House, CalendarBlank, BeerBottle, Wrench, UserCircle, Package, Books, MapTrifold, Megaphone, CookingPot, ListChecks, Archive, Gift } from '@phosphor-icons/react';

function BottomNav() {
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
    archive: false
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

  if (loading) return null; // Don't show until we know what to show? Or show default? Better null or empty container to avoid flash.

  // Define all possible nav items
  const allItems = [
    { key: 'home', to: '/', label: 'בית', icon: House, alwaysShow: true }, // Home is usually always shown or we can make it configurable too? Let's keep it always active for now.
    { key: 'events', to: '/events', label: 'אירועים', icon: CalendarBlank },
    { key: 'equipment', to: '/equipment', label: 'ציוד', icon: Package },
    { key: 'professionals', to: '/professionals', label: 'מקצוע', icon: Wrench },
    { key: 'pub', to: '/pub', label: 'פאב', icon: BeerBottle },
    { key: 'library', to: '/library', label: 'ספרייה', icon: Books },
    { key: 'map', to: '/map', label: 'מפה', icon: MapTrifold },
    { key: 'announcements', to: '/announcements', label: 'מודעות', icon: Megaphone },
    { key: 'benefits', to: '/benefits', label: 'הטבות', icon: Gift },
    { key: 'announcements', to: '/announcements', label: 'מודעות', icon: Megaphone },
    { key: 'recipes_upload', to: '/recipes/upload', label: 'העלאת מתכון', icon: CookingPot },
    { key: 'recipe_book', to: '/recipes/book', label: 'מתכונים', icon: Books },
    { key: 'archive', to: '/archive', label: 'ארכיון', icon: Archive },
    { key: 'voting', to: 'http://neveur.co.il/', label: 'הצבעות', icon: ListChecks, external: true },
    { key: 'profile', to: '/profile', label: 'אני', icon: UserCircle },
  ];

  const itemsToShow = allItems.filter(item => item.alwaysShow || visibleItems[item.key]);

  if (itemsToShow.length === 0) return null;

  return (
    <>
      <style>{`
        .bottom-nav-container {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 95%;
          max-width: 500px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border-radius: 24px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 12px 4px; /* Reduced padding */
          z-index: 1000;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--text-secondary);
          padding: 8px 4px;
          border-radius: 16px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          width: ${100 / Math.min(itemsToShow.length, 6)}%; /* distribute space */
          flex: 1;
          min-width: 0; /* allows shrinking */
          min-width: 48px;
          position: relative;
        }

        .nav-item:hover {
          color: var(--primary-color);
          background: rgba(0, 0, 0, 0.03);
        }

        .nav-item.active {
          color: var(--accent-color);
          background: #eff6ff; /* blue-50 */
          transform: translateY(-4px);
        }

        .nav-item.active .icon {
          weight: fill;
        }

        .nav-label {
          font-size: 10px; /* Smaller font for better fit */
          font-weight: 600;
          margin-top: 4px;
          white-space: nowrap;
        }
        
        /* נקודה קטנה לסימון פעיל מתחת לאייקון */
        .nav-item.active::after {
          content: '';
          position: absolute;
          bottom: 4px;
          width: 4px;
          height: 4px;
          background-color: var(--accent-color);
          border-radius: 50%;
        }

        @media (min-width: 768px) {
           .bottom-nav-container {
             bottom: 30px;
             padding: 12px 8px;
           }
           .nav-item {
             width: 60px;
           }
           .nav-label {
             font-size: 11px;
           }
        }
      `}</style>

      <nav className="bottom-nav-container">
        {itemsToShow.map(item => {
          const Icon = item.icon;
          if (item.external) {
            return (
              <a
                key={item.key}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                className="nav-item"
              >
                <Icon size={24} weight="duotone" className="icon" />
                <span className="nav-label">{item.label}</span>
              </a>
            )
          }
          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
            >
              <Icon size={24} weight="duotone" className="icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

export default BottomNav;