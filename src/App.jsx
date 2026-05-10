// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import AdminDashboard from './pages/admin/AdminDashboard';

// Pages
import Home from './pages/home';
import Login from './pages/Login';
import Events from './pages/Events';
import Pub from './pages/Pub';
import PubDirectBuy from './pages/PubDirectBuy';
import PubBartender from './pages/PubBartender';
import Library from './pages/Library';
import LibrarySchedule from './pages/LibrarySchedule';
import KibbutzMap from './pages/KibbutzMap';
import Professionals from './pages/Professionals';
import ProfessionalsGuide from './pages/ProfessionalsGuide';
import Announcements from './pages/Announcements';
import Profile from './pages/Profile';
import Equipment from './pages/Equipment';
import Archive from './pages/Archive';
import RecipeUpload from './pages/RecipeUpload';
import RecipesList from './pages/RecipesList';
import RecipeBook from './pages/RecipeBook';
import EventPage from './pages/EventPage';
import DynamicLandingPage from './pages/DynamicLandingPage';
import MapFullscreen from './pages/MapFullscreen';
import MishloachManotRegistration from './pages/MishloachManotRegistration';
import DocumentSign from './pages/DocumentSign';
import Benefits from './pages/Benefits';

// Components
import Layout from './components/Layout';

// Protected Route Component
function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div>טוען...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login - אם מחובר, העבר לבית */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" replace />}
        />

        {/* Layout עם BottomNav */}
        <Route path="/" element={<Layout />}>
          {/* עמוד בית - פתוח לכולם */}
          <Route index element={<Home />} />

          {/* עמודים פתוחים לכולם */}
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventPage />} />
          <Route path="professionals" element={<Professionals />} />
          <Route path="professionals-guide" element={<ProfessionalsGuide />} />
          <Route path="equipment" element={<Equipment />} />
          <Route path="archive" element={<Archive />} />
          <Route path="recipes/upload" element={<RecipeUpload />} />
          <Route path="recipes/list" element={<RecipesList />} />
          <Route path="benefits" element={<Benefits />} />

          {/* עמודים מוגנים - דורשים התחברות */}
          <Route
            path="library"
            element={
              <ProtectedRoute user={user}>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="map"
            element={
              <ProtectedRoute user={user}>
                <KibbutzMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="pub"
            element={
              <ProtectedRoute user={user}>
                <Pub />
              </ProtectedRoute>
            }
          />
          <Route
            path="announcements"
            element={
              <ProtectedRoute user={user}>
                <Announcements />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute user={user}>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Admin - מוגן */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ספר מתכונים - עמוד חיצוני יפה ונפרד */}
        <Route path="/recipes/book" element={<RecipeBook />} />

        {/* משלוחי מנות - עמוד חיצוני יפה ונפרד */}
        <Route path="/mishloach-manot/register" element={<MishloachManotRegistration />} />

        {/* פאב - עמודים חיצוניים (לקוח, ברמן) */}
        <Route path="/pub/order" element={<PubDirectBuy />} />
        <Route path="/pub/pool-order" element={<PubDirectBuy />} />
        <Route path="/pub/bartender/:token" element={<PubBartender />} />

        {/* דפי נחיתה אישיים */}
        <Route path="/p/:slug" element={<DynamicLandingPage />} />

        {/* חתימת מסמכים - עמוד חיצוני */}
        <Route path="/sign/:id" element={<DocumentSign />} />

        {/* מפה במסך מלא - פתוח לכולם */}
        <Route path="/map-view" element={<MapFullscreen />} />

        {/* שיבוץ משמרות ספרייה - פתוח לכולם עם הלינק */}
        <Route path="/library-schedule" element={<LibrarySchedule />} />

        {/* כל שאר הנתיבים - העבר לבית */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;