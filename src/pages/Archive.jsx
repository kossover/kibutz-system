import { useState, useEffect } from 'react';
import axios from 'axios';
import { db } from '../firebase/config';
import { collection, onSnapshot, getDoc, doc } from 'firebase/firestore';
import {
    MagnifyingGlass,
    Image as ImageIcon,
    VideoCamera,
    Link as LinkIcon,
    X,
    Funnel,
    PlayCircle,
    MagicWand,
    Spinner,
    SortAscending,
    BookOpen,
    CaretRight,
    Images
} from '@phosphor-icons/react';

function Archive() {
    const [items, setItems] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [loadingArchive, setLoadingArchive] = useState(true);
    const [loadingAlbums, setLoadingAlbums] = useState(true);

    const loading = loadingArchive || loadingAlbums;
    const [selectedAlbum, setSelectedAlbum] = useState(null);

    // Filtering states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all'); // all, image, video, link
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, year_desc, year_asc, title_asc

    // Display states
    const [selectedItem, setSelectedItem] = useState(null);

    // AI states
    const [openAiKey, setOpenAiKey] = useState('');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiFilterQuery, setAiFilterQuery] = useState(''); // Text sent to AI
    const [aiFiltersActive, setAiFiltersActive] = useState(false);
    const [yearFilter, setYearFilter] = useState({ exact: null, before: null, after: null });

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'archive_items'), (snapshot) => {
            const itemsData = [];
            snapshot.forEach((d) => {
                const data = d.data();
                if (data.status !== 'draft') {
                    itemsData.push({ id: d.id, ...data });
                }
            });
            // Sort newest first based on logic. `year` could be string, but `createdAt` is reliable.
            setItems(itemsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            setLoadingArchive(false);
        });

        const unsubscribeAlbums = onSnapshot(collection(db, 'albums'), (snapshot) => {
            const albumsData = [];
            snapshot.forEach((d) => {
                const data = d.data();
                if (data.status !== 'draft') {
                    albumsData.push({
                        id: d.id,
                        ...data,
                        type: 'album',
                        categories: ['אלבומים'],
                        mediaUrl: data.pages?.[0]?.url
                    });
                }
            });
            setAlbums(albumsData);
            setLoadingAlbums(false);
        });

        // Load API Key
        const loadKeys = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
                if (docSnap.exists() && docSnap.data().apiKeys) {
                    setOpenAiKey(docSnap.data().apiKeys.openai || '');
                }
            } catch (err) {
                console.error("Error loading key:", err);
            }
        };
        loadKeys();

        return () => {
            unsubscribe();
            unsubscribeAlbums();
        };
    }, []);

    const combinedItems = [
        ...albums,
        ...items.filter(item => !item.albumId)
    ];

    // Extract all unique categories
    const allCategories = Array.from(
        new Set(combinedItems.flatMap(item => item.categories || []))
    ).filter(Boolean).sort();

    // Parse YouTube ID
    const getYouTubeVideoId = (url) => {
        if (!url) return null;
        try {
            let videoId = null;
            if (url.includes('youtube.com/watch')) {
                videoId = new URLSearchParams(new URL(url).search).get('v');
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }
            return videoId;
        } catch {
            return null;
        }
    };

    const getYouTubeEmbedUrl = (url) => {
        const videoId = getYouTubeVideoId(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    };

    const getYouTubeThumbnailUrl = (url) => {
        const videoId = getYouTubeVideoId(url);
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    };

    const filteredItems = combinedItems.filter(item => {
        let matchesSearch = true;
        if (searchTerm) {
            matchesSearch =
                item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.year?.includes(searchTerm) ||
                item.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                item.participants?.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        const matchesType = selectedType === 'all' || item.type === selectedType;

        const matchesCategory = selectedCategory === 'all' ||
            (item.categories && item.categories.includes(selectedCategory));

        let matchesYear = true;
        if (aiFiltersActive) {
            const itemYear = parseInt(item.year);
            if (!isNaN(itemYear)) {
                if (yearFilter.exact != null && itemYear !== parseInt(yearFilter.exact)) matchesYear = false;
                if (yearFilter.before != null && itemYear >= yearFilter.before) matchesYear = false;
                if (yearFilter.after != null && itemYear <= yearFilter.after) matchesYear = false;
            } else if (yearFilter.exact != null) {
                // strict match on exact string (e.g., "שנות ה-80")
                if (item.year !== yearFilter.exact) matchesYear = false;
            }
        }

        return matchesSearch && matchesType && matchesCategory && matchesYear;
    });

    const sortedItems = [...filteredItems].sort((a, b) => {
        if (sortOrder === 'newest') {
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        } else if (sortOrder === 'oldest') {
            return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
        } else if (sortOrder === 'year_desc') {
            const yearA = parseInt(a.year) || 0;
            const yearB = parseInt(b.year) || 0;
            return yearB - yearA;
        } else if (sortOrder === 'year_asc') {
            const yearA = parseInt(a.year) || 9999;
            const yearB = parseInt(b.year) || 9999;
            return yearA - yearB;
        } else if (sortOrder === 'title_asc') {
            return (a.title || '').localeCompare(b.title || '', 'he');
        } else if (sortOrder === 'title_desc') {
            return (b.title || '').localeCompare(a.title || '', 'he');
        }
        return 0;
    });

    const handleAiSearch = async () => {
        if (!aiFilterQuery.trim() || !openAiKey) return;
        setIsAiSearching(true);

        try {
            const prompt = `
אתה עוזר חיפוש אינטליגנטי לארכיון. המשתמש מחפש מחרוזת חופשית בעברית:
"${aiFilterQuery}"

אנא הפוך את הבקשה הזו למסננים ב-JSON בלבד (חובה לעמוד במבנה וללא טקסט עזר):
{
  "searchTerm": "מילות מפתח עיקריות לחיפוש רגיל. השאר ריק אם אין",
  "type": "image" או "video" או "link" או "all" (לפי בקשת המשתמש, למשל "רק תמונות" -> "image"),
  "category": "בחר את הקטגוריה המתאימה ביותר מהרשימה: [${allCategories.join(', ')}] או 'all' אם אין",
  "yearBefore": מספר (למשל לפני 2020) או null,
  "yearAfter": מספר (למשל אחרי 2000) או null,
  "exactYear": מחרוזת שנה מדויקת או null
}
            `;

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.2, // Low temp for structured tasks
                },
                {
                    headers: {
                        'Authorization': `Bearer ${openAiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiResponseText = response.data.choices[0].message.content;
            const cleanedText = aiResponseText.replace(/```json\n?|\n?```/g, '').trim();
            const aiData = JSON.parse(cleanedText);

            setSearchTerm(aiData.searchTerm || '');
            if (['image', 'video', 'link', 'album', 'all'].includes(aiData.type)) setSelectedType(aiData.type);
            setSelectedCategory(aiData.category && aiData.category !== 'all' && allCategories.includes(aiData.category) ? aiData.category : 'all');
            setYearFilter({
                exact: aiData.exactYear,
                before: aiData.yearBefore,
                after: aiData.yearAfter
            });
            setAiFiltersActive(true);

        } catch (error) {
            console.error('AI Search Error:', error);
            alert('הייתה שגיאה בניתוח הבקשה שלך. אנא נסה לנסח מחדש.');
        } finally {
            setIsAiSearching(false);
        }
    };

    const clearAiFilters = () => {
        setSearchTerm('');
        setSelectedType('all');
        setSelectedCategory('all');
        setAiFiltersActive(false);
        setYearFilter({ exact: null, before: null, after: null });
        setAiFilterQuery('');
    };

    return (
        <div className="page-container" style={{ paddingBottom: '120px', maxWidth: '1400px', margin: '0 auto' }}>

            {/* Header section with gradient and title */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '40px 24px',
                borderRadius: '24px',
                marginBottom: '32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>
                        הארכיון הקיבוצי
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: '#cbd5e1', maxWidth: '600px', lineHeight: '1.6' }}>
                        שומרים ומשתפים את הרגעים היפים. חפשו וגלו תמונות, סרטונים ותיעודים מאירועים שונים לאורך השנים.
                    </p>
                </div>

                {/* Decorative background elements */}
                <div style={{ position: 'absolute', right: '-5%', top: '-20%', fontSize: '200px', opacity: 0.05, transform: 'rotate(15deg)' }}>
                    <ImageIcon weight="fill" />
                </div>
            </div>

            {selectedAlbum ? (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <button onClick={() => setSelectedAlbum(null)} style={{ background: 'white', color: '#3b82f6', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '24px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'} onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'}>
                        <CaretRight size={20} weight="bold" /> חזרה לכל הפריטים בארכיון
                    </button>

                    <div style={{ background: 'white', padding: '32px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '32px', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
                        <div style={{ flex: '1 1 500px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                <BookOpen size={48} color="#3b82f6" weight="fill" />
                                <h2 style={{ fontSize: '2.5rem', margin: 0, color: '#0f172a' }}>{selectedAlbum.title}</h2>
                            </div>
                            {selectedAlbum.year && <div style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#3b82f6', fontWeight: 'bold', background: '#eff6ff', display: 'inline-block', padding: '4px 12px', borderRadius: '8px' }}>שנת {selectedAlbum.year}</div>}
                            <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: '1.7', whiteSpace: 'pre-line' }}>{selectedAlbum.description || 'ללא תיאור לאלבום זה.'}</p>
                        </div>
                        {selectedAlbum.mediaUrl && (
                            <div style={{ flex: '0 0 300px', height: '200px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                <img src={selectedAlbum.mediaUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}
                    </div>

                    <h3 style={{ fontSize: '1.5rem', marginBottom: '24px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Images size={28} color="#10b981" weight="fill" /> תמונות באלבום ({items.filter(i => i.albumId === selectedAlbum.id).length})
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                        {items.filter(i => i.albumId === selectedAlbum.id).map(item => (
                            <div
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #f1f5f9' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; }}
                            >
                                <div style={{ height: '220px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={item.mediaUrl} alt={item.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px', color: '#0f172a' }}>{item.title || 'ללא כותרת'}</h3>
                                    {item.description && <p style={{ fontSize: '0.9rem', color: '#64748b', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', display: '-webkit-box', overflow: 'hidden' }}>{item.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* Control panel (Search & Filters) */}
                    <div style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '16px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                        marginBottom: '24px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        {/* Search bar */}
                        <div style={{ position: 'relative' }}>

                            {openAiKey && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <MagicWand size={20} color="#a855f7" weight="fill" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                                        <input
                                            type="text"
                                            placeholder="בקש מה-AI בצורה חופשית: מצא לי את כל התמונות של שבועות משנת 2020..."
                                            value={aiFilterQuery}
                                            onChange={(e) => setAiFilterQuery(e.target.value)}
                                            // Submit on Enter
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch() }}
                                            style={{
                                                width: '100%',
                                                padding: '14px 44px 14px 14px',
                                                borderRadius: '12px',
                                                border: '1px solid #d8b4fe',
                                                background: '#faf5ff',
                                                fontSize: '1.05rem',
                                                outline: 'none',
                                                color: '#6b21a8'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAiSearch}
                                        disabled={isAiSearching || !aiFilterQuery.trim()}
                                        style={{
                                            background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                                            color: 'white', border: 'none', borderRadius: '12px', padding: '0 24px', fontWeight: 'bold',
                                            cursor: isAiSearching || !aiFilterQuery.trim() ? 'not-allowed' : 'pointer',
                                            opacity: isAiSearching || !aiFilterQuery.trim() ? 0.7 : 1,
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {isAiSearching ? <Spinner size={20} className="spin" /> : 'חפש חופשי עם AI'}
                                    </button>
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <MagnifyingGlass size={22} color="#64748b" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="חיפוש רגיל (מילות מפתח: פורים, שם חבר, שנה)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '16px 48px 16px 16px',
                                        borderRadius: '12px',
                                        border: '2px solid transparent',
                                        background: '#f1f5f9',
                                        fontSize: '1.05rem',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                    }}
                                    onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.background = '#f1f5f9'; e.target.style.borderColor = 'transparent'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                        </div>

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {aiFiltersActive && (
                                <div style={{ background: '#fef08a', color: '#854d0e', padding: '6px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MagicWand size={16} weight="fill" /> מסנני AI הופעלו
                                    <button onClick={clearAiFilters} style={{ background: 'none', border: 'none', color: '#854d0e', cursor: 'pointer', padding: 0, display: 'flex' }} title="נקה סינוני AI">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 'bold' }}>
                                <Funnel size={18} /> סנן לפי:
                            </div>

                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                style={{ padding: '8px 16px', borderRadius: '99px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                <option value="all">כל סוגי המדיה</option>
                                <option value="album">אלבומים</option>
                                <option value="image">תמונות (בודדות)</option>
                                <option value="video">וידאו (חיצוני/קובץ)</option>
                                <option value="link">קישורים פוסטים</option>
                            </select>

                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                style={{ padding: '8px 16px', borderRadius: '99px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                <option value="all">כל הקטגוריות</option>
                                {allCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 8px' }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 'bold' }}>
                                <SortAscending size={18} /> מיון:
                            </div>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                style={{ padding: '8px 16px', borderRadius: '99px', border: '1px solid #cbd5e1', outline: 'none', background: 'white', cursor: 'pointer' }}
                            >
                                <option value="newest">הכי חדשים (לפי תאריך העלאה)</option>
                                <option value="oldest">הכי ישנים (לפי תאריך העלאה)</option>
                                <option value="year_desc">לפי שנה מקושרת (מהחדש לישן)</option>
                                <option value="year_asc">לפי שנה מקושרת (מהישן לחדש)</option>
                                <option value="title_asc">לפי אלף בית (א-ת)</option>
                                <option value="title_desc">לפי אלף בית (ת-א)</option>
                            </select>
                        </div>
                    </div>

                    {/* Grid of Archive Items */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>טוען את הארכיון...</div>
                    ) : sortedItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                            <ImageIcon size={48} color="#cbd5e1" style={{ margin: '0 auto 16px auto', display: 'block' }} />
                            <h3 style={{ fontSize: '1.2rem', color: '#475569', marginBottom: '8px' }}>לא נמצאו תוצאות</h3>
                            <p style={{ color: '#94a3b8' }}>נסה לשנות את מילות החיפוש או הסינון</p>
                            {(searchTerm !== '' || selectedCategory !== 'all' || selectedType !== 'all' || aiFiltersActive) && (
                                <button
                                    onClick={clearAiFilters}
                                    style={{ padding: '8px 16px', background: '#f1f5f9', color: '#3b82f6', border: 'none', borderRadius: '99px', marginTop: '16px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    נקה סינונים
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '24px'
                        }}>
                            {sortedItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (item.type === 'album') setSelectedAlbum(item);
                                        else setSelectedItem(item);
                                    }}
                                    style={{
                                        background: 'white',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(0,0,0,0.1)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; }}
                                >
                                    {/* Thumbnail / Image Preview Area */}
                                    <div style={{ height: '200px', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                                        {item.type === 'image' && item.mediaUrl ? (
                                            <img src={item.mediaUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : item.type === 'video' || (item.type === 'link' && item.externalPlatform === 'youtube') ? (
                                            <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#334155', color: 'white' }}>
                                                {getYouTubeThumbnailUrl(item.mediaUrl) && (
                                                    <img src={getYouTubeThumbnailUrl(item.mediaUrl)} alt={item.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                                )}
                                                {item.type === 'video' && !getYouTubeThumbnailUrl(item.mediaUrl) && (
                                                    <video src={`${item.mediaUrl}#t=0.1`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} preload="metadata" />
                                                )}
                                                <PlayCircle size={64} weight="light" style={{ position: 'relative', zIndex: 2 }} />
                                            </div>
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', color: '#64748b' }}>
                                                <LinkIcon size={48} weight="light" />
                                            </div>
                                        )}

                                        {/* Year Badge overlay */}
                                        {item.year && (
                                            <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 'bold', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                                                {item.year}
                                            </div>
                                        )}

                                        {/* Album Indicator */}
                                        {item.type === 'album' && (
                                            <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(255,255,255,0.95)', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                <Images size={16} weight="fill" /> אלבום ({item.cropsCount || 0} תמונות)
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: '#0f172a' }}>{item.title}</h3>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '16px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {item.description}
                                        </p>

                                        {/* Tags preview */}
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {item.categories?.slice(0, 2).map(c => (
                                                <span key={c} style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: '4px' }}>{c}</span>
                                            ))}
                                            {item.tags?.slice(0, 2).map(t => (
                                                <span key={t} style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '4px' }}>#{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Lightbox / Modal Modal Viewer */}
            {selectedItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }} onClick={(e) => {
                    if (e.target === e.currentTarget) setSelectedItem(null);
                }}>

                    <button
                        onClick={() => setSelectedItem(null)}
                        style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', padding: '12px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <X size={24} weight="bold" />
                    </button>

                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        maxWidth: '900px',
                        width: '100%',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>
                        {/* Visual Media Section */}
                        <div style={{ background: '#000', width: '100%', maxHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {selectedItem.type === 'image' && (
                                <img src={selectedItem.mediaUrl} alt={selectedItem.title} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                            )}
                            {selectedItem.type === 'video' && (
                                <video src={selectedItem.mediaUrl} controls style={{ width: '100%', maxHeight: '60vh' }} />
                            )}
                            {selectedItem.type === 'link' && selectedItem.externalPlatform === 'youtube' && (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ aspectRatio: '16/9', border: 'none', minHeight: '400px' }}
                                    src={getYouTubeEmbedUrl(selectedItem.mediaUrl)}
                                    title="YouTube video player"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                ></iframe>
                            )}
                            {selectedItem.type === 'link' && selectedItem.externalPlatform !== 'youtube' && (
                                <div style={{ padding: '60px', textAlign: 'center', color: 'white' }}>
                                    <LinkIcon size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                    <h3 style={{ marginBottom: '16px' }}>זהו פריט המקושר לחיצונית ({selectedItem.externalPlatform || 'רשת חברתית'})</h3>
                                    <a href={selectedItem.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#3b82f6', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: '99px', fontWeight: 'bold' }}>
                                        פתיחת הקישור <LinkIcon size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Details Section */}
                        <div style={{ padding: '24px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{selectedItem.title}</h2>
                                {selectedItem.year && (
                                    <span style={{ fontSize: '1rem', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                        שנת {selectedItem.year}
                                    </span>
                                )}
                            </div>

                            {selectedItem.description && (
                                <p style={{ fontSize: '1.05rem', color: '#475569', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-line' }}>
                                    {selectedItem.description}
                                </p>
                            )}

                            {/* Metadata tags */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {selectedItem.categories?.map(c => (
                                    <span key={c} style={{ fontSize: '0.85rem', background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold' }}>{c}</span>
                                ))}
                                {selectedItem.participants?.map(p => (
                                    <span key={p} style={{ fontSize: '0.85rem', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '4px' }}>🙋‍♂️ {p}</span>
                                ))}
                                {selectedItem.tags?.map(t => (
                                    <span key={t} style={{ fontSize: '0.85rem', background: '#f1f5f9', color: '#64748b', padding: '4px 12px', borderRadius: '4px' }}>#{t}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Archive;
