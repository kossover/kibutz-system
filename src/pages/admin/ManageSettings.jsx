import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ToggleLeft, ToggleRight, Home, LayoutGrid, Menu, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';

function ManageSettings() {
    // Default settings
    const defaultKeys = {
        events: true,
        professionals: true,
        library: true,
        map: true,
        pub: true,
        pub_orders: true,
        pool_orders: true,
        announcements: true,
        equipment: true,
        recipes_upload: true,
        recipe_book: true,
        voting: true,
        profile: true, // 'profile' is usually in bottom nav
        archive: true,
        benefits: true,
        recipes_list: true,
        mishloach_manot: true,
        professionals_guide: true,
        library_schedule: true,
        map_view: true
    };

    const [settings, setSettings] = useState({
        showBackButton: { ...defaultKeys },
        showInHome: { ...defaultKeys },
        showInBottomNav: { ...defaultKeys }
    });

    const [loading, setLoading] = useState(true);

    // API Keys state
    const [openAIApiKey, setOpenAIApiKey] = useState('');
    const [youtubeApiKey, setYoutubeApiKey] = useState('');
    const [youtubeClientId, setYoutubeClientId] = useState('');
    const [youtubeClientSecret, setYoutubeClientSecret] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [showYtApiKey, setShowYtApiKey] = useState(false);
    const [apiSaving, setApiSaving] = useState(false);
    const [apiSaved, setApiSaved] = useState(false);

    const pages = [
        { key: 'events', label: 'לוח אירועים' },
        { key: 'professionals', label: 'בעלי מקצוע' },
        { key: 'library', label: 'ספרייה' },
        { key: 'map', label: 'מפות' },
        { key: 'pub', label: 'פאב (מידע)' },
        { key: 'pub_orders', label: 'הזמנות לפאב' },
        { key: 'pool_orders', label: 'הזמנות לבריכה' },
        { key: 'announcements', label: 'מודעות' },
        { key: 'equipment', label: 'השאלת ציוד (לא בשימוש כרגע בדף הבית)' }, // Equipment not in Home yet? Need to check.
        { key: 'recipes_upload', label: 'העלאת מתכון' },
        { key: 'recipe_book', label: 'ספר המתכונים (צפייה)' },
        { key: 'archive', label: 'ארכיון קיבוצי' },
        { key: 'voting', label: 'הצבעות (קהילנט)' },
        { key: 'profile', label: 'אזור אישי (פרופיל)' },
        { key: 'benefits', label: 'זכויות והטבות' },
        { key: 'recipes_list', label: 'רשימת מתכונים' },
        { key: 'mishloach_manot', label: 'הרשמה למשלוחי מנות' },
        { key: 'professionals_guide', label: 'מדריך בעלי מקצוע' },
        { key: 'library_schedule', label: 'שיבוץ משמרות ספרייה' },
        { key: 'map_view', label: 'מפה (מסך מלא)' }
    ];

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const docRef = doc(db, 'config', 'appSettings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings({
                    showBackButton: { ...defaultKeys, ...(data.showBackButton || {}) },
                    showInHome: { ...defaultKeys, ...(data.showInHome || {}) },
                    showInBottomNav: { ...defaultKeys, ...(data.showInBottomNav || {}) },
                });

                if (data.apiKeys && data.apiKeys.openai) {
                    setOpenAIApiKey(data.apiKeys.openai);
                }
                if (data.apiKeys && data.apiKeys.youtube) {
                    setYoutubeApiKey(data.apiKeys.youtube);
                }
                if (data.apiKeys && data.apiKeys.youtubeClientId) {
                    setYoutubeClientId(data.apiKeys.youtubeClientId);
                }
                if (data.apiKeys && data.apiKeys.youtubeClientSecret) {
                    setYoutubeClientSecret(data.apiKeys.youtubeClientSecret);
                }
            }
        } catch (error) {
            console.error("Error loading settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSetting = async (type, key) => {
        // type: 'showBackButton' or 'showInHome' or 'showInBottomNav'
        const currentTypeSettings = settings[type];
        const newValue = !currentTypeSettings[key];

        const newTypeSettings = { ...currentTypeSettings, [key]: newValue };
        const newSettings = { ...settings, [type]: newTypeSettings };

        setSettings(newSettings);

        try {
            await setDoc(doc(db, 'config', 'appSettings'), {
                [type]: newTypeSettings
            }, { merge: true });
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("שגיאה בשמירה");
            // Revert on error
            loadSettings();
        }
    };

    const ToggleBtn = ({ checked, onClick }) => (
        <button
            onClick={onClick}
            className={`p-1 rounded-full transition-colors flex items-center justify-center ${checked ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}
        >
            {checked ? (
                <ToggleRight size={32} strokeWidth={2} />
            ) : (
                <ToggleLeft size={32} strokeWidth={2} />
            )}
        </button>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-12">
            <div className="text-emerald-600 font-bold text-xl animate-pulse">טוען הגדרות...</div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24">
            <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-6">הגדרות תצוגה וממשק</h2>

                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[600px] text-right">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-5 text-slate-500 font-bold text-sm">שם הדף</th>
                                    <th className="px-4 py-5 text-center w-32">
                                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                            <Home size={20} strokeWidth={2.5} />
                                            <span className="text-xs font-bold">כפתור חזרה</span>
                                        </div>
                                    </th>
                                    <th className="px-4 py-5 text-center w-32">
                                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                            <LayoutGrid size={20} strokeWidth={2.5} />
                                            <span className="text-xs font-bold">מוצג בבית</span>
                                        </div>
                                    </th>
                                    <th className="px-4 py-5 text-center w-32">
                                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                                            <Menu size={20} strokeWidth={2.5} />
                                            <span className="text-xs font-bold">תפריט צף</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pages.map((page, index) => (
                                    <tr key={page.key} className={`transition-colors ${index % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`}>
                                        <td className="px-6 py-4 text-slate-800 font-bold text-sm">
                                            {page.label}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center">
                                                <ToggleBtn
                                                    checked={settings.showBackButton[page.key]}
                                                    onClick={() => toggleSetting('showBackButton', page.key)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center">
                                                <ToggleBtn
                                                    checked={settings.showInHome[page.key]}
                                                    onClick={() => toggleSetting('showInHome', page.key)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex justify-center">
                                                <ToggleBtn
                                                    checked={settings.showInBottomNav[page.key]}
                                                    onClick={() => toggleSetting('showInBottomNav', page.key)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-4 text-sm font-medium text-slate-500">
                    * שינויים בהגדרות נשמרים אוטומטית ומשפיעים על כל המשתמשים.
                </div>
            </div>

            <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-6">הגדרות מתקדמות (AI ואינטגרציות)</h2>
                
                <div className="glass-card p-6 md:p-8 border-l-4 border-indigo-500 space-y-10">
                    {/* OpenAI */}
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                                <Key size={24} className="text-indigo-600" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">מפתח API של OpenAI</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    משמש לאוטומציות חכמות כגון כתיבת תיאור אוטומטי, הצעת קטגוריות והוספת תגיות.
                                </p>
                            </div>
                        </div>

                        <div className="max-w-2xl">
                            <label className="block text-sm font-bold text-slate-700 mb-2">מפתח סודי (Secret Key)</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                        placeholder="sk-..."
                                        value={openAIApiKey}
                                        onChange={(e) => {
                                            setOpenAIApiKey(e.target.value);
                                            setApiSaved(false);
                                        }}
                                        dir="ltr"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                                    >
                                        {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <button
                                    className="px-6 py-3 rounded-2xl font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30 whitespace-nowrap flex items-center justify-center min-w-[140px]"
                                    disabled={apiSaving}
                                    onClick={async () => {
                                        setApiSaving(true);
                                        try {
                                            await setDoc(doc(db, 'config', 'appSettings'), {
                                                apiKeys: {
                                                    openai: openAIApiKey,
                                                    youtube: youtubeApiKey,
                                                    youtubeClientId: youtubeClientId,
                                                    youtubeClientSecret: youtubeClientSecret
                                                }
                                            }, { merge: true });
                                            setApiSaved(true);
                                            setTimeout(() => setApiSaved(false), 3000);
                                        } catch (err) {
                                            console.error(err);
                                            alert('שגיאה בשמירת המפתח');
                                        } finally {
                                            setApiSaving(false);
                                        }
                                    }}
                                >
                                    {apiSaving ? 'שומר...' : (apiSaved ? <span className="flex items-center gap-2"><CheckCircle size={18} /> נשמר</span> : 'שמור מפתחות')}
                                </button>
                            </div>
                            <p className="text-xs font-medium text-slate-400 mt-3">
                                אזהרה: המפתח נשמר במסד הנתונים וחשוף למנהלים. אין לשתף אותו בחוץ. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-600 underline">להנפקת מפתח חדש</a>.
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-slate-200/60 w-full"></div>

                    {/* YouTube API Key */}
                    <div>
                        <div className="max-w-2xl">
                            <label className="block text-sm font-bold text-slate-700 mb-2">מפתח YouTube API (אופציונלי לארכיון)</label>
                            <div className="relative">
                                <input
                                    type={showYtApiKey ? "text" : "password"}
                                    className="w-full bg-white/50 border border-slate-200 rounded-2xl px-4 py-3 pl-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                    placeholder="..."
                                    value={youtubeApiKey}
                                    onChange={(e) => {
                                        setYoutubeApiKey(e.target.value);
                                        setApiSaved(false);
                                    }}
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowYtApiKey(!showYtApiKey)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                                >
                                    {showYtApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <p className="text-xs font-medium text-slate-400 mt-3">
                                מאפשר ל-AI לשאוב תיאורים מלאים, ערוץ מפרסם ותאריך ישירות מיוטיוב. ניתן להנפיק ב-Google Cloud Console.
                            </p>
                        </div>
                    </div>

                    {/* YouTube OAuth */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6">
                        <h4 className="text-lg font-black text-slate-800 mb-6">הרשאות העלאה לענן הארכיון (OAuth 2.0)</h4>

                        <div className="space-y-5 max-w-2xl">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Client ID (מזהה לקוח)</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                    placeholder="...apps.googleusercontent.com"
                                    value={youtubeClientId}
                                    onChange={(e) => {
                                        setYoutubeClientId(e.target.value);
                                        setApiSaved(false);
                                    }}
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Client Secret (סוד לקוח)</label>
                                <input
                                    type="password"
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                                    placeholder="GOCSPX-..."
                                    value={youtubeClientSecret}
                                    onChange={(e) => {
                                        setYoutubeClientSecret(e.target.value);
                                        setApiSaved(false);
                                    }}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <p className="text-xs font-medium text-slate-500 mt-5 leading-relaxed">
                            מפתחות אלו מתחברים לחשבון הגוגל הייעודי שנוצר לארכיון. בשילוב שלהם, המערכת שלנו תוכל לבקש אישור להעלות וידאו (YouTube) או תמונות (Google Photos) ישירות לחשבונו של הקיבוץ, במטרה לחסוך אחסון.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ManageSettings;
