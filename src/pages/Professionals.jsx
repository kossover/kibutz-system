import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase/config';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  WhatsappLogo,
  PhoneCall,
  MagnifyingGlass,
  PlusCircle,
  Toolbox,
  Info,
  DeviceMobile,
  X,
  Export
} from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function Professionals() {
  const [professionals, setProfessionals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(''); // '' = הכל
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // טופס הצעת בעל מקצוע
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestUploading, setSuggestUploading] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    company: '',
    profession: '',
    category: '',
    phone: '',
    description: '',
    recommendedBy: '',
  });

  // בדיקה אם המשתמש מחובר
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // התקנת האפליקציה במסך הבית
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // אם אין PWA prompt טבעי (למשל באייפון), נציג מדריך دستی
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // קטגוריות
    const unsubscribeCategories = onSnapshot(
      collection(db, 'professionalCategories'),
      (snapshot) => {
        const categoriesData = [];
        snapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, ...doc.data() });
        });
        setCategories(
          categoriesData.sort((a, b) => (a.order || 0) - (b.order || 0))
        );
      }
    );

    // בעלי מקצוע
    const unsubscribe = onSnapshot(
      collection(db, 'professionals'),
      (snapshot) => {
        const profsData = [];
        snapshot.forEach((doc) => {
          profsData.push({ id: doc.id, ...doc.data() });
        });
        setProfessionals(
          profsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching professionals:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribe();
    };
  }, []);

  // ניקוי/איחוד טלפון להצעה
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[^\d+]/g, '');
    cleaned = cleaned.replace(/^\+/, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    if (!cleaned.startsWith('0') && cleaned.length === 9) cleaned = '0' + cleaned;
    if (cleaned.length === 10) {
      return cleaned.substring(0, 3) + '-' + cleaned.substring(3);
    }
    return cleaned;
  };

  // חיפוש + סינון קטגוריה
  const filteredProfessionals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return professionals.filter((prof) => {
      const matchesSearch =
        !term ||
        prof.name?.toLowerCase().includes(term) ||
        prof.profession?.toLowerCase().includes(term) ||
        prof.company?.toLowerCase().includes(term);

      const matchesCategory =
        !selectedCategory || prof.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [professionals, searchTerm, selectedCategory]);

  // קיבוץ בעלי מקצוע לפי קטגוריה (אחרי סינון)
  const professionalsByCategory = useMemo(() => {
    const cats = selectedCategory
      ? categories.filter((c) => c.name === selectedCategory)
      : categories;

    return cats.map((category) => ({
      ...category,
      professionals: filteredProfessionals.filter(
        (prof) => prof.category === category.name
      ),
    }));
  }, [categories, filteredProfessionals, selectedCategory]);

  // ספירת כמות לכל קטגוריה (לשבב הסינון)
  const countsByCategory = useMemo(() => {
    const counts = {};
    for (const p of professionals) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [professionals]);

  const handleCall = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('0')
      ? '972' + cleanPhone.substring(1)
      : cleanPhone;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const resetSuggestForm = () => {
    setSuggestForm({
      name: '',
      company: '',
      profession: '',
      category: '',
      phone: '',
      description: '',
      recommendedBy: '',
    });
  };

  const submitSuggestion = async (e) => {
    e.preventDefault();

    // בדיקה אם המשתמש מחובר
    if (!currentUser) {
      if (window.confirm('עליך להתחבר כדי להציע בעל מקצוע. לעבור למסך התחברות?')) {
        navigate('/login');
      }
      return;
    }

    if (suggestUploading) return;

    try {
      // ולידציה בסיסית
      const { name, profession, category, phone } = suggestForm;
      if (!name || !profession || !category || !phone) {
        alert('נא למלא שם מלא, מקצוע, קטגוריה וטלפון.');
        return;
      }

      setSuggestUploading(true);
      const payload = {
        ...suggestForm,
        phone: cleanPhoneNumber(suggestForm.phone),
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'professionalSuggestions'), payload);
      alert('תודה! ההצעה נשלחה וממתינה לאישור מנהל.');
      resetSuggestForm();
      setShowSuggest(false);
    } catch (err) {
      console.error(err);
      alert('שגיאה בשליחת ההצעה: ' + err.message);
    } finally {
      setSuggestUploading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="page-container">
        <div className="loading">טוען בעלי מקצוע...</div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ direction: 'rtl', fontFamily: '"Noto Sans Hebrew", sans-serif' }}>
      {/* CSS רספונסיבי ממוקד-רכיב */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@300;400;500;600;700;800&display=swap');
        
        .page-title {
            font-family: 'Noto Sans Hebrew', sans-serif;
            font-weight: 800;
        }
        .pro-search { position: relative; margin-bottom: 12px; }
        .pro-search .icon {
          position: absolute; right: 16px; top: 50%;
          transform: translateY(-50%); pointer-events: none;
        }

        .cat-filter {
          display: flex; gap: 10px; margin: 12px 0 12px;
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: thin; padding-bottom: 4px;
        }
        .cat-chip {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid var(--border-color); background: white; color: var(--text-primary);
          padding: 10px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
          transition: all .15s ease; font-size: 14px; line-height: 1;
        }
        .cat-chip.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
        .cat-chip .emj { font-size: 18px; line-height: 1; }

        .suggest-wrap { display: flex; justify-content: flex-end; margin: 8px 0 20px; }
        .suggest-btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }

        .login-notice {
          background: #E7F8EE;
          border: 1px solid #25D366;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }

        /* ===== פריסת כרטיס/שורה ===== */
        .pro-grid { display: grid; gap: 24px; }
        .pro-card {
          padding: 24px;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(226, 232, 240, 0.8);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .pro-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
        }
        .pro-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--primary-color), #818cf8);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .pro-card:hover::before {
          opacity: 1;
        }

        /* פריט */
        .pro-item {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }
        .pro-info { flex: 1; }
        .pro-title { font-size: 20px; font-weight: 800; margin: 0 0 6px 0; color: #1e293b; letter-spacing: -0.02em; }
        .pro-company { font-size: 13px; color: #475569; margin: 0 0 12px 0; font-weight: 600; background: #f1f5f9; display: inline-block; padding: 4px 12px; border-radius: 999px; }
        .pro-profession { font-size: 15px; color: var(--primary-color); font-weight: 700; display: flex; align-items: center; gap: 6px; }
        .pro-desc { font-size: 14px; color: #475569; margin: 12px 0 0; line-height: 1.6; }

        .pro-actions {
          display: flex; gap: 12px; align-items: center;
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
        }
        .pro-actions .btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .pro-actions .btn-success {
          background: #ecfdf5 !important;
          color: #059669 !important;
          border: 1px solid #a7f3d0 !important;
        }
        .pro-actions .btn-success:hover {
          background: #059669 !important;
          color: white !important;
          border-color: #059669 !important;
        }
        .pro-actions .btn-primary {
          background: #eff6ff !important;
          color: #2563eb !important;
          border: 1px solid #bfdbfe !important;
        }
        .pro-actions .btn-primary:hover {
          background: #2563eb !important;
          color: white !important;
          border-color: #2563eb !important;
        }
        .btn-label { display: inline; font-size: 14px; }
        .btn-icon { display: flex; align-items: center; justify-content: center; }

        .pro-reco { margin-top: 16px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 13px; color: #92400e; font-weight: 600; display: flex; align-items: center; gap: 6px; }

        /* ===== ברידג' קטגוריות ===== */
        .cat-section { margin-bottom: 32px; }
        .cat-header {
          font-size: 22px; font-weight: 800; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; color: #0f172a;
        }
        .cat-count { color: #64748b; font-size: 15px; font-weight: 600; }

        /* ===== מובייל ===== */
        @media (max-width: 640px) {
          .pro-grid { grid-template-columns: 1fr; gap: 16px; }
          .pro-card { padding: 20px; border-radius: 16px; }
          .pro-title { font-size: 18px; }
          .pro-actions .btn { padding: 10px; }
        }

        /* טאבלט ומעלה – אפשר שניים/שלושה בעמודה אם רוצים */
        @media (min-width: 641px) and (max-width: 1024px) {
          .pro-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (min-width: 1025px) {
          .pro-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>מדריך בעלי מקצוע</h1>
        <button 
          onClick={handleInstallClick}
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', borderRadius: '12px' }}
        >
          <DeviceMobile size={18} weight="duotone" />
          <span>שמור במסך הבית</span>
        </button>
      </div>

      <BackButton pageKey="professionals" />

      {/* הודעה למשתמשים לא מחוברים */}
      {!currentUser && (
        <div className="login-notice">
          <Info size={24} weight="fill" color="#25D366" />
          <div>
            <strong>צפייה במדריך פתוחה לכולם.</strong> להצעת בעל מקצוע יש להתחבר.{' '}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit'
              }}
            >
              התחבר כאן
            </button>
          </div>
        </div>
      )}

      {/* חיפוש */}
      <div className="pro-search">
        <span className="icon">
          <MagnifyingGlass size={20} weight="bold" color="var(--text-secondary)" />
        </span>
        <input
          type="text"
          className="form-input"
          placeholder="חפש לפי שם, מקצוע או חברה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingRight: '48px' }}
        />
      </div>

      {/* סינון קטגוריות באייקונים */}
      {categories.length > 0 && (
        <div className="cat-filter" aria-label="סינון לפי קטגוריה">
          <button
            className={`cat-chip ${selectedCategory ? '' : 'active'}`}
            onClick={() => setSelectedCategory('')}
            type="button"
            title="כל הקטגוריות"
          >
            <span className="emj">
              <Toolbox size={18} weight="duotone" />
            </span>
            הכל
            <span style={{ opacity: .7, fontSize: 12 }}>{professionals.length}</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`cat-chip ${selectedCategory === cat.name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)}
              type="button"
              title={cat.name}
            >
              <span className="emj">{cat.icon}</span>
              {cat.name}
              <span style={{ opacity: .7, fontSize: 12 }}>
                {countsByCategory[cat.name] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* כפתור הצעת בעל מקצוע */}
      <div className="suggest-wrap">
        <button
          className="btn btn-secondary suggest-btn"
          type="button"
          onClick={() => {
            if (!currentUser) {
              if (window.confirm('עליך להתחבר כדי להציע בעל מקצוע. לעבור למסך התחברות?')) {
                navigate('/login');
              }
              return;
            }
            setShowSuggest((s) => !s);
          }}
        >
          <PlusCircle size={20} weight="duotone" />
          <span>{showSuggest ? 'סגור טופס' : 'הצע בעל מקצוע'}</span>
        </button>
      </div>

      {/* טופס הצעת בעל מקצוע */}
      {showSuggest && currentUser && (
        <div className="pro-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>הצע בעל מקצוע</h3>
          <form onSubmit={submitSuggestion}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">שם מלא *</label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestForm.name}
                  onChange={(e) => setSuggestForm({ ...suggestForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">שם חברה (אופציונלי)</label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestForm.company}
                  onChange={(e) => setSuggestForm({ ...suggestForm, company: e.target.value })}
                  placeholder="לדוגמא: חשמל ישראל"
                />
              </div>
              <div className="form-group">
                <label className="form-label">מקצוע *</label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestForm.profession}
                  onChange={(e) => setSuggestForm({ ...suggestForm, profession: e.target.value })}
                  placeholder="לדוגמא: חשמלאי מוסמך"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">קטגוריה *</label>
                <select
                  className="form-input"
                  value={suggestForm.category}
                  onChange={(e) => setSuggestForm({ ...suggestForm, category: e.target.value })}
                  required
                >
                  <option value="">בחר קטגוריה...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">טלפון *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={suggestForm.phone}
                  onChange={(e) => setSuggestForm({ ...suggestForm, phone: e.target.value })}
                  onBlur={(e) =>
                    setSuggestForm({ ...suggestForm, phone: cleanPhoneNumber(e.target.value) })
                  }
                  placeholder="050-1234567"
                  required
                />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  כל פורמט יתוקן אוטומטית (050-XXX-XXXX, +972, 972, וכו')
                </div>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">תיאור שירותים (אופציונלי)</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={suggestForm.description}
                  onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                  placeholder="תיאור קצר של השירותים..."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">מומלץ על ידי (אופציונלי)</label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestForm.recommendedBy}
                  onChange={(e) => setSuggestForm({ ...suggestForm, recommendedBy: e.target.value })}
                  placeholder="שם הממליץ"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { resetSuggestForm(); setShowSuggest(false); }}
              >
                ביטול
              </button>
              <button type="submit" className="btn btn-primary" disabled={suggestUploading}>
                {suggestUploading ? 'שולח...' : 'שלח הצעה'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* תצוגה לפי קטגוריות */}
      {professionalsByCategory.map((cat) =>
        cat.professionals.length > 0 ? (
          <div key={cat.id} className="cat-section">
            {(!selectedCategory || searchTerm) && (
              <h2 className="cat-header">
                <span style={{ fontSize: '22px' }}>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="cat-count">• {cat.professionals.length}</span>
              </h2>
            )}

            <div className="pro-grid">
              {cat.professionals.map((prof) => (
                <div key={prof.id} className="pro-card">
                  <div className="pro-item">
                    {/* מידע מימין */}
                    <div className="pro-info">
                      <h3 className="pro-title" title={prof.name}>{prof.name}</h3>
                      {prof.company && prof.company.trim() !== prof.name.trim() && (
                        <div className="pro-company" title={prof.company}>{prof.company}</div>
                      )}
                      <div className="pro-profession" title={prof.profession}>
                        <Toolbox size={18} weight="duotone" /> {prof.profession}
                      </div>
                      {prof.description && (
                        <p className="pro-desc">{prof.description}</p>
                      )}
                      {prof.recommendedBy && (
                        <div className="pro-reco">
                          מומלץ על ידי: {prof.recommendedBy}
                        </div>
                      )}
                    </div>

                    {/* אייקונים משמאל */}
                    <div className="pro-actions" aria-label="פעולות">
                      <button
                        onClick={() => handleWhatsApp(prof.phone)}
                        className="btn btn-success"
                        type="button"
                        title="שלח WhatsApp"
                        aria-label="שלח WhatsApp"
                      >
                        <span className="btn-icon">
                          <WhatsappLogo size={20} weight="fill" />
                        </span>
                        <span className="btn-label">WhatsApp</span>
                      </button>
                      <button
                        onClick={() => handleCall(prof.phone)}
                        className="btn btn-primary"
                        type="button"
                        title="התקשר"
                        aria-label="התקשר"
                      >
                        <span className="btn-icon">
                          <PhoneCall size={20} weight="bold" />
                        </span>
                        <span className="btn-label">התקשר</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* מצב ללא תוצאות */}
      {filteredProfessionals.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Toolbox size={48} weight="duotone" color="var(--text-secondary)" />
          </div>
          <div className="empty-state-text">
            {searchTerm || selectedCategory
              ? 'לא נמצאו תוצאות לסינון/חיפוש'
              : 'אין בעלי מקצוע רשומים עדיין'}
          </div>
        </div>
      )}

      {/* מודל הדרכה לשמירה במסך הבית (iOS/דפדפנים שלא תומכים בהתקנה אוטומטית) */}
      {showInstallGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowInstallGuide(false)} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <DeviceMobile size={24} weight="duotone" color="var(--primary-color)" />
              הוספה למסך הבית
            </h3>
            
            <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: '15px', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 12px' }}><strong>במכשירי אייפון (Safari):</strong></p>
              <ol style={{ margin: 0, paddingRight: 20 }}>
                <li style={{ marginBottom: 8 }}>לחץ על כפתור השיתוף <Export size={16} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> בתחתית המסך.</li>
                <li>בחר ב-"<strong>הוסף למסך הבית</strong>" (Add to Home Screen) מתוך התפריט.</li>
              </ol>
            </div>

            <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 12, fontSize: '15px', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 12px' }}><strong>במכשירי אנדרואיד (Chrome):</strong></p>
              <ol style={{ margin: 0, paddingRight: 20 }}>
                <li style={{ marginBottom: 8 }}>לחץ על התפריט (שלוש נקודות) בפינה למעלה.</li>
                <li>בחר ב-"<strong>הוסף למסך הבית</strong>" (Add to Home Screen).</li>
              </ol>
            </div>
            
            <button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={() => setShowInstallGuide(false)}>הבנתי, תודה</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Professionals;