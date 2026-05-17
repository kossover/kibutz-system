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
  MessageCircle,
  Phone,
  Search,
  PlusCircle,
  Briefcase,
  Info,
  Smartphone,
  X,
  Share
} from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-emerald-600 font-bold text-xl animate-pulse">טוען בעלי מקצוע...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-12 pb-32">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tight">מדריך בעלי מקצוע</h1>
        <div className="flex gap-4 items-center">
          <button 
            onClick={handleInstallClick}
            className="glass-pill flex items-center gap-2 text-emerald-600 border-emerald-200"
          >
            <Smartphone size={20} strokeWidth={2.5} />
            <span className="font-bold hidden md:inline">שמור במסך הבית</span>
          </button>
          <BackButton pageKey="professionals" />
        </div>
      </div>

      {/* הודעה למשתמשים לא מחוברים */}
      {!currentUser && (
        <div className="glass-card bg-amber-50/50 border-amber-200 p-4 mb-8 flex items-start sm:items-center gap-4">
          <Info size={28} className="text-amber-500 shrink-0" strokeWidth={2.5} />
          <div className="text-slate-700 font-medium">
            <strong className="text-amber-700">צפייה במדריך פתוחה לכולם.</strong> להצעת בעל מקצוע יש להתחבר.{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-amber-600 font-black underline hover:text-amber-800 transition-colors"
            >
              התחבר כאן
            </button>
          </div>
        </div>
      )}

      {/* חיפוש */}
      <div className="relative mb-6">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={24} strokeWidth={2.5} />
        </div>
        <input
          type="text"
          className="w-full bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-3xl pr-14 pl-6 py-4 text-lg font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white shadow-sm transition-all"
          placeholder="חפש לפי שם, מקצוע או חברה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* סינון קטגוריות באייקונים */}
      {categories.length > 0 && (
        <div className="flex gap-3 mb-8 overflow-x-auto pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          <button
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all ${
              !selectedCategory 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                : 'bg-white/50 text-slate-600 border border-slate-200/50 hover:bg-white hover:shadow-sm'
            }`}
            onClick={() => setSelectedCategory('')}
            type="button"
          >
            <Briefcase size={18} strokeWidth={2.5} />
            הכל
            <span className="text-xs opacity-70 bg-black/10 px-2 py-0.5 rounded-full">{professionals.length}</span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.name 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                  : 'bg-white/50 text-slate-600 border border-slate-200/50 hover:bg-white hover:shadow-sm'
              }`}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)}
              type="button"
            >
              <span className="text-lg">{cat.icon}</span>
              {cat.name}
              <span className="text-xs opacity-70 bg-black/10 px-2 py-0.5 rounded-full">
                {countsByCategory[cat.name] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* כפתור הצעת בעל מקצוע */}
      <div className="flex justify-end mb-8">
        <button
          className="glass-pill flex items-center gap-2 font-bold text-emerald-600 hover:bg-emerald-50/50 border-emerald-200"
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
          <PlusCircle size={20} strokeWidth={2.5} />
          <span>{showSuggest ? 'סגור טופס' : 'הצע בעל מקצוע'}</span>
        </button>
      </div>

      {/* טופס הצעת בעל מקצוע */}
      {showSuggest && currentUser && (
        <div className="glass-card p-6 md:p-8 mb-10 border-l-4 border-l-emerald-400">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-6 flex items-center gap-3">
            <PlusCircle size={28} className="text-emerald-500" />
            הצע בעל מקצוע
          </h3>
          <form onSubmit={submitSuggestion}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">שם מלא *</label>
                <input
                  type="text"
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={suggestForm.name}
                  onChange={(e) => setSuggestForm({ ...suggestForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">שם חברה (אופציונלי)</label>
                <input
                  type="text"
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={suggestForm.company}
                  onChange={(e) => setSuggestForm({ ...suggestForm, company: e.target.value })}
                  placeholder="לדוגמא: חשמל ישראל"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">מקצוע *</label>
                <input
                  type="text"
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={suggestForm.profession}
                  onChange={(e) => setSuggestForm({ ...suggestForm, profession: e.target.value })}
                  placeholder="לדוגמא: חשמלאי מוסמך"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">קטגוריה *</label>
                <select
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-800"
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
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1">טלפון *</label>
                <input
                  type="tel"
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={suggestForm.phone}
                  onChange={(e) => setSuggestForm({ ...suggestForm, phone: e.target.value })}
                  onBlur={(e) =>
                    setSuggestForm({ ...suggestForm, phone: cleanPhoneNumber(e.target.value) })
                  }
                  placeholder="050-1234567"
                  required
                />
                <div className="text-xs text-slate-400 mt-2 font-medium">
                  כל פורמט יתוקן אוטומטית (050-XXX-XXXX, +972, 972, וכו')
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1">תיאור שירותים (אופציונלי)</label>
                <textarea
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-[100px]"
                  value={suggestForm.description}
                  onChange={(e) => setSuggestForm({ ...suggestForm, description: e.target.value })}
                  placeholder="תיאור קצר של השירותים..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1">מומלץ על ידי (אופציונלי)</label>
                <input
                  type="text"
                  className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={suggestForm.recommendedBy}
                  onChange={(e) => setSuggestForm({ ...suggestForm, recommendedBy: e.target.value })}
                  placeholder="שם הממליץ"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8 justify-end">
              <button
                type="button"
                className="px-6 py-3 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                onClick={() => { resetSuggestForm(); setShowSuggest(false); }}
              >
                ביטול
              </button>
              <button 
                type="submit" 
                className="px-8 py-3 rounded-2xl font-black bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
                disabled={suggestUploading}
              >
                {suggestUploading ? 'שולח...' : 'שלח הצעה'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* תצוגה לפי קטגוריות */}
      {professionalsByCategory.map((cat) =>
        cat.professionals.length > 0 ? (
          <div key={cat.id} className="mb-12">
            {(!selectedCategory || searchTerm) && (
              <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-6">
                <span className="text-3xl bg-white p-2 rounded-2xl shadow-sm border border-slate-100">{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="text-slate-400 text-lg">({cat.professionals.length})</span>
              </h2>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cat.professionals.map((prof) => (
                <div key={prof.id} className="glass-card flex flex-col p-6 hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex-1 flex flex-col mb-6">
                    <h3 className="text-xl font-black text-slate-800 mb-1">{prof.name}</h3>
                    {prof.company && prof.company.trim() !== prof.name.trim() && (
                      <div className="inline-block bg-slate-100 text-slate-600 text-sm font-bold px-3 py-1 rounded-full w-fit mb-3">
                        {prof.company}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-emerald-600 font-bold mb-3">
                      <Briefcase size={18} strokeWidth={2.5} /> 
                      {prof.profession}
                    </div>
                    {prof.description && (
                      <p className="text-slate-600 font-medium text-sm leading-relaxed mb-4 flex-1">
                        {prof.description}
                      </p>
                    )}
                    {prof.recommendedBy && (
                      <div className="mt-auto pt-4 flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-xl text-sm font-bold border border-amber-100">
                        מומלץ על ידי: {prof.recommendedBy}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200/50 mt-auto">
                    <button
                      onClick={() => handleWhatsApp(prof.phone)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] hover:bg-[#059669] hover:text-white transition-colors"
                      type="button"
                    >
                      <MessageCircle size={20} strokeWidth={2.5} />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleCall(prof.phone)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors"
                      type="button"
                    >
                      <Phone size={20} strokeWidth={2.5} />
                      התקשר
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* מצב ללא תוצאות */}
      {filteredProfessionals.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center p-16 text-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6">
            <Briefcase size={64} className="text-slate-400" strokeWidth={1.5} />
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {searchTerm || selectedCategory
              ? 'לא נמצאו תוצאות'
              : 'אין בעלי מקצוע רשומים עדיין'}
          </div>
          <p className="text-slate-500 font-medium mt-2">נסו לשנות את מילות החיפוש או הקטגוריה.</p>
        </div>
      )}

      {/* מודל הדרכה לשמירה במסך הבית (iOS/דפדפנים שלא תומכים בהתקנה אוטומטית) */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full relative p-8">
            <button 
              onClick={() => setShowInstallGuide(false)} 
              className="absolute top-4 left-4 p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
              <Smartphone size={28} className="text-emerald-500" strokeWidth={2.5} />
              הוספה למסך הבית
            </h3>
            
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl mb-4 text-slate-700 font-medium">
              <p className="font-bold text-slate-800 mb-3">במכשירי אייפון (Safari):</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>לחץ על כפתור השיתוף <Share size={16} className="inline mx-1" strokeWidth={2.5} /> בתחתית המסך.</li>
                <li>בחר ב-"<strong>הוסף למסך הבית</strong>" (Add to Home Screen) מתוך התפריט.</li>
              </ol>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl mb-6 text-slate-700 font-medium">
              <p className="font-bold text-slate-800 mb-3">במכשירי אנדרואיד (Chrome):</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>לחץ על התפריט (שלוש נקודות) בפינה למעלה.</li>
                <li>בחר ב-"<strong>הוסף למסך הבית</strong>" (Add to Home Screen).</li>
              </ol>
            </div>
            
            <button 
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/30 transition-all" 
              onClick={() => setShowInstallGuide(false)}
            >
              הבנתי, תודה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Professionals;