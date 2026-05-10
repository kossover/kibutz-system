
import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ToggleLeft, ToggleRight, House, SquaresFour, Rows, Key, Eye, EyeSlash, CheckCircle } from '@phosphor-icons/react';

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
            // Need to reload or revert state manually, simplified here:
            loadSettings();
        }
    };

    const ToggleBtn = ({ checked, onClick }) => (
        <button
            onClick={onClick}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: checked ? '#10b981' : '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px'
            }}
        >
            {checked ? (
                <ToggleRight size={32} weight="fill" />
            ) : (
                <ToggleLeft size={32} weight="fill" />
            )}
        </button>
    );

    if (loading) return <div>טוען הגדרות...</div>;

    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px' }}>הגדרות מערכת</h2>

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>שם הדף</th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '120px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <House size={20} />
                                        <span style={{ fontSize: '12px' }}>כפתור חזרה</span>
                                    </div>
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '120px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <SquaresFour size={20} />
                                        <span style={{ fontSize: '12px' }}>מוצג בבית</span>
                                    </div>
                                </th>
                                <th style={{ padding: '16px', textAlign: 'center', width: '120px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <Rows size={20} />
                                        <span style={{ fontSize: '12px' }}>תפריט צף</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((page, index) => (
                                <tr key={page.key} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                                    <td style={{ padding: '16px 24px', fontSize: '15px', fontWeight: '500' }}>
                                        {page.label}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <ToggleBtn
                                                checked={settings.showBackButton[page.key]}
                                                onClick={() => toggleSetting('showBackButton', page.key)}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <ToggleBtn
                                                checked={settings.showInHome[page.key]}
                                                onClick={() => toggleSetting('showInHome', page.key)}
                                            />
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
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

            <div style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                * שינויים בהגדרות נשמרים אוטומטית ומשפיעים על כל המשתמשים.
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '48px', marginBottom: '24px' }}>הגדרות מתקדמות (AI)</h2>
            <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '12px' }}>
                        <Key size={24} color="#4338ca" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>מפתח API של OpenAI</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            משמש לאוטומציות חכמות כגון כתיבת תיאור אוטומטי, הצעת קטגוריות והוספת תגיות על בסיס כותרות בארכיון.
                        </p>
                    </div>
                </div>

                <div className="form-group" style={{ maxWidth: '600px', margin: 0 }}>
                    <label className="form-label">מפתח סודי (Secret Key)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type={showApiKey ? "text" : "password"}
                                className="form-input"
                                placeholder="sk-..."
                                value={openAIApiKey}
                                onChange={(e) => {
                                    setOpenAIApiKey(e.target.value);
                                    setApiSaved(false);
                                }}
                                dir="ltr"
                                style={{ margin: 0, paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                                }}
                            >
                                {showApiKey ? <EyeSlash size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ width: 'auto' }}
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
                            {apiSaving ? 'שומר...' : (apiSaved ? <><CheckCircle size={18} /> נשמר</> : 'שמור מפתחות')}
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                        אזהרה: המפתח נשמר במסד הנתונים וחשוף למנהלים. אין לשתף אותו בחוץ. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>להנפקת מפתח חדש</a>.
                    </p>
                </div>

                <div className="form-group" style={{ maxWidth: '600px', margin: 0, marginTop: '24px' }}>
                    <label className="form-label">מפתח YouTube API (אופציונלי לארכיון)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type={showYtApiKey ? "text" : "password"}
                                className="form-input"
                                placeholder="..."
                                value={youtubeApiKey}
                                onChange={(e) => {
                                    setYoutubeApiKey(e.target.value);
                                    setApiSaved(false);
                                }}
                                dir="ltr"
                                style={{ margin: 0, paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowYtApiKey(!showYtApiKey)}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'
                                }}
                            >
                                {showYtApiKey ? <EyeSlash size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                        מאפשר ל-AI לשאוב תיאורים מלאים, ערוץ מפרסם ותאריך ישירות מיוטיוב במקום להסתמך על כותרת בלבד. ניתן להנפיק ב-Google Cloud Console.
                    </p>
                </div>

                <div className="form-group" style={{ maxWidth: '600px', margin: 0, marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 16px', color: '#0f172a' }}>הרשאות העלאה לענן הארכיון (OAuth 2.0)</h4>

                    <label className="form-label">Client ID (מזהה לקוח)</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="...apps.googleusercontent.com"
                        value={youtubeClientId}
                        onChange={(e) => {
                            setYoutubeClientId(e.target.value);
                            setApiSaved(false);
                        }}
                        dir="ltr"
                        style={{ marginBottom: '16px' }}
                    />

                    <label className="form-label">Client Secret (סוד לקוח)</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="GOCSPX-..."
                        value={youtubeClientSecret}
                        onChange={(e) => {
                            setYoutubeClientSecret(e.target.value);
                            setApiSaved(false);
                        }}
                        dir="ltr"
                    />

                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', lineHeight: '1.5' }}>
                        מפתחות אלו מתחברים לחשבון הגוגל הייעודי שנוצר לארכיון. בשילוב שלהם, המערכת שלנו תוכל לבקש אישור להעלות וידאו (YouTube) או תמונות (Google Photos) ישירות לחשבונו של הקיבוץ, במטרה לחסוך עשרות שקלים בחודש על שרתי אחסון פרטיים.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ManageSettings;
