import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, doc, deleteDoc, updateDoc, query, orderBy, deleteField, where } from 'firebase/firestore';
import { PenNib, Plus, Trash, Eye, Printer, X, Users, WarningCircle } from '@phosphor-icons/react';

function ManageSignatures({ userRole }) {
    const [documents, setDocuments] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewDoc, setViewDoc] = useState(null);
    const [editingDocId, setEditingDocId] = useState(null);
    
    // Search and Sort
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('status');
    const [sortDirection, setSortDirection] = useState('asc');

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [additionalPhones, setAdditionalPhones] = useState('');
    const [documentAdminsStr, setDocumentAdminsStr] = useState('');

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
                let q;
                if (userRole === 'document_admin' && auth.currentUser?.email) {
                    q = query(collection(db, 'documents_for_signature'), where('documentAdmins', 'array-contains', auth.currentUser.email));
                } else {
                    q = query(collection(db, 'documents_for_signature'), orderBy('createdAt', 'desc'));
                }
                const snapshot = await getDocs(q);
                docsList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                if (userRole === 'document_admin') {
                    docsList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                }
            } catch (idxErr) {
                const fallbackSnap = await getDocs(collection(db, 'documents_for_signature'));
                docsList = fallbackSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                if (userRole === 'document_admin' && auth.currentUser?.email) {
                    docsList = docsList.filter(d => d.documentAdmins && d.documentAdmins.includes(auth.currentUser.email));
                }
                docsList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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

    const buildAllowedUsersMap = (groups, extraPhonesStr, oldMap = {}) => {
        const newMap = {};
        const oldUsersList = Object.entries(oldMap).map(([phone, data]) => ({ phone, ...data }));
        
        if (groups && groups.length > 0) {
            allUsers.forEach(u => {
                if (u.phone && u.groups && u.groups.some(g => groups.includes(g))) {
                    const cleanPhone = u.phone.trim().replace(/\D/g, '');
                    if (cleanPhone) {
                        const name = u.displayName || u.name || u.firstName || 'ללא שם';
                        let oldData = oldMap[cleanPhone];
                        if (!oldData) {
                            const byName = oldUsersList.find(oldU => oldU.name === name);
                            if (byName) oldData = byName;
                        }
                        newMap[cleanPhone] = {
                            name: name,
                            status: oldData ? oldData.status : 'pending',
                            timestamp: oldData ? oldData.timestamp : null,
                            signatureDataUrl: oldData ? oldData.signatureDataUrl : null
                        };
                    }
                }
            });
        }

        const extraPhones = (extraPhonesStr || '').split(',').map(p => p.trim().replace(/\D/g, '')).filter(p => p);
        extraPhones.forEach(phone => {
            if (!newMap[phone]) {
                const oldData = oldMap[phone];
                newMap[phone] = {
                    name: oldData ? oldData.name : 'משתמש חיצוני',
                    status: oldData ? oldData.status : 'pending',
                    timestamp: oldData ? oldData.timestamp : null,
                    signatureDataUrl: oldData ? oldData.signatureDataUrl : null
                };
            }
        });

        return newMap;
    };

    const handleSaveDocument = async (e) => {
        e.preventDefault();
        if (!title || !content || (selectedGroups.length === 0 && !additionalPhones)) {
            alert('נא למלא את כל השדות ולבחור קבוצה או להזין טלפון');
            return;
        }

        const oldMap = editingDocId ? documents.find(d => d.id === editingDocId)?.allowedUsers || {} : {};
        const allowedUsersMap = buildAllowedUsersMap(selectedGroups, additionalPhones, oldMap);

        if (Object.keys(allowedUsersMap).length === 0) {
            alert('לא נמצאו משתמשים בעלי מספר טלפון תקין בקבוצות שנבחרו.');
            return;
        }

        const documentAdmins = documentAdminsStr.split(',').map(email => email.trim().toLowerCase()).filter(email => email);

        try {
            if (editingDocId) {
                await updateDoc(doc(db, 'documents_for_signature', editingDocId), {
                    title,
                    content,
                    allowedUsers: allowedUsersMap,
                    selectedGroups,
                    additionalPhones,
                    documentAdmins
                });
                alert('המסמך והמשתמשים עודכנו בהצלחה!');
            } else {
                await addDoc(collection(db, 'documents_for_signature'), {
                    title,
                    content,
                    allowedUsers: allowedUsersMap,
                    selectedGroups,
                    additionalPhones,
                    documentAdmins,
                    createdAt: serverTimestamp()
                });
                alert('מסמך נוסף בהצלחה!');
            }

            setTitle('');
            setContent('');
            setSelectedGroups([]);
            setAdditionalPhones('');
            setDocumentAdminsStr('');
            setShowAddForm(false);
            setEditingDocId(null);
            fetchDocumentsAndUsers();
        } catch (error) {
            console.error('Error saving document:', error);
            alert('שגיאה בשמירת המסמך');
        }
    };

    const handleEdit = (docData) => {
        setEditingDocId(docData.id);
        setTitle(docData.title || '');
        setContent(docData.content || '');
        setSelectedGroups(docData.selectedGroups || []);
        setAdditionalPhones(docData.additionalPhones || '');
        setDocumentAdminsStr(docData.documentAdmins ? docData.documentAdmins.join(', ') : '');
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const handleDeleteSignature = async (docId, phone) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק חתימה זו? המשתמש יוכל לחתום מחדש.')) return;
        
        try {
            const docRef = doc(db, 'documents_for_signature', docId);
            const fieldPrefix = `allowedUsers.${phone}`;
            await updateDoc(docRef, {
                [`${fieldPrefix}.signatureDataUrl`]: null,
                [`${fieldPrefix}.timestamp`]: null,
                [`${fieldPrefix}.status`]: 'pending'
            });

            setDocuments(prev => {
                const updatedDocs = prev.map(d => {
                    if (d.id === docId) {
                        const newAllowedUsers = { ...d.allowedUsers };
                        newAllowedUsers[phone] = {
                            ...newAllowedUsers[phone],
                            signatureDataUrl: null,
                            timestamp: null,
                            status: 'pending'
                        };
                        const updatedDoc = { ...d, allowedUsers: newAllowedUsers };
                        setViewDoc(current => current && current.id === docId ? updatedDoc : current);
                        return updatedDoc;
                    }
                    return d;
                });
                return updatedDocs;
            });
        } catch (error) {
            console.error('Error deleting signature:', error);
            alert('שגיאה במחיקת החתימה');
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

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleApproveNameChange = async (req) => {
        if (!window.confirm(`האם לאשר את שינוי השם מ-"${req.oldName}" ל-"${req.newName}"?`)) return;
        try {
            // Update user globally
            const q = query(collection(db, 'users'), where('phone', '==', req.phone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                await updateDoc(userDoc.ref, {
                    name: req.newName,
                    displayName: req.newName,
                    firstName: req.newName,
                    lastName: ''
                });
            }

            // Update document
            const docRef = doc(db, 'documents_for_signature', req.docId);
            await updateDoc(docRef, {
                [`allowedUsers.${req.phone}.name`]: req.newName,
                [`allowedUsers.${req.phone}.status`]: 'signed',
                [`allowedUsers.${req.phone}.requestedName`]: deleteField()
            });

            if (viewDoc && viewDoc.id === req.docId) {
                const newAllowedUsers = { ...viewDoc.allowedUsers };
                newAllowedUsers[req.phone] = {
                    ...newAllowedUsers[req.phone],
                    name: req.newName,
                    status: 'signed'
                };
                delete newAllowedUsers[req.phone].requestedName;
                setViewDoc({ ...viewDoc, allowedUsers: newAllowedUsers });
            }

            fetchDocumentsAndUsers();
            alert('השם שונה והחתימה אושרה בהצלחה!');
        } catch (error) {
            console.error('Error approving name change:', error);
            alert('שגיאה באישור שינוי השם');
        }
    };

    const filteredAndSortedUsers = viewDoc ? Object.entries(viewDoc.allowedUsers || {})
        .map(([phone, data]) => ({ phone, ...data }))
        .filter(user => {
            const search = searchQuery.toLowerCase();
            return (
                (user.name || '').toLowerCase().includes(search) ||
                (user.phone || '').toLowerCase().includes(search) ||
                (user.status === 'signed' ? 'חתם' : user.status === 'viewed' ? 'נכנס ולא חתם' : 'לא נכנס').includes(search)
            );
        })
        .sort((a, b) => {
            if (sortField === 'status') {
                const statusOrder = { signed: 1, name_change_pending: 2, viewed: 3, pending: 4 };
                const aStat = statusOrder[a.status] || 5;
                const bStat = statusOrder[b.status] || 5;
                
                if (aStat !== bStat) return sortDirection === 'asc' ? aStat - bStat : bStat - aStat;
                
                const aTime = a.timestamp || 0;
                const bTime = b.timestamp || 0;
                if (aTime !== bTime) return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
                
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();
                if (aName < bName) return sortDirection === 'asc' ? -1 : 1;
                if (aName > bName) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            }

            let aVal = a[sortField] || '';
            let bVal = b[sortField] || '';
            
            if (sortField === 'timestamp') {
                aVal = a.timestamp || 0;
                bVal = b.timestamp || 0;
            } else if (sortField === 'name') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        }) : [];

    const allPendingRequests = [];
    documents.forEach(doc => {
        if (doc.allowedUsers) {
            Object.entries(doc.allowedUsers).forEach(([phone, data]) => {
                if (data.status === 'name_change_pending') {
                    allPendingRequests.push({
                        docId: doc.id,
                        docTitle: doc.title,
                        phone,
                        oldName: data.name,
                        newName: data.requestedName,
                        signatureDataUrl: data.signatureDataUrl,
                        timestamp: data.timestamp
                    });
                }
            });
        }
    });

    return (
        <div>
            {allPendingRequests.length > 0 && (
                <div className="card mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#b45309', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <WarningCircle size={24} weight="fill" /> בקשות לאישור שינוי שם
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {allPendingRequests.map((req, idx) => (
                            <div key={idx} style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#92400e', marginBottom: '4px' }}>{req.oldName} ביקש לשנות את שמו ל-"{req.newName}"</div>
                                    <div style={{ color: '#b45309', fontSize: '0.9rem' }}>מסמך: {req.docTitle} • טלפון: {req.phone}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {req.signatureDataUrl && <img src={req.signatureDataUrl} alt="Signature" style={{ height: '40px', maxWidth: '100px', objectFit: 'contain' }} />}
                                    <button className="btn btn-primary" onClick={() => handleApproveNameChange(req)} style={{ background: '#d97706', border: 'none' }}>
                                        אשר שינוי שם וחתימה
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View Document Modal (and print view) */}
            {viewDoc && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .modal-overlay {
                                position: absolute !important;
                                display: block !important;
                                top: 0 !important; left: 0 !important;
                                right: auto !important; bottom: auto !important;
                                width: 100% !important;
                                background: white !important;
                            }
                            .modal-overlay > div {
                                display: block !important;
                                max-height: none !important;
                                height: auto !important;
                                width: 100% !important;
                                overflow: visible !important;
                                border-radius: 0 !important;
                                box-shadow: none !important;
                            }
                            .print-area, .print-area * {
                                visibility: visible;
                            }
                            .print-area {
                                position: relative !important;
                                overflow: visible !important;
                                padding: 0 !important;
                                height: auto !important;
                            }
                            .no-print, .no-print * {
                                display: none !important;
                            }
                            .hide-on-print {
                                display: none !important;
                            }
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
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0 }}>
                                    מעקב משתמשים וחתימות
                                </h3>
                                <div className="no-print" style={{ display: 'flex', gap: '16px' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="חיפוש לפי שם, טלפון או סטטוס..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{ margin: 0, minWidth: '250px' }}
                                    />
                                </div>
                            </div>
                            
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                        <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                                            שם המשתמש <span className="no-print">{sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        </th>
                                        <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('phone')}>
                                            טלפון <span className="no-print">{sortField === 'phone' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        </th>
                                        <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('status')}>
                                            סטטוס <span className="no-print">{sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        </th>
                                        <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('timestamp')}>
                                            תאריך חתימה <span className="no-print">{sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        </th>
                                        <th style={{ padding: '12px' }}>חתימה</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndSortedUsers.map((data) => (
                                        <tr key={data.phone} className={data.status !== 'signed' ? 'hide-on-print' : ''} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{data.name}</td>
                                            <td style={{ padding: '12px' }} dir="ltr">{data.phone}</td>
                                            <td style={{ padding: '12px' }}>
                                                {data.status === 'signed' && <span style={{ color: '#15803d', fontWeight: 'bold', background: '#dcfce7', padding: '4px 8px', borderRadius: '12px' }}>חתם</span>}
                                                {data.status === 'name_change_pending' && <span style={{ color: '#b45309', fontWeight: 'bold', background: '#fef3c7', padding: '4px 8px', borderRadius: '12px' }}>ממתין לאישור שם</span>}
                                                {data.status === 'viewed' && <span style={{ color: '#b45309', fontWeight: 'bold', background: '#fef3c7', padding: '4px 8px', borderRadius: '12px' }}>נכנס ולא חתם</span>}
                                                {data.status === 'pending' && <span style={{ color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '12px' }}>לא נכנס</span>}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {data.timestamp ? new Date(data.timestamp).toLocaleString('he-IL') : '-'}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {data.signatureDataUrl ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <img src={data.signatureDataUrl} alt="Signature" style={{ height: '40px', maxWidth: '150px', objectFit: 'contain' }} />
                                                        <button className="btn no-print" onClick={() => handleDeleteSignature(viewDoc.id, data.phone)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="מחק חתימה">
                                                            <Trash size={16} />
                                                        </button>
                                                    </div>
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

            {userRole !== 'document_admin' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                    <button className="btn btn-primary" onClick={() => {
                        setTitle('');
                        setContent('');
                        setSelectedGroups([]);
                        setAdditionalPhones('');
                        setDocumentAdminsStr('');
                        setEditingDocId(null);
                        setShowAddForm(true);
                    }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={20} /> הוסף מסמך חדש
                    </button>
                </div>
            )}

            {showAddForm && (
                <div className="card mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: '16px' }}>{editingDocId ? 'עריכת מסמך' : 'יצירת מסמך חדש לחתימה לפי קבוצות'}</h3>
                    <form onSubmit={handleSaveDocument}>
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

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label className="form-label" style={{ fontWeight: 'bold' }}>מנהלי מסמך (כתובות אימייל מופרדות בפסיק)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="דוגמה: admin1@example.com, user2@example.com"
                                value={documentAdminsStr}
                                onChange={(e) => setDocumentAdminsStr(e.target.value)}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>המשתמשים הללו יוכלו להתחבר עם שם משתמש וסיסמה ולנהל את המסמך</span>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 32px' }}>
                            {editingDocId ? 'שמור שינויים' : 'צור מסמך ושלח לקבוצות'}
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
                    {documents.filter(d => userRole !== 'document_admin' || d.admins?.includes(userEmail)).map(docData => {
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
                                    <button className="btn btn-secondary" style={{ width: '40px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleEdit(docData)} title="ערוך מסמך">
                                        <PenNib size={20} style={{ flexShrink: 0 }} />
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
