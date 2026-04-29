import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Plus, Trash, PencilSimple, Link as LinkIcon, Eye, Check, X, ArrowsDownUp, Upload } from '@phosphor-icons/react';

const AVAILABLE_LOGOS = [
    { label: 'ללא לוגו', value: '' },
    { label: 'לוגו ראשי', value: '/logo.png' },
    { label: 'תרבותנו', value: '/tarbutenu.png' }
];

function ManageLandingPages() {
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('list'); // 'list', 'edit'
    const [editingId, setEditingId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        slug: '',
        title: '',
        description: '',
        imageUrl: '',
        logoUrl: '',
        backgroundColor: '#fff7ed', // default light orange
        buttons: []
    });

    useEffect(() => {
        loadPages();
    }, []);

    const loadPages = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'landingPages'));
            const list = [];
            querySnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setPages(list);
        } catch (error) {
            console.error("Error loading pages:", error);
            alert("שגיאה בטעינת הדפים");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (page) => {
        setEditingId(page.id);
        setFormData({
            slug: page.slug || page.id,
            title: page.title || '',
            description: page.description || '',
            imageUrl: page.imageUrl || '',
            logoUrl: page.logoUrl || '',
            backgroundColor: page.backgroundColor || '#fff7ed',
            buttons: page.buttons || []
        });
        setViewMode('edit');
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({
            slug: '',
            title: '',
            description: '',
            imageUrl: '',
            logoUrl: '',
            backgroundColor: '#fff7ed',
            buttons: [{ label: 'כפתור לדוגמה', url: '', color: '#ea580c', textColor: '#ffffff' }]
        });
        setViewMode('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault();

        // Basic Validation
        if (!formData.slug.trim()) {
            alert('חובה להזין מזהה URL (Slug)');
            return;
        }

        // Slug format validation: lowercase, numbers, hyphens only
        const slugPattern = /^[a-z0-9-]+$/;
        if (!slugPattern.test(formData.slug)) {
            alert('מזהה URL יכול להכיל רק אותיות באנגלית, מספרים ומקפים');
            return;
        }

        try {
            // Check uniqueness if creating new
            if (!editingId) {
                const existing = pages.find(p => p.id === formData.slug);
                if (existing) {
                    alert('כבר קיים דף עם מזהה URL זה. אנא בחר אחר.');
                    return;
                }
            } else if (editingId !== formData.slug) {
                const existing = pages.find(p => p.id === formData.slug);
                if (existing) {
                    alert('כבר קיים דף עם מזהה URL זה.');
                    return;
                }
                // Renaming
                await setDoc(doc(db, 'landingPages', formData.slug), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
                await deleteDoc(doc(db, 'landingPages', editingId));
                alert('הדף נשמר והועבר לכתובת החדשה');
                loadPages();
                setViewMode('list');
                return;
            }

            await setDoc(doc(db, 'landingPages', formData.slug), {
                ...formData,
                updatedAt: Timestamp.now(),
                createdAt: editingId ? (pages.find(p => p.id === editingId)?.createdAt || Timestamp.now()) : Timestamp.now()
            });

            alert('הדף נשמר בהצלחה');
            loadPages();
            setViewMode('list');

        } catch (error) {
            console.error("Error saving page:", error);
            alert("שגיאה בשמירה: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('האם למחוק את הדף? פעולה זו אינה הפיכה.')) return;
        try {
            await deleteDoc(doc(db, 'landingPages', id));
            loadPages();
        } catch (error) {
            alert("שגיאה במחיקה");
        }
    };

    const addButton = () => {
        setFormData(prev => ({
            ...prev,
            buttons: [...prev.buttons, { label: 'כפתור חדש', url: '', color: '#ea580c', textColor: '#ffffff' }]
        }));
    };

    const removeButton = (index) => {
        setFormData(prev => ({
            ...prev,
            buttons: prev.buttons.filter((_, i) => i !== index)
        }));
    };

    const updateButton = (index, field, value) => {
        const newButtons = [...formData.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        setFormData(prev => ({ ...prev, buttons: newButtons }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (limit to ~800KB to be safe for Firestore 1MB limit)
            if (file.size > 800 * 1024) {
                alert('התמונה גדולה מדי. אנא בחר תמונה קטנה מ-800KB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, imageUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const copyLink = (slug) => {
        const url = `${window.location.origin}/p/${slug}`;
        navigator.clipboard.writeText(url);
        alert(`הקישור הועתק: ${url}`);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>דפי נחיתה וקישורים</h2>
                {viewMode === 'list' && (
                    <button onClick={handleCreate} className="btn btn-primary" style={{ width: 'auto' }}>
                        <Plus size={20} />
                        דף חדש
                    </button>
                )}
            </div>

            {viewMode === 'list' ? (
                <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {pages.map(page => (
                        <div key={page.id} className="card" style={{ padding: '20px', position: 'relative', borderTop: `4px solid ${page.backgroundColor || '#e2e8f0'}`, background: 'white' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>{page.title}</h3>
                                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>
                                        /p/{page.id}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {page.logoUrl && <img src={page.logoUrl} alt="Logo" style={{ height: '20px' }} />}
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: page.backgroundColor || '#fff7ed', border: '1px solid #ddd' }} title="Background Color"></div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => window.open(`/p/${page.id}`, '_blank')} className="btn btn-secondary" style={{ padding: '6px', width: 'auto' }} title="צפה">
                                        <Eye size={18} />
                                    </button>
                                    <button onClick={() => copyLink(page.id)} className="btn btn-secondary" style={{ padding: '6px', width: 'auto' }} title="העתק קישור">
                                        <LinkIcon size={18} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                <button onClick={() => handleEdit(page)} className="btn btn-outline" style={{ flex: 1 }}>
                                    <PencilSimple size={18} /> ערוך
                                </button>
                                <button onClick={() => handleDelete(page.id)} className="btn btn-danger" style={{ width: 'auto', padding: '10px' }}>
                                    <Trash size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {pages.length === 0 && !loading && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                            <p>עדיין לא נוצרו דפים.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{editingId ? 'עריכת דף' : 'יצירת דף חדש'}</h3>
                        <button onClick={() => setViewMode('list')} className="btn btn-secondary" style={{ width: 'auto' }}><X size={20} /></button>
                    </div>

                    <form onSubmit={handleSave}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label className="form-label">מזהה URL (באנגלית, ללא רווחים) *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                    placeholder="dugma-le-irua"
                                    dir="ltr"
                                    required
                                />
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                    הכתובת תהיה: {window.location.origin}/p/<b>{formData.slug || '...'}</b>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">כותרת הדף *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="ערב תרבות 2026"
                                    required
                                />
                            </div>
                        </div>

                        {/* Logo and Background Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div>
                                <label className="form-label font-bold mb-2 block">לוגו עליון</label>
                                <select
                                    className="form-input w-full"
                                    value={formData.logoUrl}
                                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                >
                                    {AVAILABLE_LOGOS.map(logo => (
                                        <option key={logo.value} value={logo.value}>{logo.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label font-bold mb-2 block">צבע רקע לדף</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ position: 'relative', width: '50px', height: '40px' }}>
                                        <input
                                            type="color"
                                            value={formData.backgroundColor}
                                            onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                                            style={{
                                                width: '100%', height: '100%',
                                                opacity: 0, position: 'absolute', top: 0, left: 0, cursor: 'pointer'
                                            }}
                                        />
                                        <div style={{
                                            width: '100%', height: '100%',
                                            borderRadius: '8px',
                                            backgroundColor: formData.backgroundColor,
                                            border: '1px solid #cbd5e1',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <PencilSimple size={16} color={getContrastYIQ(formData.backgroundColor)} />
                                        </div>
                                    </div>

                                    <span style={{ fontSize: '14px', fontFamily: 'monospace', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                                        {formData.backgroundColor}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label className="form-label">תיאור / תוכן (ניתן להשתמש בשורות חדשות)</label>
                            <textarea
                                className="form-input"
                                rows="5"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="הסבר קצר על מה שקורה..."
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label className="form-label">תמונה ראשית (העלה קובץ או הדבק קישור)</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <label className="btn btn-outline" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <Upload size={18} />
                                        בחר תמונה
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                        placeholder="או הוסף קישור לתמונה..."
                                        dir="ltr"
                                        style={{ flex: 1, minWidth: '200px' }}
                                    />
                                </div>
                                {formData.imageUrl && (
                                    <div style={{ position: 'relative', width: 'fit-content' }}>
                                        <img src={formData.imageUrl} alt="preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, imageUrl: '' })}
                                            style={{ position: 'absolute', top: -10, right: -10, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>כפתורים וקישורים</label>
                                <button type="button" onClick={addButton} className="btn btn-secondary" style={{ width: 'auto', fontSize: '14px', padding: '6px 12px' }}><Plus size={14} /> הוסף כפתור</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {formData.buttons.map((btn, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '250px', display: 'grid', gap: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={btn.label}
                                                    onChange={(e) => updateButton(idx, 'label', e.target.value)}
                                                    placeholder="טקסט כפתור"
                                                />
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={btn.url}
                                                    onChange={(e) => updateButton(idx, 'url', e.target.value)}
                                                    placeholder="כתובת יעד (URL)"
                                                    dir="ltr"
                                                />
                                            </div>

                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>רקע:</span>
                                                    <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                                                        <input
                                                            type="color"
                                                            value={btn.color || '#ea580c'}
                                                            onChange={(e) => updateButton(idx, 'color', e.target.value)}
                                                            style={{
                                                                width: '100%', height: '100%',
                                                                opacity: 0, position: 'absolute', top: 0, left: 0, cursor: 'pointer'
                                                            }}
                                                        />
                                                        <div style={{
                                                            width: '100%', height: '100%',
                                                            borderRadius: '50%',
                                                            backgroundColor: btn.color || '#ea580c',
                                                            border: '2px solid #fff',
                                                            boxShadow: '0 0 0 1px #cbd5e1'
                                                        }}
                                                        />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>טקסט:</span>
                                                    <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                                                        <input
                                                            type="color"
                                                            value={btn.textColor || '#ffffff'}
                                                            onChange={(e) => updateButton(idx, 'textColor', e.target.value)}
                                                            style={{
                                                                width: '100%', height: '100%',
                                                                opacity: 0, position: 'absolute', top: 0, left: 0, cursor: 'pointer'
                                                            }}
                                                        />
                                                        <div style={{
                                                            width: '100%', height: '100%',
                                                            borderRadius: '50%',
                                                            backgroundColor: btn.textColor || '#ffffff',
                                                            border: '2px solid #cbd5e1',
                                                            boxShadow: '0 0 0 1px #fff'
                                                        }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Preview Button */}
                                                <div style={{
                                                    background: btn.color || '#ea580c',
                                                    color: btn.textColor || '#ffffff',
                                                    padding: '8px 20px',
                                                    borderRadius: '50px',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold',
                                                    marginLeft: 'auto',
                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                                    transition: 'all 0.2s',
                                                    opacity: 1
                                                }}>
                                                    {btn.label || 'תצוגה מקדימה'}
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeButton(idx)} className="btn btn-danger" style={{ width: 'auto', padding: '10px', alignSelf: 'center' }}>
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                ))}
                                {formData.buttons.length === 0 && <div style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>אין כפתורים מוגדרים</div>}
                            </div>
                        </div>

                        <div style={{ marginTop: '30px', display: 'flex', gap: '12px' }}>
                            <button type="submit" className="btn btn-primary">שמור שינויים</button>
                            <button type="button" onClick={() => setViewMode('list')} className="btn btn-secondary">ביטול</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

// Helper to calculate text color based on background
function getContrastYIQ(hexcolor) {
    hexcolor = hexcolor?.replace('#', '') || 'ffffff';
    var r = parseInt(hexcolor.substr(0, 2), 16);
    var g = parseInt(hexcolor.substr(2, 2), 16);
    var b = parseInt(hexcolor.substr(4, 2), 16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

export default ManageLandingPages;
