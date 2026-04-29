import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { PenNib, Plus, Trash, Eye, Printer, X, Users } from '@phosphor-icons/react';

function ManageSignatures() {
    const [documents, setDocuments] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewDoc, setViewDoc] = useState(null);

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [additionalPhones, setAdditionalPhones] = useState('');

    useEffect(() => {
        fetchDocumentsAndUsers();
    }, []);

    const fetchDocumentsAndUsers = async () => {
        setLoading(true);
        try {
            // Fetch users for groups
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllUsers(usersList);

            // Extract unique groups
            const groupsSet = new Set();
            usersList.forEach(u => {
                if (u.groups && Array.isArray(u.groups)) {
                    u.groups.forEach(g => groupsSet.add(g));
                }
            });
            setAvailableGroups(Array.from(groupsSet).sort());

            // Fetch documents
            let docsList = [];
            try {
                const q = query(collection(db, 'documents_for_signature'), orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                docsList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            } catch (idxErr) {
                const fallbackSnap = await getDocs(collection(db, 'documents_for_signature'));
                docsList = fallbackSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            }
            setDocuments(docsList);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleGroup = (group) => {
        if (selectedGroups.includes(group)) {
            setSelectedGroups(selectedGroups.filter(g => g !== group));
        } else {
            setSelectedGroups([...selectedGroups, group]);
        }
    };

    const handleAddDocument = async (e) => {
        e.preventDefault();
        if (!title || !content || (selectedGroups.length === 0 && !additionalPhones)) {
            alert('נא למלא את כל השדות ולבחור קבוצה או להזין טלפון');
            return;
        }

        // Build allowed users map
        const allowedUsersMap = {};

        // 1. Add users from selected groups
        if (selectedGroups.length > 0) {
            allUsers.forEach(u => {
                if (u.phone && u.groups && u.groups.some(g => selectedGroups.includes(g))) {
                    const cleanPhone = u.phone.trim().replace(/\D/g, '');
                    if (cleanPhone) {
                        allowedUsersMap[cleanPhone] = {
                            name: u.displayName || u.name || u.firstName || 'ללא שם',
                            status: 'pending',
                            timestamp: null,
                            signatureDataUrl: null
                        };
                    }
                }
            });
        }

        // 2. Add additional phones manually
        const extraPhones = additionalPhones.split(',').map(p => p.trim().replace(/\D/g, '')).filter(p => p);
        extraPhones.forEach(phone => {
            if (!allowedUsersMap[phone]) {
                allowedUsersMap[phone] = {
                    name: 'משתמש חיצוני',
                    status: 'pending',
                    timestamp: null,
                    signatureDataUrl: null
                };
            }
        });

        if (Object.keys(allowedUsersMap).length === 0) {
            alert('לא נמצאו משתמשים בעלי מספר טלפון תקין בקבוצות שנבחרו.');
            return;
        }

        try {
            await addDoc(collection(db, 'documents_for_signature'), {
                title,
                content,
                allowedUsers: allowedUsersMap,
                createdAt: serverTimestamp()
            });

            setTitle('');
            setContent('');
            setSelectedGroups([]);
            setAdditionalPhones('');
            setShowAddForm(false);
            fetchDocumentsAndUsers();
            alert('מסמך נוסף בהצלחה!');
        } catch (error) {
            console.error('Error adding document:', error);
            alert('שגיאה ביצירת מסמך');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק מסמך זה?')) return;
        try {
            await deleteDoc(doc(db, 'documents_for_signature', id));
            setDocuments(prev => prev.filter(d => d.id !== id));
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('שגיאה במחיקת המסמך');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Helper for table stats
    const getStats = (allowedUsersMap) => {
        if (!allowedUsersMap) return { total: 0, signed: 0, viewed: 0, pending: 0 };
        const users = Object.values(allowedUsersMap);
        return {
            total: users.length,
            signed: users.filter(u => u.status === 'signed').length,
            viewed: users.filter(u => u.status === 'viewed').length,
            pending: users.filter(u => u.status === 'pending').length,
        };
    };

    return (
        <div>
            {/* View Document Modal (and print view) */}
            {viewDoc && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <style>{`
                        @media print {
                            body * { display: none; }
                            .print-area, .print-area * { display: block; visibility: visible; }
                            .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <div style={{ background: 'white', width: '90%', maxWidth: '1000px', maxHeight: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>פרטי מסמך, קבוצות ומעקב חתימות</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                    <Printer size={20} /> הדפס מסמך (עם חתימות)
                                </button>
                                <button className="btn" onClick={() => setViewDoc(null)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={20} style={{ flexShrink: 0 }} />
                                </button>
                            </div>
                        </div>

                        <div className="print-area" style={{ padding: '32px', overflowY: 'auto' }}>
                            <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>{viewDoc.title}</h1>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '40px', fontSize: '1.1rem' }}>
                                {viewDoc.content}
                            </div>
                            
                            <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                                מעקב משתמשים וחתימות
                            </h3>
                            
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                        <th style={{ padding: '12px' }}>שם המשתמש</th>
                                        <th style={{ padding: '12px' }}>טלפון</th>
                                        <th style={{ padding: '12px' }}>סטטוס</th>
                                        <th style={{ padding: '12px' }}>תאריך חתימה</th>
                                        <th style={{ padding: '12px' }}>חתימה דיגיטלית</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(viewDoc.allowedUsers || {}).map(([phone, data]) => (
                                        <tr key={phone} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{data.name}</td>
                                            <td style={{ padding: '12px' }} dir="ltr">{phone}</td>
                                            <td style={{ padding: '12px' }}>
                                                {data.status === 'signed' && <span style={{ color: '#15803d', fontWeight: 'bold', background: '#dcfce7', padding: '4px 8px', borderRadius: '12px' }}>חתם</span>}
                                                {data.status === 'viewed' && <span style={{ color: '#b45309', fontWeight: 'bold', background: '#fef3c7', padding: '4px 8px', borderRadius: '12px' }}>נכנס ולא חתם</span>}
                                                {data.status === 'pending' && <span style={{ color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '12px' }}>לא נכנס</span>}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {data.timestamp ? new Date(data.timestamp).toLocaleString('he-IL') : '-'}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {data.signatureDataUrl ? (
                                                    <img src={data.signatureDataUrl} alt="Signature" style={{ height: '40px', maxWidth: '150px', objectFit: 'contain' }} />
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PenNib size={28} color="var(--primary-color)" /> מסמכים לחתימה
                </h2>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {showAddForm ? <X size={20} /> : <Plus size={20} />} {showAddForm ? 'ביטול' : 'צור מסמך חדש'}
                </button>
            </div>

            {showAddForm && (
                <div className="card mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: '16px' }}>יצירת מסמך חדש לחתימה לפי קבוצות</h3>
                    <form onSubmit={handleAddDocument}>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="form-label">כותרת המסמך</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                required 
                                placeholder="לדוגמה: הסכם שימוש בבריכה"
                            />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="form-label">תוכן המסמך</label>
                            <textarea 
                                className="form-input" 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                required 
                                rows={6}
                                placeholder="הזן את פרטי המסמך עליו המשתמשים צריכים לחתום..."
                            />
                        </div>
                        
                        <div style={{ marginBottom: '16px', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Users size={20} /> בחירת קבוצות משתמשים (נשלפים מניהול משתמשים)
                            </label>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                                {availableGroups.length > 0 ? availableGroups.map(group => (
                                    <label key={group} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: selectedGroups.includes(group) ? '#e0e7ff' : '#f1f5f9', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${selectedGroups.includes(group) ? '#818cf8' : '#cbd5e1'}` }}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedGroups.includes(group)}
                                            onChange={() => handleToggleGroup(group)}
                                            style={{ margin: 0, width: '18px', height: '18px' }}
                                        />
                                        <span style={{ fontWeight: selectedGroups.includes(group) ? 'bold' : 'normal', color: selectedGroups.includes(group) ? '#3730a3' : '#334155' }}>
                                            {group}
                                        </span>
                                    </label>
                                )) : <span style={{ color: '#64748b' }}>לא נמצאו קבוצות מוגדרות במערכת. תוכל להוסיף קבוצות למשתמשים במסך "ניהול משתמשים".</span>}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="form-label">או - הוסף טלפונים באופן ידני (מופרדים בפסיק)</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={additionalPhones} 
                                onChange={e => setAdditionalPhones(e.target.value)} 
                                placeholder="0501234567, 0527654321..."
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 32px' }}>
                            צור מסמך ושלח לקבוצות
                        </button>
                    </form>
                </div>
            )}

            {loading ? (
                <div>טוען מסמכים...</div>
            ) : documents.length === 0 ? (
                <div className="card text-center" style={{ padding: '40px', color: '#64748b' }}>
                    אין מסמכים לחתימה כרגע.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                    {documents.map(docData => {
                        const stats = getStats(docData.allowedUsers);
                        const link = `${window.location.origin}/sign/${docData.id}`;

                        return (
                            <div key={docData.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{docData.title}</h3>
                                    <span style={{ background: stats.signed === stats.total && stats.total > 0 ? '#dcfce7' : '#f1f5f9', color: stats.signed === stats.total && stats.total > 0 ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        {stats.signed}/{stats.total} חתמו
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '8px' }}>{stats.signed} חתמו</span>
                                    <span style={{ color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '8px' }}>{stats.viewed} צפו</span>
                                    <span style={{ color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px' }}>{stats.pending} טרם נכנסו</span>
                                </div>

                                <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    <strong>לינק לחתימה:</strong>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <input type="text" readOnly value={link} className="form-input" style={{ margin: 0, padding: '4px 8px', height: 'auto' }} />
                                        <button className="btn btn-secondary" style={{ padding: '4px 12px', width: 'auto' }} onClick={() => { navigator.clipboard.writeText(link); alert('לינק הועתק'); }}>העתק</button>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                    <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#f8fafc', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }} onClick={() => setViewDoc(docData)}>
                                        <Eye size={20} /> טבלת חתימות
                                    </button>
                                    <button className="btn" style={{ width: '40px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDelete(docData.id)} title="מחק">
                                        <Trash size={20} style={{ flexShrink: 0 }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ManageSignatures;
