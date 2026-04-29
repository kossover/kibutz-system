import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { PenNib, Plus, Trash, Eye, Printer, X } from '@phosphor-icons/react';

function ManageSignatures() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewDoc, setViewDoc] = useState(null);

    // Form states
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [phones, setPhones] = useState('');

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'documents_for_signature'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const docsList = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            }));
            setDocuments(docsList);
        } catch (error) {
            console.error('Error fetching documents:', error);
            // Fallback if index missing
            const fallbackSnap = await getDocs(collection(db, 'documents_for_signature'));
            const docsList = fallbackSnap.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setDocuments(docsList);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDocument = async (e) => {
        e.preventDefault();
        if (!title || !content || !phones) {
            alert('נא למלא את כל השדות');
            return;
        }

        const phonesArray = phones.split(',').map(p => p.trim()).filter(p => p);

        try {
            await addDoc(collection(db, 'documents_for_signature'), {
                title,
                content,
                allowedPhones: phonesArray,
                signees: [],
                createdAt: serverTimestamp()
            });

            setTitle('');
            setContent('');
            setPhones('');
            setShowAddForm(false);
            fetchDocuments();
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
                    <div style={{ background: 'white', width: '90%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>פרטי מסמך וחתימות</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                    <Printer size={20} /> הדפס מסמך
                                </button>
                                <button className="btn" onClick={() => setViewDoc(null)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="print-area" style={{ padding: '32px', overflowY: 'auto' }}>
                            <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>{viewDoc.title}</h1>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '40px', fontSize: '1.1rem' }}>
                                {viewDoc.content}
                            </div>
                            
                            <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>חתימות ({viewDoc.signees?.length || 0} מתוך {viewDoc.allowedPhones?.length || 0})</h3>
                            
                            {viewDoc.signees && viewDoc.signees.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                    {viewDoc.signees.map((signee, idx) => (
                                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{signee.phone}</div>
                                            {signee.signatureDataUrl && (
                                                <img src={signee.signatureDataUrl} alt="Signature" style={{ width: '100%', maxHeight: '100px', objectFit: 'contain', background: '#f8fafc', borderRadius: '4px' }} />
                                            )}
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>
                                                {new Date(signee.timestamp).toLocaleString('he-IL')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: '#64748b' }}>טרם נחתם על ידי אף אחד.</p>
                            )}

                            <div className="no-print" style={{ marginTop: '32px' }}>
                                <h4>מורשים שטרם חתמו:</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {viewDoc.allowedPhones?.filter(p => !viewDoc.signees?.find(s => s.phone === p)).map(p => (
                                        <span key={p} style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '16px', fontSize: '0.9rem' }}>{p}</span>
                                    ))}
                                </div>
                            </div>
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
                    <h3 style={{ marginBottom: '16px' }}>יצירת מסמך חדש לחתימה</h3>
                    <form onSubmit={handleAddDocument}>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="form-label">כותרת המסמך</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                required 
                                placeholder="לדוגמה: אישור קבלת מחשב נייד"
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
                        <div style={{ marginBottom: '24px' }}>
                            <label className="form-label">טלפונים מורשים (מופרדים בפסיק)</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={phones} 
                                onChange={e => setPhones(e.target.value)} 
                                required 
                                placeholder="0501234567, 0527654321..."
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 32px' }}>
                            צור מסמך
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {documents.map(doc => {
                        const signCount = doc.signees?.length || 0;
                        const totalCount = doc.allowedPhones?.length || 0;
                        const link = `${window.location.origin}/sign/${doc.id}`;

                        return (
                            <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{doc.title}</h3>
                                    <span style={{ background: signCount === totalCount ? '#dcfce7' : '#f1f5f9', color: signCount === totalCount ? '#166534' : '#475569', padding: '4px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        {signCount}/{totalCount} חתמו
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {doc.content}
                                </p>
                                
                                <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    <strong>לינק לחתימה:</strong>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <input type="text" readOnly value={link} className="form-input" style={{ margin: 0, padding: '4px 8px', height: 'auto' }} />
                                        <button className="btn btn-secondary" style={{ padding: '4px 12px', width: 'auto' }} onClick={() => { navigator.clipboard.writeText(link); alert('לינק הועתק'); }}>העתק</button>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                    <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#f8fafc', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }} onClick={() => setViewDoc(doc)}>
                                        <Eye size={20} /> צפה בחתימות
                                    </button>
                                    <button className="btn" style={{ width: '40px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDelete(doc.id)} title="מחק">
                                        <Trash size={20} />
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
