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
  Info
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
    <div className="page-container" style={{ direction: 'rtl' }}>
      {/* CSS רספונסיבי ממוקד-רכיב */}
      <style>{`
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
        .pro-grid { display: grid; gap: 12px; }
        .pro-card {
          padding: 14px; border-radius: 12px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.06);
        }

        /* פריט – שתי עמודות במובייל: מידע (ימין) + אייקונים (שמאל) */
        .pro-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }
        .pro-info { min-width: 0; }
        .pro-title { font-size: 18px; font-weight: 700; margin: 0 0 2px 0; }
        .pro-company { font-size: 14px; color: var(--text-secondary); margin: 0 0 2px 0; }
        .pro-profession { font-size: 16px; color: var(--primary-color); font-weight: 600; }
        .pro-desc { font-size: 14px; color: var(--text-secondary); margin: 8px 0 0; line-height: 1.45; }

        .pro-actions {
          display: flex; gap: 8px; align-items: center;
          justify-content: flex-start;
        }
        .pro-actions .btn {
          padding: 10px; min-width: 44px; min-height: 44px;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-label { display: inline; font-size: 14px; }
        .btn-icon { display: flex; align-items: center; justify-content: center; }

        .pro-reco { margin-top: 8px; padding: 6px 10px; background: var(--bg-secondary); border-radius: 8px; font-size: 12px; color: var(--text-secondary); }

        /* ===== ברידג' קטגוריות ===== */
        .cat-section { margin-bottom: 28px; }
        .cat-header {
          font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
        }
        .cat-count { color: var(--text-secondary); font-size: 13px; }

        /* ===== מובייל: שורה בודדת, אייקונים בלי טקסט ===== */
        @media (max-width: 640px) {
          .pro-grid { grid-template-columns: 1fr; }
          .pro-card { padding: 12px; border-radius: 10px; }
          .pro-title { font-size: 16px; }
          .pro-company { font-size: 12px; }
          .pro-profession { font-size: 14px; }
          .pro-desc { font-size: 12px; margin-top: 6px; }

          .btn-label { display: none; }
          .pro-actions { justify-content: flex-start; }
        }

        /* טאבלט ומעלה – אפשר שניים/שלושה בעמודה אם רוצים */
        @media (min-width: 641px) and (max-width: 1024px) {
          .pro-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (min-width: 1025px) {
          .pro-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        }
      `}</style>

      <h1 className="page-title">מדריך בעלי מקצוע</h1>
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
                      {prof.company && (
                        <div className="pro-company" title={prof.company}>{prof.company}</div>
                      )}
                      <div className="pro-profession" title={prof.profession}>{prof.profession}</div>
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
    </div>
  );
}

export default Professionals;