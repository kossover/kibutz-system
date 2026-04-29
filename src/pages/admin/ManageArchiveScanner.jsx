import { useState, useEffect } from 'react';
import axios from 'axios';
import { db, auth } from '../../firebase/config';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import {
    MagnifyingGlass,
    PlusCircle,
    YoutubeLogo,
    MagicWand,
    Spinner,
    X,
    FolderPlus
} from '@phosphor-icons/react';
import TagInput from '../../components/TagInput';

function ManageArchiveScanner() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // API Keys
    const [ytApiKey, setYtApiKey] = useState('');
    const [openAiKey, setOpenAiKey] = useState('');

    // Modal adding state
    const [addingVideo, setAddingVideo] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Archive items for autocomplete suggestions
    const [archiveItems, setArchiveItems] = useState([]);

    // Form data for the modal
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'link',
        mediaUrl: '',
        externalPlatform: 'youtube',
        year: '',
        categories: [],
        tags: [],
        participants: [],
    });

    useEffect(() => {
        // Load API Keys
        const loadKeys = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
                if (docSnap.exists()) {
                    const keys = docSnap.data().apiKeys || {};
                    setYtApiKey(keys.youtube || '');
                    setOpenAiKey(keys.openai || '');
                }
            } catch (err) {
                console.error("Error loading keys:", err);
            }
        };
        loadKeys();

        const unsubscribe = onSnapshot(collection(db, 'archive_items'), (snapshot) => {
            const itemsData = [];
            snapshot.forEach((d) => itemsData.push({ id: d.id, ...d.data() }));
            setArchiveItems(itemsData);
        });

        return () => unsubscribe();
    }, []);

    const allCategories = [...new Set(archiveItems.flatMap(item => item.categories || []))].filter(Boolean);
    const allTags = [...new Set(archiveItems.flatMap(item => item.tags || []))].filter(Boolean);
    const allParticipants = [...new Set(archiveItems.flatMap(item => item.participants || []))].filter(Boolean);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        if (!ytApiKey) {
            alert('לא נמצא מפתח YouTube API (בהגדרות מתקדמות). לא ניתן לסרוק את הרשת.');
            return;
        }

        setIsSearching(true);
        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(searchQuery)}&type=video&key=${ytApiKey}`;
            const response = await axios.get(url);
            setSearchResults(response.data.items || []);
        } catch (error) {
            console.error('YouTube Search Error:', error);
            alert('שגיאה בחיפוש מול יוטיוב. נסה שוב מאוחר יותר.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectVideo = async (video) => {
        const snippet = video.snippet;
        const videoId = video.id.videoId;
        const mediaUrl = `https://www.youtube.com/watch?v=${videoId}`;

        setAddingVideo(video);
        setFormData({
            title: snippet.title,
            description: snippet.description || '',
            type: 'link',
            mediaUrl: mediaUrl,
            externalPlatform: 'youtube',
            year: '',
            categories: [],
            tags: [],
            participants: [],
        });

        // Automatically trigger AI processing
        if (openAiKey) {
            triggerAI(snippet.title, mediaUrl, snippet.channelTitle, snippet.publishedAt, snippet.description);
        }
    };

    const triggerAI = async (title, url, channel, date, description) => {
        setIsAiLoading(true);
        try {
            let richContext = `כותרת המדיה שנמשכה: "${title}"\n`;
            if (channel) richContext += `שם הערוץ המפרסם מיוטיוב: "${channel}"\n`;
            if (date) richContext += `תאריך העלאה מקורי ליוטיוב: "${date}"\n`;
            if (description) richContext += `תיאור מקורי מיוטיוב: "${description.substring(0, 400)}..."\n`;

            const prompt = `
אתה עוזר ארכיון דיגיטלי לקיבוץ ישראלי. המטרה שלך היא לעזור למיין סרטון או תמונה רק על בסיס הטקסט או הכותרת.

המידע שנשאב מיוטיוב:
${richContext}

אנא נתח את הטקסט והחזר תגובת JSON מדויקת עם השדות הבאים (בעברית):
- "year": נסה לדלות מתוך הטקסט את השנה (למשל "1994", "שנות ה-80"). חפש בכותרת ובתאריך העלאה. אם אינך יודע כלל השאר ריק ("").
- "categories": הצע 1-3 קטגוריות מתאימות לפריט ארכיון קיבוצי (למשל: 'חגים', 'תרבות', 'חדר אוכל'). החזר במחרוזת אחת מופרדת בפסיקים.
- "tags": הצע עד 5 תגיות חופשיות שיעזרו בחיפוש. מופרדות בפסיקים.
- "description": משפט אחד ציורי, יפה ונוסטלגי (בעברית) המתאר מה רואים בסרטון על סמך המידע. אל תכניס סתם מידע שלא קיים.

החזר אך ורק JSON חוקי, ללא טקסט מסביב.
`;

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${openAiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const cleanedText = aiResponseText.replace(/```json\n?|\n?```/g, '').trim();
            const aiData = JSON.parse(cleanedText);

            const parseAiArray = (str) => {
                if (!str) return [];
                if (Array.isArray(str)) return str;
                return String(str).split(',').map(s => s.trim()).filter(s => s !== '');
            };

            setFormData(prev => ({
                ...prev,
                year: aiData.year || prev.year,
                categories: aiData.categories ? Array.from(new Set([...prev.categories, ...parseAiArray(aiData.categories)])) : prev.categories,
                tags: aiData.tags ? Array.from(new Set([...prev.tags, ...parseAiArray(aiData.tags)])) : prev.tags,
                description: aiData.description ? prev.description + '\\n\\n(AI): ' + aiData.description : prev.description
            }));

        } catch (error) {
            console.error('AI Error during scan:', error);
            // Non-blocking error
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSaveToArchive = async (e) => {
        e.preventDefault();
        try {
            const itemData = {
                title: formData.title,
                description: formData.description,
                type: 'link',
                mediaUrl: formData.mediaUrl,
                externalPlatform: 'youtube',
                year: formData.year,
                categories: formData.categories,
                tags: formData.tags,
                participants: formData.participants,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                uploadedBy: auth?.currentUser?.uid || 'admin'
            };

            await addDoc(collection(db, 'archive_items'), itemData);
            alert('הסרטון נוסף לארכיון בהצלחה!');
            setAddingVideo(null);

            // Remove the video from results to prevent adding it twice
            setSearchResults(prev => prev.filter(v => v.id.videoId !== addingVideo.id.videoId));
        } catch (err) {
            console.error('Save to Archive Error:', err);
            alert('הייתה שגיאה בשמירה. ' + err.message);
        }
    };

    return (
        <div>
            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>סורק רשת (YouTube)</h2>
                {!ytApiKey && (
                    <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
                        * חסר מפתח YouTube API. יש להיכנס להגדרות במערכת כדי לסרוק סרטונים.
                    </div>
                )}
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                חפש במנוע היוטיוב העולמי או הערוצים הספציפיים ולחץ "הוסף" כדי לייבא ישירות לארכיון. השדות השונים ימולאו עצמאית ברגע הבחירה.
            </p>

            <form onSubmit={handleSearch} className="card mb-4">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <MagnifyingGlass size={24} color="var(--text-secondary)" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="חפש ביוטיוב (לדוגמה: פורים קיבוץ...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ margin: 0, flex: 1 }}
                        disabled={!ytApiKey || isSearching}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap' }}
                        disabled={!ytApiKey || isSearching || !searchQuery.trim()}
                    >
                        {isSearching ? <Spinner className="spin" size={20} /> : 'סרוק רשת'}
                    </button>
                </div>
            </form>

            {/* Results Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {searchResults.map((video) => {
                    const snippet = video.snippet;
                    // Safely grab thumbnail URL 
                    let thumbUrl = '';
                    if (snippet.thumbnails) {
                        thumbUrl = (snippet.thumbnails.high || snippet.thumbnails.medium || snippet.thumbnails.default || {}).url;
                    }

                    return (
                        <div key={video.id.videoId} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {thumbUrl && (
                                <div style={{ height: '160px', width: '100%', overflow: 'hidden' }}>
                                    <img src={thumbUrl} alt={snippet.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <h3 style={{ fontSize: '1.05rem', margin: '0 0 8px 0', lineHeight: '1.4' }}>{snippet.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                                    <YoutubeLogo size={16} color="#ef4444" weight="fill" />
                                    <span>{snippet.channelTitle}</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {snippet.description}
                                </p>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="btn btn-accent"
                                        style={{ width: 'auto', padding: '8px 16px', gap: '8px' }}
                                        onClick={() => handleSelectVideo(video)}
                                    >
                                        <FolderPlus size={18} /> הוסף לארכיון
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* AI Review & Edit Modal overlay */}
            {addingVideo && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <YoutubeLogo size={24} color="#ef4444" weight="fill" />
                                שומר פריט לארכיון
                            </h3>
                            <button onClick={() => setAddingVideo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {isAiLoading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '20px', background: '#f3e8ff', color: '#7e22ce', borderRadius: '12px', marginBottom: '24px' }}>
                                <Spinner size={24} className="spin" />
                                <span style={{ fontWeight: '500' }}>מנתח את מידע היעד ומתייג בעזרת AI...</span>
                            </div>
                        )}

                        <form onSubmit={handleSaveToArchive}>
                            <div className="form-group">
                                <label className="form-label">כותרת הסרטון *</label>
                                <input type="text" className="form-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label">שנה מקושרת (AI)</label>
                                    <input type="text" className="form-input" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <TagInput
                                        label="קטגוריות מומלצות"
                                        value={formData.categories}
                                        onChange={(val) => setFormData({ ...formData, categories: val })}
                                        suggestions={allCategories}
                                        placeholder="הוסף קטגוריה..."
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <TagInput
                                    label="תגיות AI לחיפוש"
                                    value={formData.tags}
                                    onChange={(val) => setFormData({ ...formData, tags: val })}
                                    suggestions={allTags}
                                    placeholder="הוסף תגית..."
                                />
                            </div>

                            <div className="form-group">
                                <TagInput
                                    label="משתתפים (אופציונלי)"
                                    value={formData.participants}
                                    onChange={(val) => setFormData({ ...formData, participants: val })}
                                    suggestions={allParticipants}
                                    placeholder="מי מופיע בסרטון?"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">תיאור (ניתן לערוך חופשי)</label>
                                <textarea className="form-input" rows="4" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setAddingVideo(null)}>
                                    בטל פעולה
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={isAiLoading || !formData.title}>
                                    אישור והוספה לארכיון!
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default ManageArchiveScanner;
