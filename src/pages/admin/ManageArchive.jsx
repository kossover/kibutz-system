import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { db, auth } from '../../firebase/config';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    getDoc,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import {
    FolderPlus,
    PencilSimple,
    Trash,
    X,
    Link as LinkIcon,
    Image as ImageIcon,
    VideoCamera,
    MagnifyingGlass,
    MagicWand,
    Spinner,
    CloudArrowUp,
    CheckCircle,
    Images
} from '@phosphor-icons/react';
import TagInput from '../../components/TagInput';

function ManageArchive() {
    const [archiveItems, setArchiveItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadingYt, setIsUploadingYt] = useState(false);
    const [isAuthingPhotos, setIsAuthingPhotos] = useState(false);
    const [googleAlbums, setGoogleAlbums] = useState([]);
    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'image', // 'image', 'video', 'link'
        mediaUrl: '',
        externalPlatform: '', // 'youtube', 'facebook', 'instagram', 'tiktok', ''
        year: '',
        categories: [],
        tags: [],
        participants: [],
    });

    // Hidden state for storing rich metadata fetched from APIs (like YouTube)
    const [fetchedMetadata, setFetchedMetadata] = useState(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'archive_items'), (snapshot) => {
            const itemsData = [];
            snapshot.forEach((d) => {
                const data = d.data();
                if (data.status !== 'draft') {
                    itemsData.push({ id: d.id, ...data });
                }
            });
            // Sort by creation date descending
            setArchiveItems(itemsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        });

        return () => unsubscribe();
    }, []);

    const allCategories = [...new Set(archiveItems.flatMap(item => item.categories || []))].filter(Boolean);
    const allTags = [...new Set(archiveItems.flatMap(item => item.tags || []))].filter(Boolean);
    const allParticipants = [...new Set(archiveItems.flatMap(item => item.participants || []))].filter(Boolean);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const itemData = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                mediaUrl: formData.mediaUrl,
                externalPlatform: formData.type === 'link' ? formData.externalPlatform : '',
                year: formData.year,
                categories: formData.categories,
                tags: formData.tags,
                participants: formData.participants,
                updatedAt: serverTimestamp()
            };

            if (editingItem) {
                await updateDoc(doc(db, 'archive_items', editingItem.id), itemData);
                alert('הפריט עודכן בהצלחה!');
            } else {
                itemData.createdAt = serverTimestamp();
                itemData.uploadedBy = auth?.currentUser?.uid || 'admin';
                await addDoc(collection(db, 'archive_items'), itemData);
                alert('הפריט נוסף לארכיון בהצלחה!');
            }
            resetForm();
        } catch (err) {
            console.error(err);
            alert('אירעה שגיאה: ' + err.message);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק פריט זה מהארכיון?')) return;
        try {
            await deleteDoc(doc(db, 'archive_items', item.id));
            alert('הפריט נמחק.');
        } catch (err) {
            console.error(err);
            alert('שגיאה במחיקה');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            type: 'image',
            mediaUrl: '',
            externalPlatform: '',
            year: '',
            categories: [],
            tags: [],
            participants: [],
        });
        setEditingItem(null);
        setShowForm(false);
        setUploadProgress(0);
        setIsUploadingYt(false);
        setIsAuthingPhotos(false);
        setGoogleAlbums([]);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title || '',
            description: item.description || '',
            type: item.type || 'image',
            mediaUrl: item.mediaUrl || '',
            externalPlatform: item.externalPlatform || '',
            year: item.year || '',
            categories: item.categories || [],
            tags: item.tags || [],
            participants: item.participants || [],
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Helper logic to auto-detect platform and fetch basic metadata
    const handleUrlChange = async (e) => {
        const url = e.target.value;
        let autoPlatform = formData.externalPlatform;
        let fetchedTitle = formData.title;

        if (formData.type === 'link') {
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                autoPlatform = 'youtube';

                try {
                    // Try to get YouTube API key from settings
                    const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
                    const ytApiKey = docSnap.data()?.apiKeys?.youtube;

                    if (ytApiKey) {
                        // Extract Video ID
                        const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                        if (videoIdMatch && videoIdMatch[1]) {
                            const videoId = videoIdMatch[1];
                            const ytResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${ytApiKey}`);

                            if (ytResponse.data.items && ytResponse.data.items.length > 0) {
                                const snippet = ytResponse.data.items[0].snippet;
                                if (!formData.title) fetchedTitle = snippet.title;

                                // Store rich metadata for AI
                                setFetchedMetadata({
                                    channelTitle: snippet.channelTitle,
                                    publishedAt: snippet.publishedAt,
                                    description: snippet.description,
                                    tags: snippet.tags || []
                                });
                            }
                        }
                    } else {
                        // Fallback to basic oEmbed (No API Key needed)
                        const encodedUrl = encodeURIComponent(url);
                        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodedUrl}&format=json`;
                        const response = await axios.get(oEmbedUrl);
                        if (response.data && response.data.title && !formData.title) {
                            fetchedTitle = response.data.title;
                        }
                        if (response.data && response.data.author_name) {
                            setFetchedMetadata({ channelTitle: response.data.author_name });
                        }
                    }
                } catch (error) {
                    console.log('Could not fetch YouTube metadata', error);
                }
            }
            else if (url.includes('facebook.com')) autoPlatform = 'facebook';
            else if (url.includes('instagram.com')) autoPlatform = 'instagram';
            else if (url.includes('tiktok.com')) autoPlatform = 'tiktok';
            else if (url.includes('photos.app.goo.gl') || url.includes('photos.google.com')) autoPlatform = 'google_photos';
        }

        setFormData({ ...formData, mediaUrl: url, externalPlatform: autoPlatform, title: fetchedTitle });
    };

    const autofillWithAI = async () => {
        if (!formData.title && !formData.mediaUrl) {
            alert('נא להזין כותרת סרטון קודם או קישור ליוטיוב כדי שה-AI יוכל לעבוד.');
            return;
        }

        setIsAiLoading(true);
        try {
            // 1. Get API Key from settings
            const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
            const data = docSnap.data();
            const apiKey = data?.apiKeys?.openai;

            if (!apiKey) {
                alert('לא נמצא מפתח OpenAI (API Key) בהגדרות המערכת. אנא הוסף אותו במסך ההגדרות (מתקדם).');
                setIsAiLoading(false);
                return;
            }

            let richContext = `כותרת המדיה שנמשכה: "${formData.title || formData.mediaUrl}"\n`;
            if (fetchedMetadata) {
                if (fetchedMetadata.channelTitle) richContext += `שם הערוץ המפרסם ביוטיוב: "${fetchedMetadata.channelTitle}"\n`;
                if (fetchedMetadata.publishedAt) richContext += `תאריך העלאה מקורי ליוטיוב: "${fetchedMetadata.publishedAt}"\n`;
                if (fetchedMetadata.description) richContext += `התיאור המקורי שהוזן ביוטיוב: "${fetchedMetadata.description.substring(0, 400)}..."\n`; // Trim long descriptions
                if (fetchedMetadata.tags && fetchedMetadata.tags.length > 0) richContext += `תגיות מקוריות מיוטיוב: ${fetchedMetadata.tags.join(', ')}\n`;
            }

            const prompt = `
אתה עוזר ארכיון דיגיטלי לקיבוץ ישראלי. המטרה שלך היא לעזור למיין סרטון או תמונה רק על בסיס הטקסט או הכותרת (ולעיתים קישור) מסופקים.

במידה והקישור הגיע מיוטיוב, מצורפים לפניך גם פרטים כמו תאריך פרסום הערוץ, שם הערוץ והתיאור המקורי. חלץ מהם פרטים!
הנה המידע:
${richContext}

אנא נתח את הטקסט והחזר תגובת JSON מדויקת עם השדות הבאים (בעברית):
- "year": נסה לדלות מתוך הטקסט את השנה. אם אין שנה ברורה אבל רשום "שנות ה80" כתוב "שנות ה-80". אם אינך יודע כלל השאר ריק ("").
- "categories": הצע 1-3 קטגוריות מתאימות לפריט ארכיון קיבוצי מתוך רשימה הגיונית (למשל: 'חגים', 'תרבות', 'חדר אוכל', 'נוף', 'חקלאות', 'הסטוריה', 'ילדים'). החזר במחרוזת אחת מופרדת בפסיקים.
- "tags": הצע עד 5 תגיות חופשיות שיעזרו בחיפוש. מופרדות בפסיקים.
- "description": משפט אחד ציורי, יפה ונוסטלגי (בעברית) המתאר מה רואים בסרטון על סמך הכותרת (אל תהיה גנרי מדי, תתבסס על המידע הקיים).

החזר *אך ורק* JSON חוקי, ללא שום טקסט נוסף מסביב, וודא שאין פסיק מיותר בסוף.
צורת JSON רצויה:
{
  "year": "1994",
  "categories": "חגים, תרבות",
  "tags": "פורים, תחפושות, מסיבה",
  "description": "תיעוד נוסטלגי ממסיבת פורים בחדר האוכל הישן בקיבוץ."
}
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
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiResponseText = response.data.choices[0].message.content;

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
                description: prev.description ? prev.description + '\n' + aiData.description : aiData.description
            }));

            alert('הפרטים מולאו בהצלחה בעזרת AI! נא לעבור עליהם ולאשר.');

        } catch (error) {
            console.error('AI Error:', error);
            alert('שגיאה בתקשורת מול OpenAI או בפענוח התוצאה.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleYouTubeUpload = async (file) => {
        if (!file) {
            alert('אנא בחר קובץ להעלאה');
            return;
        }
        setIsUploadingYt(true);
        setUploadProgress(0);

        try {
            const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
            const ytClientId = docSnap.data()?.apiKeys?.youtubeClientId;

            if (!ytClientId) {
                alert('חסר Client ID למערכת, נא להגדיר דרך הגדרות מערכת מתקדמות.');
                setIsUploadingYt(false);
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: ytClientId,
                scope: 'https://www.googleapis.com/auth/youtube.upload',
                callback: async (response) => {
                    if (response.error) {
                        console.error('OAuth error:', response);
                        alert('שגיאה בהזדהות מול גוגל נמשכה. אנא ודא שהמייל תקין.');
                        setIsUploadingYt(false);
                        return;
                    }

                    const token = response.access_token;
                    performResumableUpload(file, token);
                }
            });
            client.requestAccessToken();
        } catch (err) {
            console.error('Google Auth Error', err);
            alert('שגיאה כללית בהתחברות לגיוס גוגל');
            setIsUploadingYt(false);
        }
    };

    const performResumableUpload = async (file, token) => {
        try {
            const metadata = {
                snippet: {
                    title: formData.title || file.name.substring(0, 90),
                    description: formData.description || 'Uploaded from Kibbutz Archive',
                    tags: formData.tags || [],
                    categoryId: '22', // People & Blogs
                },
                status: {
                    privacyStatus: 'unlisted', // Good for private archives
                    embeddable: true,
                },
            };

            const initRes = await axios.post(
                'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
                metadata,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Upload-Content-Length': file.size.toString(),
                        'X-Upload-Content-Type': file.type || 'video/mp4',
                    },
                }
            );

            const uploadUrl = initRes.headers.location;
            if (!uploadUrl) throw new Error("No upload URL returned from YouTube");

            // Perform actual chunk upload (Axios handles it internally as one big PUT if we pass file)
            const uploadRes = await axios.put(uploadUrl, file, {
                headers: {
                    'Content-Type': file.type || 'video/mp4',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                }
            });

            const videoId = uploadRes.data.id;
            setFormData(prev => ({
                ...prev,
                mediaUrl: `https://www.youtube.com/watch?v=${videoId}`,
                externalPlatform: 'youtube',
                type: 'link'
            }));

            alert('הוידאו הועלה ליוטיוב בהצלחה! הקישור הוזן אוטומטית.');

        } catch (err) {
            console.error('Upload Error:', err);
            if (err.response && err.response.status === 401) {
                alert('שגיאת הרשאה (401). האם פתחת ערוץ יוטיוב תחת המייל הזה? חובה להיכנס לפחות פעם אחת ליוטיוב עם המייל הזה וליצור ערוץ כדי שניתן יהיה להעלות סרטונים.');
            } else {
                alert('שגיאה בהעלאת הוידאו ליוטיוב. ייתכן שהקובץ גדול מדי או שהחיבור נותק.');
            }
        } finally {
            setIsUploadingYt(false);
            setUploadProgress(0);
        }
    };


    const handleGooglePhotosAuth = async () => {
        setIsAuthingPhotos(true);
        try {
            const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
            const ytClientId = docSnap.data()?.apiKeys?.youtubeClientId;

            if (!ytClientId) {
                alert('חסר Client ID למערכת. נא להגדיר Client ID בגוגל פליי (מתאים גם ליוטיוב וגם לתמונות).');
                setIsAuthingPhotos(false);
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: ytClientId,
                scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
                callback: async (response) => {
                    if (response.error) {
                        console.error('OAuth error:', response);
                        alert('שגיאה בתהליך ההזדהות מול Google Photos.');
                        setIsAuthingPhotos(false);
                        return;
                    }

                    const token = response.access_token;
                    fetchGoogleAlbums(token);
                }
            });
            client.requestAccessToken();
        } catch (err) {
            console.error('Auth Error', err);
            alert('שגיאה כללית בהתחברות ל-Google Photos');
            setIsAuthingPhotos(false);
        }
    };

    const fetchGoogleAlbums = async (token) => {
        try {
            const res = await axios.get('https://photoslibrary.googleapis.com/v1/albums', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const albums = res.data.albums;

            if (!albums || albums.length === 0) {
                alert('התחברנו בהצלחה, אבל לא נמצאו שום "אלבומים" בחשבון ה-Google Photos הזה! אנא כנס לפחות פעם אחת לאתר גוגל תמונות וצור אלבום חדש עם התמונות שלך.');
                setIsAuthingPhotos(false);
                return;
            }

            setGoogleAlbums(albums);
            alert(`נמשכו ${albums.length} אלבומים בהצלחה! בחר אחד כעת מהרשימה שתופיע.`);

        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 403) {
                alert('שגיאת הרשאה (403). נראה שה-Photos Library API עדיין לא הופעל או לא הספיק להתעדכן ב-Google Cloud Console, או שלא אישרת גישה לאלבומים בחלון הקודם. ודא שה-API במצב Enable ושגוגל התעדכן (לוקח כמה דקות מאישור).');
            } else {
                alert('שגיאה במשיכת תוכן מהאלבומים. אם יצרת אלבום והשגיאה ממשיכה, ייתכן שיש בעיה בהגדרת ה-API או בזהות החשבון.');
            }
        } finally {
            setIsAuthingPhotos(false);
        }
    };

    const handleAlbumSelect = (e) => {
        const albumId = e.target.value;
        const album = googleAlbums.find(a => a.id === albumId);
        if (album) {
            setFormData(prev => ({
                ...prev,
                mediaUrl: album.productUrl,
                title: prev.title || 'אלבום: ' + album.title,
                externalPlatform: 'google_photos',
                type: 'link'
            }));
        }
    };

    const filteredItems = archiveItems.filter(item =>
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.year?.includes(searchTerm)
    );

    return (
        <div>
            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול ארכיון היסטורי</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => {
                            if (showForm && !editingItem) {
                                setShowForm(false);
                            } else {
                                resetForm();
                                setShowForm(true);
                            }
                        }}
                        className={`btn ${showForm && !editingItem ? 'btn-danger' : 'btn-accent'}`}
                        style={{ width: 'auto' }}
                    >
                        {showForm && !editingItem ? <><X size={20} /> ביטול</> : <><FolderPlus size={20} /> העלה פריט חדש</>}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <h3 className="text-bold mb-4">{editingItem ? 'ערוך פריט ארכיון' : 'הוספת פריט לארכיון'}</h3>
                    <form onSubmit={handleSubmit}>

                        {/* סוג המדיה */}
                        <div className="form-group mb-4">
                            <label className="form-label" style={{ fontWeight: 'bold' }}>סוג מדיה</label>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.type === 'image' ? '#e0f2fe' : 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                    <input type="radio" name="mediaType" checked={formData.type === 'image'} onChange={() => setFormData({ ...formData, type: 'image' })} style={{ accentColor: '#0ea5e9' }} />
                                    <ImageIcon size={20} color="#0ea5e9" /> תמונה מקישור
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.type === 'video' ? '#fce7f3' : 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fbcfe8' }}>
                                    <input type="radio" name="mediaType" checked={formData.type === 'video'} onChange={() => setFormData({ ...formData, type: 'video' })} style={{ accentColor: '#ec4899' }} />
                                    <VideoCamera size={20} color="#ec4899" /> וידאו מקישור (MP4)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.type === 'link' ? '#f3f4f6' : 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    <input type="radio" name="mediaType" checked={formData.type === 'link'} onChange={() => setFormData({ ...formData, type: 'link' })} style={{ accentColor: '#4b5563' }} />
                                    <LinkIcon size={20} color="#4b5563" /> פוסט / קישור לרשת חברתית
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.type === 'youtube_upload' ? '#fef2f2' : 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                    <input type="radio" name="mediaType" checked={formData.type === 'youtube_upload'} onChange={() => setFormData({ ...formData, type: 'youtube_upload' })} style={{ accentColor: '#ef4444' }} />
                                    <CloudArrowUp size={20} color="#ef4444" /> העלאה ישירה ל-YouTube (חינם)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: formData.type === 'google_photos' ? '#f0fdf4' : 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                    <input type="radio" name="mediaType" checked={formData.type === 'google_photos'} onChange={() => setFormData({ ...formData, type: 'google_photos' })} style={{ accentColor: '#22c55e' }} />
                                    <Images size={20} color="#22c55e" /> משוך מ-Google Photos
                                </label>
                            </div>
                        </div>

                        {formData.type === 'google_photos' && (
                            <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 'bold', color: '#166534' }}>ייבוא תמונות מ-Google Photos אישי</label>
                                <p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>
                                    אפשרות זו מתחברת לאותו חשבון ארכיון ומוצאת אלבומי תמונות אוטומטית. אל תשכח שקודם עליך לשלב תמונות בתוך "אלבום" בתוך החשבון המרכזי בגוגל. (הפעלת Photos Library API ב-Cloud).
                                </p>

                                {googleAlbums.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleGooglePhotosAuth}
                                        disabled={isAuthingPhotos}
                                        className="btn"
                                        style={{ width: 'auto', background: '#22c55e', color: 'white', border: 'none', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {isAuthingPhotos ? <Spinner size={20} className="spin" /> : <Images size={20} />}
                                        {isAuthingPhotos ? 'מתחבר לחשבון גוגל תמונות...' : 'התחבר לחשבון טען אלבומים'}
                                    </button>
                                ) : (
                                    <div style={{ marginTop: '8px' }}>
                                        <label className="form-label">בחר מאיזה אלבום גוגל לשאוב את הקישור:</label>
                                        <select
                                            className="form-input"
                                            onChange={handleAlbumSelect}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>-- בחר אלבום --</option>
                                            {googleAlbums.map(album => (
                                                <option key={album.id} value={album.id}>
                                                    {album.title} ({album.mediaItemsCount || 0} תמונות)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {formData.type === 'youtube_upload' && (
                            <div className="form-group" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 'bold' }}>בחר קובץ וידאו המאוחסן במחשב זה</label>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        ref={fileInputRef}
                                        style={{ padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', flex: 1 }}
                                        disabled={isUploadingYt}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleYouTubeUpload(fileInputRef.current?.files[0])}
                                        disabled={isUploadingYt}
                                        className="btn btn-primary"
                                        style={{ width: 'auto', background: '#ef4444', borderColor: '#ef4444', minWidth: '150px' }}
                                    >
                                        {isUploadingYt ? `מעלה... ${uploadProgress}%` : <>העלה כעת <CloudArrowUp size={20} /></>}
                                    </button>
                                </div>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                    * הוידאו יועלה ישירות לערוץ היוטיוב של הקיבוץ כ"מוסתר" (Unlisted). <br />
                                    * ניתן להזין כותרת ותיאור למטה <strong>לפני ההעלאה</strong>, ואלו יישמרו על הסרטון ביוטיוב. כשההעלאה תסתיים, המערכת תהפוך את הפריט ל'קישור' באופן אוטומטי ותוכל לשמור.
                                </p>

                                {isUploadingYt && (
                                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '99px', height: '8px', overflow: 'hidden', marginTop: '8px' }}>
                                        <div style={{ background: '#ef4444', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.2s' }}></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(formData.type !== 'youtube_upload' && formData.type !== 'google_photos') && (
                            <div className="form-group">
                                <label className="form-label">קישור (URL) *</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="הדבק את הקישור כאן..."
                                    value={formData.mediaUrl}
                                    onChange={handleUrlChange}
                                    required
                                    dir="ltr"
                                />
                                <p style={{ fontSize: '12px', color: 'gray', marginTop: '4px' }}>
                                    מומלץ מאוד להשתמש בקישורי יוטיוב. ניתן גם להדביק קישור לתמונה או לאתר חיצוני אחר.
                                </p>
                            </div>
                        )}

                        {formData.type === 'link' && (
                            <div className="form-group">
                                <label className="form-label">פלטפורמה (זיהוי אוטומטי במידת האפשר)</label>
                                <select className="form-input" value={formData.externalPlatform} onChange={(e) => setFormData({ ...formData, externalPlatform: e.target.value })}>
                                    <option value="">אחר</option>
                                    <option value="youtube">YouTube</option>
                                    <option value="facebook">Facebook</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="tiktok">TikTok</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label">כותרת *</label>
                                <input type="text" className="form-input" placeholder="למשל: פורים בחדר אוכל" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />

                                <button
                                    type="button"
                                    onClick={autofillWithAI}
                                    disabled={isAiLoading || !formData.title}
                                    style={{
                                        position: 'absolute',
                                        left: '0px',
                                        top: '0px',
                                        background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px 0 0 0',
                                        padding: '4px 12px',
                                        fontSize: '0.8rem',
                                        cursor: (isAiLoading || !formData.title) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: (!formData.title || isAiLoading) ? 0.7 : 1
                                    }}
                                    title="מלא שדות בעזרת בינה מלאכותית על בסיס הכותרת"
                                >
                                    {isAiLoading ? <Spinner size={16} className="spin" /> : <MagicWand size={16} weight="fill" />}
                                    AI
                                </button>
                                {formData.title && !formData.description && (
                                    <div style={{ position: 'absolute', left: '-12px', top: '12px', background: '#fef08a', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', animation: 'bounce 2s infinite' }}>
                                        נסה אותי!
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">שנה</label>
                                <input type="text" className="form-input" placeholder="למשל: 1985 או שנות ה-80" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">תיאור (AI יוכל לחפש גם כאן)</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                placeholder="תאר מה קורה בתמונה/סרטון. בעתיד ה-AI ישתמש בזה כדי לאפשר חיפושים חכמים וטבעיים..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                            <TagInput
                                label="קטגוריות"
                                value={formData.categories}
                                onChange={(val) => setFormData({ ...formData, categories: val })}
                                suggestions={allCategories}
                                placeholder="הוסף קטגוריה..."
                            />
                            <TagInput
                                label="תגיות לחיפוש"
                                value={formData.tags}
                                onChange={(val) => setFormData({ ...formData, tags: val })}
                                suggestions={allTags}
                                placeholder="הוסף תגית..."
                            />
                            <TagInput
                                label="משתתפים"
                                value={formData.participants}
                                onChange={(val) => setFormData({ ...formData, participants: val })}
                                suggestions={allParticipants}
                                placeholder="הוסף משתתף..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                                {editingItem ? 'עדכן פריט' : 'שמור בארכיון'}
                            </button>
                            <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>
                                ביטול
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* חיפוש וסינון רשימה */}
            <div className="card mb-4">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <MagnifyingGlass size={20} color="var(--text-secondary)" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="חפש לפי כותרת, תיאור או שנה..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ margin: 0 }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {filteredItems.map(item => (
                    <div key={item.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {item.type === 'image' ? <ImageIcon size={24} color="#0ea5e9" /> :
                                    item.type === 'video' ? <VideoCamera size={24} color="#ec4899" /> :
                                        <LinkIcon size={24} color="#4b5563" />}
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.title}</h3>
                            </div>
                            <span style={{ fontSize: '0.85rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                {item.year || 'ללא שנה'}
                            </span>
                        </div>

                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.description || 'ללא תיאור'}
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
                            {item.categories?.slice(0, 3).map(c => (
                                <span key={c} style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>{c}</span>
                            ))}
                            {item.tags?.slice(0, 3).map(t => (
                                <span key={t} style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px' }}>#{t}</span>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                            <button
                                onClick={() => handleEdit(item)}
                                className="btn btn-secondary"
                                style={{ width: 'auto', padding: '6px', borderRadius: '8px' }}
                                title="ערוך"
                            >
                                <PencilSimple size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(item)}
                                className="btn btn-danger"
                                style={{ width: 'auto', padding: '6px', borderRadius: '8px', background: 'transparent', color: '#ef4444', borderColor: '#ef4444' }}
                                title="מחק"
                            >
                                <Trash size={18} />
                            </button>
                        </div>
                    </div>
                ))}
                {filteredItems.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'gray' }}>
                        לא נמצאו פריטים לארכיון.
                    </div>
                )}
            </div>

        </div>
    );
}

export default ManageArchive;
