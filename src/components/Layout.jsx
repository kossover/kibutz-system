import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

function Layout() {
  return (
    <div className="app-container">
      {/* אזור תוכן ראשי */}
      <main style={{ flex: 1, position: 'relative' }}>
        <Outlet />
      </main>

      {/* תפריט ניווט תחתון - מופיע תמיד */}
      <div className="bottom-nav-wrapper">
        <BottomNav />
      </div>
    </div>
  );
}

export default Layout;