// src/pages/admin/ManageMap.jsx - עדכון מלא עם אייקונים לקטגוריות

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import EmojiPicker from 'emoji-picker-react';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  FolderPlus,
  Move,
  Smile,
  Maximize,
  Minimize,
  Copy,
  ExternalLink
} from 'lucide-react';

// תיקון בעיית אייקונים של Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// אייקון עם אימוג'י
const getEmojiIcon = (emoji, isDraggable = false) => {
  const isNumber = !isNaN(emoji) && String(emoji).trim() !== '';

  if (isNumber) {
    return L.divIcon({
      className: 'custom-icon',
      html: `<div style="
        width: 22px;
        height: 22px;
        background: linear-gradient(135deg, #FF9D00, #FF6A00);
        border: 1.5px solid white;
        border-radius: 50%;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 900;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ${isDraggable ? 'cursor: move;' : ''}
      ">${emoji}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12], // Center anchor for precise placement
      popupAnchor: [0, -12]
    });
  }

  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="
      font-size: ${isDraggable ? '32px' : '28px'};
      text-align: center;
      line-height: 1;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
      ${isDraggable ? 'cursor: move;' : ''}
    ">${emoji || '📍'}</div>`,
    iconSize: [isDraggable ? 40 : 36, isDraggable ? 40 : 36],
    iconAnchor: [isDraggable ? 20 : 18, isDraggable ? 40 : 36], // Bottom-center anchor for emojis
    popupAnchor: [0, isDraggable ? -40 : -36]
  });
};

// קומפוננטה להוספת נקודה על המפה
function AddPointOnMap({ onLocationSelect, isActive }) {
  useMapEvents({
    click(e) {
      if (isActive) {
        onLocationSelect(e.latlng);
      }
    },
  });
  return null;
}

// Marker ניתן לגרירה
function DraggableMarker({ point, categoryEmoji, onDragEnd, onEdit, onDelete }) {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        onDragEnd(point.id, newPos);
      }
    },
  };

  return (
    <Marker
      position={[point.lat, point.lng]}
      draggable={true}
      eventHandlers={eventHandlers}
      ref={markerRef}
      icon={getEmojiIcon(categoryEmoji, true)}
    >
      <Popup>
        <div style={{ direction: 'rtl', minWidth: '200px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            {point.name}
          </h3>
          {point.category && (
            <div style={{
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              fontSize: '12px',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              {categoryEmoji} {point.category}
            </div>
          )}
          {point.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '12px' }}>
              {point.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={() => onEdit(point)}
              style={{
                flex: 1,
                padding: '8px',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Edit2 size={14} />
              ערוך
            </button>
            <button
              onClick={() => onDelete(point.id)}
              style={{
                flex: 1,
                padding: '8px',
                background: 'var(--danger-color)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Trash2 size={14} />
              מחק
            </button>
          </div>
          <div style={{
            marginTop: '8px',
            padding: '6px',
            background: '#FEF3C7',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center'
          }}>
            💡 גרור את הסמן להזזת המיקום
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function ManageMap() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('points');

  const [points, setPoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showPointModal, setShowPointModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [pointForm, setPointForm] = useState({
    name: '',
    description: '',
    category: '',
    lat: 32.588925,
    lng: 35.553405
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    emoji: '📍'
  });

  const kibbutzCenter = [32.588925, 35.553405];

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadPoints();
      loadCategories();
    }
  }, [userProfile]);

  useEffect(() => {
    const initDiningHall = async () => {
      if (userProfile?.role === 'admin' && points.length === 0) {
        try {
          const snapshot = await getDocs(collection(db, 'mapPoints'));
          if (snapshot.empty) {
            await addDoc(collection(db, 'mapPoints'), {
              name: 'חדר האוכל',
              description: 'מרכז הקיבוץ - חדר האוכל המרכזי',
              category: 'מבנים',
              lat: 32.588925,
              lng: 35.553405,
              createdAt: serverTimestamp()
            });
            loadPoints();
          }
        } catch (error) {
          console.error('Error creating dining hall:', error);
        }
      }
    };
    initDiningHall();
  }, [userProfile, points.length]);

  const checkAdminAccess = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        navigate('/');
        return;
      }

      const userData = userDoc.data();
      if (userData.role !== 'admin') {
        navigate('/');
        return;
      }

      setUserProfile(userData);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadPoints = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mapPoints'));
      const pointsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPoints(pointsData);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mapCategories'));
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCategoryEmoji = (categoryName) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category?.emoji || '📍';
  };

  const handleMapClick = (latlng) => {
    setPointForm({
      name: '',
      description: '',
      category: '',
      lat: latlng.lat,
      lng: latlng.lng
    });
    setEditingPoint(null);
    setIsAddingPoint(false);
    setShowPointModal(true);
  };

  const handleMarkerDragEnd = async (pointId, newPos) => {
    try {
      await updateDoc(doc(db, 'mapPoints', pointId), {
        lat: newPos.lat,
        lng: newPos.lng,
        updatedAt: serverTimestamp()
      });
      loadPoints();
    } catch (error) {
      console.error('Error updating position:', error);
      alert('שגיאה בעדכון המיקום');
    }
  };

  const handleSavePoint = async (e) => {
    e.preventDefault();

    try {
      const pointData = {
        name: pointForm.name,
        description: pointForm.description,
        category: pointForm.category,
        lat: parseFloat(pointForm.lat),
        lng: parseFloat(pointForm.lng),
        updatedAt: serverTimestamp()
      };

      if (editingPoint) {
        await updateDoc(doc(db, 'mapPoints', editingPoint.id), pointData);
      } else {
        await addDoc(collection(db, 'mapPoints'), {
          ...pointData,
          createdAt: serverTimestamp()
        });
      }

      setShowPointModal(false);
      setEditingPoint(null);
      setPointForm({ name: '', description: '', category: '', lat: kibbutzCenter[0], lng: kibbutzCenter[1] });
      loadPoints();
    } catch (error) {
      console.error('Error saving point:', error);
      alert('שגיאה בשמירת הנקודה');
    }
  };

  const handleDeletePoint = async (pointId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הנקודה?')) return;

    try {
      await deleteDoc(doc(db, 'mapPoints', pointId));
      loadPoints();
    } catch (error) {
      console.error('Error deleting point:', error);
      alert('שגיאה במחיקת הנקודה');
    }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'mapCategories', editingCategory.id), categoryForm);
      } else {
        await addDoc(collection(db, 'mapCategories'), {
          ...categoryForm,
          createdAt: serverTimestamp()
        });
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', emoji: '📍' });
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('שגיאה בשמירת הקטגוריה');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הקטגוריה?')) return;

    try {
      await deleteDoc(doc(db, 'mapCategories', categoryId));
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('שגיאה במחיקת הקטגוריה');
    }
  };

  const openEditPoint = (point) => {
    setEditingPoint(point);
    setPointForm({
      name: point.name,
      description: point.description || '',
      category: point.category || '',
      lat: point.lat,
      lng: point.lng
    });
    setShowPointModal(true);
  };

  const openEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      emoji: category.emoji || '📍'
    });
    setShowCategoryModal(true);
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <style>{`
        .leaflet-container {
          height: 100%;
          width: 100%;
          z-index: 0;
        }
        .custom-icon {
          background: none;
          border: none;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>ניהול מפת הקיבוץ</h2>
        <button
          onClick={() => navigate('/admin')}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ← חזרה
        </button>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ExternalLink size={20} color="#3B82F6" />
              קישור ציבורי למפה
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              קישור ישיר לצפייה במפה ללא צורך בהתחברות. מתאים לשליחה לאורחים או לפרסום חיצוני.
            </div>
          </div>
          <button
            onClick={() => window.open('/map-view', '_blank')}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            תצוגה מקדימה
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          background: 'var(--bg-secondary)',
          padding: '8px',
          borderRadius: '8px',
          alignItems: 'center',
          border: '1px solid var(--border-color)'
        }}>
          <input
            readOnly
            value={window.location.origin + '/map-view'}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              direction: 'ltr'
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + '/map-view');
              alert('הקישור הועתק ללוח!');
            }}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Copy size={16} />
            העתק קישור
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 pb-2 border-b border-slate-200 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveTab('points')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all flex-shrink-0 ${
            activeTab === 'points' 
              ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin size={20} strokeWidth={activeTab === 'points' ? 2.5 : 2} />
          נקודות עניין ({points.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all flex-shrink-0 ${
            activeTab === 'categories' 
              ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderPlus size={20} strokeWidth={activeTab === 'categories' ? 2.5 : 2} />
          קטגוריות ({categories.length})
        </button>
      </div>

      {activeTab === 'points' && (
        <>
          <div style={{
            background: isAddingPoint ? '#FEF3C7' : 'white',
            border: isAddingPoint ? '2px solid #F59E0B' : '2px solid var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Move size={20} color={isAddingPoint ? '#F59E0B' : 'var(--text-secondary)'} />
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {isAddingPoint ? 'לחץ על המפה להוספת נקודה' : 'הוסף נקודת עניין'}
                </span>
              </div>
              <button
                onClick={() => setIsAddingPoint(!isAddingPoint)}
                style={{
                  padding: '10px 20px',
                  background: isAddingPoint ? 'var(--danger-color)' : 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isAddingPoint ? <X size={18} /> : <Plus size={18} />}
                {isAddingPoint ? 'ביטול' : 'הוסף נקודה'}
              </button>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {isAddingPoint
                ? '💡 לחץ על המפה במיקום הרצוי כדי להוסיף נקודת עניין חדשה'
                : '💡 לחיצה על "הוסף נקודה" תאפשר לך ללחוץ על המפה ולהוסיף נקודה במיקום המדויק'}
            </div>
          </div>

          <div style={{
            height: isFullscreen ? '100vh' : '600px',
            width: isFullscreen ? '100vw' : '100%',
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? 0 : 'auto',
            left: isFullscreen ? 0 : 'auto',
            zIndex: isFullscreen ? 9999 : 10,
            borderRadius: isFullscreen ? 0 : '8px',
            overflow: 'hidden',
            border: isFullscreen ? 'none' : '2px solid var(--border-color)',
            marginBottom: isFullscreen ? 0 : '24px',
            background: 'white'
          }}>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10000,
                background: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
              title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <MapContainer
              center={kibbutzCenter}
              zoom={17}
              style={{ height: '100%', width: '100%' }}
            >
              <LayersControl position="topleft">
                <LayersControl.BaseLayer checked name="מפת רחובות">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="תצלום לוויין">
                  <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <AddPointOnMap onLocationSelect={handleMapClick} isActive={isAddingPoint} />
              {points.map(point => (
                <DraggableMarker
                  key={point.id}
                  point={point}
                  categoryEmoji={getCategoryEmoji(point.category)}
                  onDragEnd={handleMarkerDragEnd}
                  onEdit={openEditPoint}
                  onDelete={handleDeletePoint}
                />
              ))}
            </MapContainer>
          </div>

          <div style={{ background: 'white', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              רשימת נקודות ({points.length})
            </h3>
            {points.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                אין נקודות עניין במפה
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {points.map(point => (
                  <div key={point.id} style={{
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{getCategoryEmoji(point.category)}</span>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{point.name}</div>
                        {point.category && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {point.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditPoint(point)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--primary-color)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => handleDeletePoint(point.id)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--danger-color)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '', description: '', emoji: '📍' });
              setShowCategoryModal(true);
            }}
            style={{
              padding: '12px 24px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FolderPlus size={20} />
            הוסף קטגוריה
          </button>

          {categories.length === 0 ? (
            <div style={{
              background: 'white',
              padding: '60px 20px',
              textAlign: 'center',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                אין קטגוריות
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {categories.map(category => {
                const pointsCount = points.filter(p => p.category === category.name).length;
                return (
                  <div key={category.id} style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '32px' }}>{category.emoji || '📍'}</span>
                          <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                            {category.name}
                          </h3>
                        </div>
                        {category.description && (
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                            {category.description}
                          </p>
                        )}
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {pointsCount} נקודות
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openEditCategory(category)}
                          style={{
                            padding: '6px',
                            background: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={16} color="white" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          style={{
                            padding: '6px',
                            background: pointsCount > 0 ? '#9CA3AF' : 'var(--danger-color)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: pointsCount > 0 ? 'not-allowed' : 'pointer'
                          }}
                          disabled={pointsCount > 0}
                          title={pointsCount > 0 ? 'לא ניתן למחוק קטגוריה עם נקודות' : 'מחק'}
                        >
                          <Trash2 size={16} color="white" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Point Modal */}
      {showPointModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                {editingPoint ? 'עריכת נקודה' : 'נקודה חדשה'}
              </h2>
              <button
                onClick={() => {
                  setShowPointModal(false);
                  setEditingPoint(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSavePoint}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  שם הנקודה *
                </label>
                <input
                  type="text"
                  value={pointForm.name}
                  onChange={(e) => setPointForm({ ...pointForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  קטגוריה
                </label>
                <select
                  value={pointForm.category}
                  onChange={(e) => setPointForm({ ...pointForm, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <option value="">ללא קטגוריה</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  תיאור
                </label>
                <textarea
                  value={pointForm.description}
                  onChange={(e) => setPointForm({ ...pointForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                padding: '12px',
                background: '#DBEAFE',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '20px'
              }}>
                📍 מיקום: {pointForm.lat.toFixed(6)}, {pointForm.lng.toFixed(6)}
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={20} />
                שמור
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                {editingCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setShowEmojiPicker(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  אייקון / אימוג'י *
                </label>
                <div style={{ position: 'relative' }}>
                  <div 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '32px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      minHeight: '60px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      userSelect: 'none'
                    }}
                  >
                    {categoryForm.emoji || '📍'}
                  </div>
                  {showEmojiPicker && (
                    <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '10px' }}>
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => {
                          setCategoryForm({ ...categoryForm, emoji: emojiData.emoji });
                          setShowEmojiPicker(false);
                        }}
                      />
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '8px',
                  textAlign: 'center'
                }}>
                  💡 לחץ על האימוג'י כדי לבחור סמל חדש מהרשימה
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  שם הקטגוריה *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  תיאור
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={20} />
                שמור
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageMap;