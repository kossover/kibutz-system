import { useState, useRef, useEffect } from 'react';
import {
    Images,
    FileText,
    FileZip,
    FolderPlus,
    Spinner,
    Trash,
    MagicWand,
    X,
    Eye,
    FloppyDisk,
    TextAa,
    Copy,
    BracketsCurly,
    CheckCircle,
    Archive
} from '@phosphor-icons/react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { db, storage } from '../../firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, doc as firestoreDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const getPastelColor = (name) => {
    if (!name) return '#f8fafc';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 60%, 90%)`;
};

// Config PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const aiPromptText = `אתה מומחה לארכיונאות, היסטוריה ופענוח טקסטים (OCR). אני אעלה לך מסמכים היסטוריים סרוקים (כתובים במכונת כתיבה או בכתב יד) מתוך ארכיון. המשימה שלך היא לתמלל את המסמכים בצורה המדויקת ביותר ולחלץ מהם מטא-דאטה. עליך להחזיר את התשובה אך ורק בפורמט JSON תקין, **השתמש בפיצ'ר ה-Canvas (פתח Canvas חדש)** כדי לכתוב בתוכו את ה-JSON, ללא כל טקסט מקדים או מסכם בתגובה עצמה. אל תוסיף הסברים, רק את ה-JSON בתוך ה-Canvas. אם נתונים מסוימים חסרים (כמו תאריך או מחבר), ציין "לא צוין" או השאר כשדה ריק (null), אך אל תמציא מידע. תקן שגיאות כתיב ברורות שנובעות מהדפסה משובשת, אך שמור על רוח התקופה והשפה המקורית. המבנה הנדרש של ה-JSON עבור כל מסמך (במידה ויש מספר מסמכים, החזר מערך של אובייקטים):
[
  {
    "fileName": "שם_הקובץ_או_התמונה.pdf",
    "metadata": {
      "title": "כותרת קצרה וברורה שתשמש לשם המסמך בארכיון",
      "author": "הגוף, הועדה או האדם שכתב את המסמך",
      "date": "תאריך לועזי בפורמט DD.MM.YYYY (אם קיים)",
      "hebrewDate": "תאריך עברי (אם קיים)",
      "year": 1948,
      "location": "המקום בו נכתב המסמך או אליו הוא משויך",
      "summary": "תקציר של 2-3 משפטים המתאר את התוכן והנושאים המרכזיים של המסמך",
      "tags": ["תגית1", "תגית2", "תגית3"]
    },
    "fullTranscription": "התמלול המלא והמדויק של המסמך. שמור על חלוקה הגיונית לפסקאות והשתמש בתווי ירידת שורה (\\n) היכן שצריך."
  }
]`;

function ManageDocuments() {
    const [documents, setDocuments] = useState([]); // array of { id, name, type, url, text }
    const [isLoading, setIsLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [jsonInput, setJsonInput] = useState('');
    const [archivedDocs, setArchivedDocs] = useState([]);
    const [isFetchingArchive, setIsFetchingArchive] = useState(false);
    const [archiveSortMode, setArchiveSortMode] = useState('uploadDate');
    const [editingArchivedDoc, setEditingArchivedDoc] = useState(null);

    const fetchArchivedDocs = async () => {
        setIsFetchingArchive(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'archive_documents'));
            const docsList = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    isArchived: true, // Special flag for the editor
                    name: data.originalFileName || 'מסמך',
                    url: data.fileUrl,
                    type: data.fileType || 'image',
                    status: data.status || 'draft'
                };
            });
            // Sort by createdAt desc
            docsList.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
            setArchivedDocs(docsList);
        } catch (error) {
            console.error("Error fetching archived docs:", error);
        } finally {
            setIsFetchingArchive(false);
        }
    };

    useEffect(() => {
        fetchArchivedDocs();
    }, []);

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const zipInputRef = useRef(null);

    const processFiles = async (filesList) => {
        setIsLoading(true);
        const newDocs = [];

        for (let i = 0; i < filesList.length; i++) {
            const file = filesList[i];

            // Allow images and PDFs
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                const url = URL.createObjectURL(file);
                newDocs.push({
                    id: `doc_${Date.now()}_${i}`,
                    name: file.name,
                    type: file.type.startsWith('image/') ? 'image' : 'pdf',
                    url: url,
                    text: '', // For future AI transcription
                    file: file
                });
            }
        }

        setDocuments(prev => [...prev, ...newDocs]);
        setIsLoading(false);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleFolderChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleZipUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const extractedFiles = [];

            for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if (zipEntry.dir) continue;

                const lowerName = filename.toLowerCase();
                if (lowerName.match(/\.(jpeg|jpg|png|gif|webp)$/i)) {
                    const blob = await zipEntry.async("blob");
                    const extractedFile = new File([blob], filename, { type: `image/${lowerName.split('.').pop()}` });
                    extractedFiles.push(extractedFile);
                } else if (lowerName.endsWith('.pdf')) {
                    const blob = await zipEntry.async("blob");
                    const extractedFile = new File([blob], filename, { type: 'application/pdf' });
                    extractedFiles.push(extractedFile);
                }
            }

            processFiles(extractedFiles);
        } catch (error) {
            console.error("Error unzipping file:", error);
            alert("שגיאה בפתיחת קובץ ה-ZIP");
        } finally {
            setIsLoading(false);
        }
    };

    const removeDocument = (id) => {
        setDocuments(prev => {
            const docToRemove = prev.find(d => d.id === id);
            if (docToRemove && docToRemove.url) {
                URL.revokeObjectURL(docToRemove.url);
            }
            return prev.filter(d => d.id !== id);
        });
    };

    const handlePreviewChange = (field, value) => {
        setPreviewDoc(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveDoc = () => {
        if (!previewDoc) return;
        // It's a newly uploaded doc, update local state
        setDocuments(prev => prev.map(d => d.id === previewDoc.id ? previewDoc : d));
        setPreviewDoc(null);
    };

    const handleSaveArchived = async () => {
        if (!editingArchivedDoc) return;
        try {
            const docRef = firestoreDoc(db, 'archive_documents', editingArchivedDoc.id);
            await updateDoc(docRef, {
                title: editingArchivedDoc.title || '',
                date: editingArchivedDoc.date || '',
                docType: editingArchivedDoc.docType || '',
                publishingBody: editingArchivedDoc.publishingBody || '',
                signatory: editingArchivedDoc.signatory || '',
                description: editingArchivedDoc.description || '',
                text: editingArchivedDoc.text || '',
                status: editingArchivedDoc.status || 'draft'
            });
            setArchivedDocs(prev => prev.map(d => d.id === editingArchivedDoc.id ? editingArchivedDoc : d));
            setEditingArchivedDoc(null);
            alert("השינויים נשמרו בהצלחה!");
        } catch (error) {
            console.error("Error updating document:", error);
            alert("שגיאה בעדכון המסמך בארכיון.");
        }
    };

    const handleDeleteArchived = async (docId, fileUrl) => {
        if (!window.confirm("האם אתה בטוח שברצונך למחוק מסמך זה מהארכיון לצמיתות? פעולה זו לא ניתנת לביטול.")) return;
        try {
            await deleteDoc(firestoreDoc(db, 'archive_documents', docId));
            setArchivedDocs(prev => prev.filter(d => d.id !== docId));
            if (editingArchivedDoc && editingArchivedDoc.id === docId) {
                setEditingArchivedDoc(null);
            }
        } catch (err) {
            console.error(err);
            alert("שגיאה במחיקת המסמך");
        }
    };

    const sortedArchivedDocs = [...archivedDocs].sort((a, b) => {
        if (archiveSortMode === 'name') {
            return (a.title || a.name).localeCompare(b.title || b.name);
        } else if (archiveSortMode === 'docDate') {
            return (b.date || '').localeCompare(a.date || '');
        }
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
    });

    const handleSaveAllToArchive = async () => {
        if (documents.length === 0) return;

        setIsLoading(true);
        try {
            for (const doc of documents) {
                if (!doc.file) continue;

                // 1. Upload file to Storage
                const timestamp = Date.now();
                const safeName = doc.name.replace(/[^a-zA-Z0-9.\-א-ת ]/g, '_');
                const fileRef = ref(storage, `archive/documents/${timestamp}_${safeName}`);

                await uploadBytes(fileRef, doc.file);
                const downloadURL = await getDownloadURL(fileRef);

                // 2. Save metadata to Firestore
                const docData = {
                    title: doc.title || doc.name,
                    date: doc.date || '',
                    docType: doc.docType || '',
                    publishingBody: doc.publishingBody || '',
                    signatory: doc.signatory || '',
                    description: doc.description || '',
                    text: doc.text || '',
                    originalFileName: doc.name,
                    fileType: doc.type,
                    fileUrl: downloadURL,
                    status: doc.status || 'draft',
                    createdAt: serverTimestamp(),
                };

                await addDoc(collection(db, 'archive_documents'), docData);
            }

            alert('כל המסמכים המעובדים הועלו ונשמרו בארכיון בהצלחה!');
            setDocuments([]); // Clear the list after successful upload
            fetchArchivedDocs(); // Refresh the archive list

        } catch (error) {
            console.error('Error saving documents to archive:', error);
            alert('אירעה שגיאה בשמירת המסמכים לארכיון. אנא נסה שנית.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyJsonToAll = () => {
        if (!jsonInput.trim()) return;
        try {
            let parsed = JSON.parse(jsonInput.trim());
            let dataArray = Array.isArray(parsed) ? parsed : [parsed];

            setDocuments(prevDocs => {
                const updatedDocs = [...prevDocs];

                dataArray.forEach(data => {
                    if (!data.fileName) return;

                    const docIndex = updatedDocs.findIndex(d => d.name === data.fileName || d.name.includes(data.fileName) || data.fileName.includes(d.name));
                    if (docIndex === -1) return;

                    const docToUpdate = updatedDocs[docIndex];
                    const metadata = data.metadata || {};
                    const pubBody = metadata.author || (metadata.location ? metadata.author + ', ' + metadata.location : '') || '';
                    const yearStr = metadata.year ? metadata.year.toString() : '';
                    const dateStr = metadata.date || yearStr || '';
                    const tagsStr = metadata.tags && Array.isArray(metadata.tags) ? metadata.tags.join(', ') : '';
                    const descStr = metadata.summary ? metadata.summary + (tagsStr ? ' | ' + tagsStr : '') : tagsStr;

                    updatedDocs[docIndex] = {
                        ...docToUpdate,
                        title: metadata.title || docToUpdate.title || '',
                        date: dateStr || docToUpdate.date || '',
                        docType: metadata.docType || docToUpdate.docType || '',
                        publishingBody: pubBody.replace(/^,\s*/, '') || docToUpdate.publishingBody || '',
                        signatory: docToUpdate.signatory || '',
                        description: descStr || docToUpdate.description || '',
                        text: data.fullTranscription || docToUpdate.text || ''
                    };
                });

                return updatedDocs;
            });

            setJsonInput('');
            alert('הפרטים מה-JSON חולצו והוזנו לכל המסמכים התואמים בהצלחה!');
        } catch (error) {
            console.error(error);
            alert('שגיאה. אנא ודא שהקוד שהדבקת הוא בפורמט JSON תקין.');
        }
    };

    return (
        <div>
            {/* Full Screen Document Editor Modal */}
            {previewDoc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

                    <div style={{ background: 'white', width: '100%', maxWidth: '1600px', height: '95vh', borderRadius: '16px', display: 'flex', overflow: 'hidden', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <button onClick={() => setPreviewDoc(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'white', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <X size={20} weight="bold" />
                        </button>

                        {/* Left Side: Document Preview (1.5x width) */}
                        <div style={{ flex: '1.5', background: '#e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', borderLeft: '1px solid #cbd5e1' }}>
                            {previewDoc.type === 'image' ? (
                                <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            ) : (
                                <iframe src={previewDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={previewDoc.name} />
                            )}
                        </div>

                        {/* Right Side: Form and Transcription (1x width) */}
                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '32px 24px', overflowY: 'auto' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                                פיענוח וקיטלוג מסמך
                            </h3>

                            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.9rem', wordBreak: 'break-word', direction: 'ltr', textAlign: 'right' }}>
                                {previewDoc.name}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label className="form-label" style={{ fontWeight: '600' }}>כותרת המסמך</label>
                                    <input className="form-input" style={{ margin: 0 }} value={previewDoc.title || ''} onChange={(e) => handlePreviewChange('title', e.target.value)} placeholder="לדוגמה: ישיבת מזכירות 1960" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label className="form-label" style={{ fontWeight: '600' }}>שנה / תאריך</label>
                                        <input className="form-input" style={{ margin: 0 }} value={previewDoc.date || ''} onChange={(e) => handlePreviewChange('date', e.target.value)} placeholder="1960" />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontWeight: '600' }}>סוג (מכתב/תיעוד...)</label>
                                        <input className="form-input" style={{ margin: 0 }} value={previewDoc.docType || ''} onChange={(e) => handlePreviewChange('docType', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontWeight: '600' }}>תיאור פתוח (Keywords)</label>
                                    <input className="form-input" style={{ margin: 0 }} value={previewDoc.description || ''} onChange={(e) => handlePreviewChange('description', e.target.value)} placeholder="..." />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label className="form-label" style={{ fontWeight: '600' }}>הגוף שהוציא (מזכירות, גזברות...)</label>
                                        <input className="form-input" style={{ margin: 0 }} value={previewDoc.publishingBody || ''} onChange={(e) => handlePreviewChange('publishingBody', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontWeight: '600' }}>חתום ע"י</label>
                                        <input className="form-input" style={{ margin: 0 }} value={previewDoc.signatory || ''} onChange={(e) => handlePreviewChange('signatory', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                    <label className="form-label" style={{ margin: 0, fontSize: '1.1rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                                        <TextAa size={24} weight="fill" /> תמלול טקסט
                                    </label>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {/* AI JSON Paste removed from here to main UI */}
                                    </div>
                                </div>
                                <textarea
                                    className="form-input"
                                    style={{ flex: 1, margin: 0, resize: 'none', lineHeight: '1.6', fontSize: '1.1rem', backgroundColor: 'white', border: '2px solid #e2e8f0', padding: '16px' }}
                                    placeholder="אפשר להקליד ידנית את תוכן הקובץ כאן...&#10;&#10;טיפ: במידה ומבוצע מעבר אוטומטי ומילים מסוימות אינן ברורות, ה-AI יסמן אותן עבורך במרכאות אדומות בסוגריים, לדוגמה: [לא_ברור: המילה]."
                                    value={previewDoc.text || ''}
                                    onChange={(e) => handlePreviewChange('text', e.target.value)}
                                />
                            </div>

                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button className="btn btn-primary" onClick={handleSaveDoc} style={{ width: 'auto', background: '#10b981', fontSize: '1.1rem', padding: '12px 24px' }}>
                                    <FloppyDisk size={24} /> שמור שינויים למסמך זה
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ארכיון מסמכים ופענוח בינה מלאכותית</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1.1rem' }}>
                העלה תמונות מסמכים או קובצי PDF. המערכת תאפשר צפייה בהם, ובהמשך פענוח טקסט.
            </p>

            {/* Prompt Helper Info Box */}
            <div className="card mb-4" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                <div className="flex-between mb-2 flex-wrap gap-2">
                    <h3 style={{ fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <MagicWand size={20} color="#7e22ce" /> פרומפט להקלה בעבודה מול AI חיצוני
                    </h3>
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.9rem', width: 'auto' }}
                        onClick={() => {
                            navigator.clipboard.writeText(aiPromptText);
                            alert('הפרומפט הועתק ללוח!');
                        }}
                    >
                        <Copy size={16} /> העתק פרומפט
                    </button>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '12px' }}>
                    העתק את הפרומפט הבא והדבק אותו במנוע ה-AI המוביל שיש לך (כמו Claude, ChatGPT Plus, אופוס ואחרים) יחד עם קובץ/קבוצת קבצי מסמכים. עליך להדביק את ה-JSON שמוחזר ממנו ישירות במסך העריכה של המסמך לאכלוס מהיר.
                </p>
                <div style={{ position: 'relative' }}>
                    <pre style={{ direction: 'ltr', textAlign: 'left', background: '#e2e8f0', padding: '16px', borderRadius: '8px', fontSize: '0.85rem', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', color: '#334155' }}>
                        {aiPromptText}
                    </pre>
                </div>
            </div>

            <div className="card mb-4" style={{ textAlign: 'center' }}>
                {isLoading ? (
                    <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <Spinner size={32} className="spin" color="#3b82f6" />
                        <span style={{ fontSize: '1.2rem', color: '#64748b' }}>מעבד קבצים...</span>
                    </div>
                ) : (
                    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                            בחר מסמכים להעלאה
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                            <div>
                                <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} style={{ display: 'none' }} ref={fileInputRef} id="doc-upload" />
                                <label htmlFor="doc-upload" className="btn" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', cursor: 'pointer' }}>
                                    <FileText size={24} /> בחירת קבצים
                                </label>
                            </div>
                            <div>
                                <input type="file" webkitdirectory="" directory="" onChange={handleFolderChange} style={{ display: 'none' }} ref={folderInputRef} id="doc-folder-upload" />
                                <label htmlFor="doc-folder-upload" className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', cursor: 'pointer' }}>
                                    <FolderPlus size={24} color="#2563eb" /> תיקיית קבצים
                                </label>
                            </div>
                            <div>
                                <input type="file" accept=".zip" onChange={handleZipUpload} style={{ display: 'none' }} ref={zipInputRef} id="doc-zip-upload" />
                                <label htmlFor="doc-zip-upload" className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '12px 24px', fontSize: '1.1rem', gap: '8px', cursor: 'pointer' }}>
                                    <FileZip size={24} color="#2563eb" /> מקובץ ZIP
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk JSON Paste Section */}
            {documents.length > 0 && (
                <div className="card mb-4" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.2rem', color: '#5b21b6', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BracketsCurly size={24} /> אכלוס המוני מ-JSON
                            </h3>
                            <p style={{ color: '#4c1d95', fontSize: '0.95rem', marginBottom: '16px', lineHeight: '1.5' }}>
                                לאחר שקיבלת את ה-JSON ממנוע ה-AI עבור המסמכים שבחרת, הדבק את ה-JSON השלם (המכיל מערך של אובייקטים) כאן.
                                המערכת תסרוק את כל המסמכים המופיעים למטה ותאכלס להם את התיעוד והתמלול אוטומטית לפי שמות הקבצים שה-AI זיהה.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <textarea
                                    className="form-input"
                                    style={{ flex: 1, margin: 0, direction: 'ltr', fontFamily: 'monospace', resize: 'vertical', border: '2px solid #a78bfa', background: '#ffffff', minHeight: '80px', maxHeight: '300px' }}
                                    value={jsonInput}
                                    onChange={e => setJsonInput(e.target.value)}
                                    placeholder='[ { "fileName": "...", "metadata": { ... } }, ... ]'
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleApplyJsonToAll}
                                    style={{ background: '#7e22ce', border: 'none', height: 'fit-content', padding: '12px 24px', fontSize: '1rem' }}
                                >
                                    החל על כל המסמכים
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {documents.length > 0 && (
                <div className="card">
                    <div className="flex-between mb-4" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={24} color="#3b82f6" /> מסמכים שנטענו ({documents.length})
                        </h3>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-secondary" style={{ width: 'auto', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }} onClick={() => setDocuments([])}>
                                מחק הכל
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ width: 'auto', background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                                onClick={handleSaveAllToArchive}
                            >
                                <Archive size={20} weight="bold" />
                                שמור הכל לארכיון
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {documents.map(doc => (
                            <div key={doc.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                                <div
                                    style={{ height: '200px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', transition: 'filter 0.2s' }}
                                    onClick={() => setPreviewDoc(doc)}
                                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                                >
                                    {doc.type === 'image' ? (
                                        <img src={doc.url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                            <FileText size={48} weight="duotone" color="#ef4444" />
                                            <span style={{ fontWeight: 'bold' }}>PDF</span>
                                        </div>
                                    )}
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', opacity: 0, transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0}>
                                        <div style={{ background: 'white', padding: '8px 16px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#334155', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                            <Eye size={20} /> תצוגה מקדימה
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }}
                                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'white', border: 'none', color: '#ef4444', width: '30px', height: '30px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                        title="מחק מסמך"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 'bold', wordBreak: 'break-word', marginBottom: '8px' }} title={doc.name}>
                                        {doc.name.length > 50 ? doc.name.substring(0, 47) + '...' : doc.name}
                                    </p>
                                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {doc.title && <span style={{ fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle weight="bold" /> הכותרת הוזנה</span>}
                                        {doc.text && <span style={{ fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle weight="bold" /> טקסט התמליל הוזן</span>}
                                        {!doc.title && !doc.text && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>טרם אואכלס מידע. ימתין לפענוח.</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Archived Documents Section */}
            <div className="card mt-4">
                <div className="flex-between mb-4" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Archive size={24} color="#7e22ce" /> מסמכים קיימים בארכיון ({archivedDocs.length})
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <strong style={{ color: '#64748b' }}>מיון לפי:</strong>
                        <select
                            className="form-input"
                            style={{ margin: 0, padding: '4px 32px 4px 8px', width: 'auto' }}
                            value={archiveSortMode}
                            onChange={(e) => setArchiveSortMode(e.target.value)}
                        >
                            <option value="uploadDate">זמן העלאה (חדש לישן)</option>
                            <option value="docDate">תאריך המסמך</option>
                            <option value="name">שם המסמך</option>
                        </select>
                    </div>
                </div>

                {isFetchingArchive ? (
                    <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <Spinner size={32} className="spin" color="#7e22ce" />
                        <span style={{ fontSize: '1.2rem', color: '#64748b' }}>טוען מסמכים קודמים...</span>
                    </div>
                ) : archivedDocs.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                        אין עדיין מסמכים בארכיון המערכת
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', minHeight: '600px' }}>

                        {/* Right List: Vertical Document Navigation */}
                        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '800px', overflowY: 'auto', paddingRight: '4px' }}>
                            {sortedArchivedDocs.map(doc => {
                                const docColor = getPastelColor(doc.name);
                                const isSelected = editingArchivedDoc && editingArchivedDoc.id === doc.id;

                                return (
                                    <div
                                        key={doc.id}
                                        style={{
                                            border: `2px solid ${isSelected ? '#7e22ce' : '#e2e8f0'}`,
                                            borderRadius: '12px',
                                            background: docColor,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: isSelected ? '0 4px 12px rgba(126, 34, 206, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                                            transform: isSelected ? 'scale(1.02)' : 'none'
                                        }}
                                        onClick={() => setEditingArchivedDoc(doc)}
                                    >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.8 }}>
                                            {doc.fileType === 'image' ? <Images size={20} color="#64748b" /> : <FileText size={20} color="#64748b" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {doc.title || doc.name}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#475569' }}>
                                                <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', background: doc.status === 'public' ? '#10b981' : '#f59e0b', color: 'white', fontWeight: 'bold' }}>
                                                    {doc.status === 'public' ? 'ציבורי' : 'טיוטה'}
                                                </span>
                                                <span>{doc.date || 'ללא תאריך'}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteArchived(doc.id, doc.fileUrl); }}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                            title="מחק מסמך מהארכיון"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Left Side: Inline Editor for Selected Doc */}
                        <div style={{ flex: 1, background: '#f8fafc', borderRadius: '16px', border: '1px solid #cbd5e1', overflow: 'hidden', display: 'flex', height: '800px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                            {editingArchivedDoc ? (
                                <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                                    {/* Inline Document Preview */}
                                    <div style={{ flex: '1', background: '#e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', borderLeft: '1px solid #cbd5e1' }}>
                                        {editingArchivedDoc.fileType === 'image' ? (
                                            <img src={editingArchivedDoc.fileUrl} alt={editingArchivedDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <iframe src={editingArchivedDoc.fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={editingArchivedDoc.name} />
                                        )}
                                    </div>

                                    {/* Inline Form */}
                                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
                                        <div className="flex-between" style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
                                                עריכת מסמך קיים
                                            </h3>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '8px 16px', background: '#7e22ce', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                onClick={handleSaveArchived}
                                            >
                                                <FloppyDisk size={18} /> שמור שינויים
                                            </button>
                                        </div>

                                        <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.9rem', wordBreak: 'break-word', direction: 'ltr', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{editingArchivedDoc.name}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e2e8f0', padding: '4px 12px', borderRadius: '99px', color: '#1e293b', fontWeight: 'bold' }}>
                                                סטטוס פרסום:
                                                <select
                                                    value={editingArchivedDoc.status || 'draft'}
                                                    onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, status: e.target.value }))}
                                                    style={{ background: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', color: editingArchivedDoc.status === 'public' ? '#059669' : '#d97706', cursor: 'pointer' }}
                                                >
                                                    <option value="draft">טיוטה (מוסתר)</option>
                                                    <option value="public">ציבורי (מוצג לאתר)</option>
                                                </select>
                                            </span>
                                        </p>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                            <div>
                                                <label className="form-label" style={{ fontWeight: '600' }}>כותרת המסמך</label>
                                                <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.title || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, title: e.target.value }))} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <label className="form-label" style={{ fontWeight: '600' }}>שנה / תאריך</label>
                                                    <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.date || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, date: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="form-label" style={{ fontWeight: '600' }}>סוג (מכתב/תיעוד...)</label>
                                                    <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.docType || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, docType: e.target.value }))} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="form-label" style={{ fontWeight: '600' }}>תיאור פתוח (Keywords)</label>
                                                <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.description || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, description: e.target.value }))} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <label className="form-label" style={{ fontWeight: '600' }}>גוף מפרסם (מחבר)</label>
                                                    <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.publishingBody || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, publishingBody: e.target.value }))} />
                                                </div>
                                                <div>
                                                    <label className="form-label" style={{ fontWeight: '600' }}>חתום מטה</label>
                                                    <input className="form-input" style={{ margin: 0 }} value={editingArchivedDoc.signatory || ''} onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, signatory: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <label className="form-label" style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <TextAa size={24} weight="fill" /> תמלול טקסט
                                            </label>
                                            <textarea
                                                className="form-input"
                                                style={{ flex: 1, margin: 0, resize: 'none', lineHeight: '1.6', fontSize: '1rem', minHeight: '300px' }}
                                                value={editingArchivedDoc.text || ''}
                                                onChange={(e) => setEditingArchivedDoc(prev => ({ ...prev, text: e.target.value }))}
                                                placeholder="הטקסט המלא של המסמך..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', color: '#94a3b8', gap: '16px' }}>
                                    <Images size={64} weight="duotone" />
                                    <span style={{ fontSize: '1.2rem' }}>בחר מסמך מהרשימה כדי לערוך או לצפות בפרטיו</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}

export default ManageDocuments;
