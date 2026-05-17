import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useEffect } from 'react';

function Layout() {
  const location = useLocation();
  const isPubOrBartender = location.pathname.includes('/pub');

  // Toggle dark theme on body if we are in pub
  useEffect(() => {
    if (isPubOrBartender) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isPubOrBartender]);

  return (
    <div className="relative min-h-screen w-full font-heebo">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] bg-emerald-300/20 rounded-full mix-blend-multiply filter blur-[80px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] bg-amber-300/20 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] bg-blue-300/20 rounded-full mix-blend-multiply filter blur-[80px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content Area */}
      <main 
        key={location.pathname} 
        className="relative flex-1 w-full pb-48 animate-[fadeIn_0.3s_ease-out]"
      >
        <Outlet />
      </main>

      {/* Floating Dock */}
      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

export default Layout;