import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { PenNib, CheckCircle, WarningCircle } from '@phosphor-icons/react';

function DocumentSign() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [documentData, setDocumentData] = useState(null);
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState('phone'); // phone, confirm_name, view, signed, error
    const [errorMessage, setErrorMessage] = useState('');
    const [requestedName, setRequestedName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);

    // Signature Canvas
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const fetchDoc = async () => {
            try {
                const docRef = doc(db, 'documents_for_signature', id);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    setDocumentData({ id: docSnap.id, ...docSnap.data() });
                    setStep('phone');
                } else {
                    setErrorMessage('מסמך לא נמצא');
                    setStep('error');
                }
            } catch (err) {
                console.error(err);
                setErrorMessage('שגיאה בטעינת המסמך');
                setStep('error');
            } finally {
                setLoading(false);
            }
        };

        fetchDoc();
    }, [id]);

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        if (!documentData) return;

        const cleanPhone = phone.trim().replace(/\D/g, '');
        const allowedUsersMap = documentData.allowedUsers || {};
        
        // Find if this phone is allowed
        const userData = allowedUsersMap[cleanPhone];

        if (!userData) {
            setErrorMessage('אינך מורשה לחתום על מסמך זה (מספר הטלפון לא ברשימה).');
            setStep('error');
            return;
        }

        if (userData.status === 'signed') {
            setStep('signed');
            return;
        }

        // If status is pending, mark it as viewed
        if (userData.status === 'pending') {
            try {
                const docRef = doc(db, 'documents_for_signature', id);
                await updateDoc(docRef, {
                    [`allowedUsers.${cleanPhone}.status`]: 'viewed'
                });
                // Update local state to reflect the viewing
                setDocumentData(prev => ({
                    ...prev,
                    allowedUsers: {
                        ...prev.allowedUsers,
                        [cleanPhone]: { ...userData, status: 'viewed' }
                    }
                }));
            } catch (error) {
                console.error("Error updating viewed status:", error);
            }
        }

        setStep('confirm_name');
    };

    // Canvas logic
    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Handle touch or mouse
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        ctx.beginPath();
        ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
        if (step === 'view' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';
        }
    }, [step]);

    const handleSign = async () => {
        const canvas = canvasRef.current;
        
        // Check if canvas is empty (simplified check)
        const ctx = canvas.getContext('2d');
        const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const hasPixels = pixelBuffer.some(color => color !== 0);
        
        if (!hasPixels) {
            alert('אנא הוסף חתימה לפני האישור');
            return;
        }

        const signatureDataUrl = canvas.toDataURL('image/png');
        const cleanPhone = phone.trim().replace(/\D/g, '');

        try {
            setLoading(true);
            const docRef = doc(db, 'documents_for_signature', id);
            
            const updatePayload = {
                [`allowedUsers.${cleanPhone}.signatureDataUrl`]: signatureDataUrl,
                [`allowedUsers.${cleanPhone}.timestamp`]: Date.now()
            };

            if (requestedName && requestedName.trim() !== '') {
                updatePayload[`allowedUsers.${cleanPhone}.status`] = 'name_change_pending';
                updatePayload[`allowedUsers.${cleanPhone}.requestedName`] = requestedName.trim();
            } else {
                updatePayload[`allowedUsers.${cleanPhone}.status`] = 'signed';
            }
            
            await updateDoc(docRef, updatePayload);
            
            setStep('signed');
        } catch (err) {
            console.error(err);
            alert('שגיאה בשמירת החתימה');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading">טוען...</div>;
    }

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
            <div className="card" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                
                {step === 'phone' && (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <PenNib size={48} color="var(--primary-color)" style={{ marginBottom: '16px' }} />
                        <h2 style={{ marginBottom: '8px' }}>כניסה למסמך חתימה</h2>
                        <p style={{ color: '#64748b', marginBottom: '32px' }}>אנא הזן את מספר הטלפון שלך כדי לצפות במסמך</p>
                        
                        <form onSubmit={handlePhoneSubmit} style={{ maxWidth: '300px', margin: '0 auto' }}>
                            <input 
                                type="tel" 
                                className="form-input" 
                                placeholder="מספר טלפון נייד (ללא מקפים)" 
                                value={phone} 
                                onChange={e => setPhone(e.target.value)} 
                                required
                                style={{ textAlign: 'center', fontSize: '1.2rem', padding: '12px', marginBottom: '16px' }}
                            />
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '12px' }}>
                                המשך
                            </button>
                        </form>
                    </div>
                )}

                {step === 'confirm_name' && (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '24px' }}>שלום {documentData.allowedUsers[phone.trim().replace(/\D/g, '')]?.name}!</h2>
                        
                        {!showNameInput ? (
                            <>
                                <p style={{ fontSize: '1.2rem', marginBottom: '32px' }}>האם זהו שמך המלא?</p>
                                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                    <button className="btn btn-primary" onClick={() => setStep('view')} style={{ width: 'auto', padding: '10px 32px' }}>
                                        כן, המשך למסמך
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setShowNameInput(true)} style={{ width: 'auto', padding: '10px 32px' }}>
                                        לא, שמי שונה
                                    </button>
                                </div>
                            </>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); if(requestedName.trim()) setStep('view'); }} style={{ maxWidth: '300px', margin: '0 auto' }}>
                                <p style={{ marginBottom: '16px' }}>אנא הקלד את שמך המלא התקין:</p>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={requestedName}
                                    onChange={e => setRequestedName(e.target.value)}
                                    placeholder="שם פרטי ושם משפחה"
                                    required
                                    style={{ textAlign: 'center', marginBottom: '16px' }}
                                />
                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                    עדכן והמשך למסמך
                                </button>
                                <button type="button" className="btn" onClick={() => { setShowNameInput(false); setRequestedName(''); }} style={{ width: '100%', marginTop: '8px', background: 'none', color: '#64748b' }}>
                                    חזור
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {step === 'error' && (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <WarningCircle size={64} color="#ef4444" style={{ marginBottom: '16px' }} />
                        <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>שגיאה</h2>
                        <p style={{ fontSize: '1.1rem', marginBottom: '24px' }}>{errorMessage}</p>
                        {documentData ? (
                            <button className="btn btn-secondary" onClick={() => { setStep('phone'); setPhone(''); }} style={{ width: 'auto', padding: '10px 24px', margin: '0 auto' }}>
                                הקלד מחדש
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ width: 'auto', padding: '10px 24px', margin: '0 auto' }}>
                                חזרה לדף הבית
                            </button>
                        )}
                    </div>
                )}

                {step === 'signed' && (
                    <div style={{ padding: '60px 20px', textAlign: 'center', background: '#f0fdf4' }}>
                        <CheckCircle size={80} color="#22c55e" style={{ marginBottom: '16px' }} />
                        <h2 style={{ color: '#166534', marginBottom: '16px' }}>תודה רבה!</h2>
                        <p style={{ fontSize: '1.2rem', color: '#15803d', marginBottom: '32px' }}>
                            {requestedName ? `החתימה שלך ובקשת העדכון לשם "${requestedName}" נשלחו לאישור מנהל.` : `החתימה שלך על המסמך "${documentData?.title}" נקלטה בהצלחה.`}
                        </p>
                        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ width: 'auto', padding: '10px 32px', margin: '0 auto', background: '#166534' }}>
                            חזרה לדף הבית
                        </button>
                    </div>
                )}

                {step === 'view' && documentData && (
                    <div style={{ padding: '32px' }}>
                        <h1 style={{ textAlign: 'center', marginBottom: '32px', color: '#1e293b' }}>{documentData.title}</h1>
                        
                        <div style={{ 
                            background: '#f8fafc', 
                            padding: '24px', 
                            borderRadius: '12px', 
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.8',
                            fontSize: '1.1rem',
                            color: '#334155',
                            marginBottom: '40px'
                        }}>
                            {documentData.content}
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, color: '#1e293b' }}>
                                    חתימה אישית - {requestedName || documentData.allowedUsers[phone.trim().replace(/\D/g, '')]?.name}
                                </h3>
                                <button type="button" onClick={clearCanvas} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}>
                                    נקה חתימה
                                </button>
                            </div>
                            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', background: '#f1f5f9', touchAction: 'none' }}>
                                <canvas
                                    ref={canvasRef}
                                    width={600}
                                    height={200}
                                    style={{ width: '100%', height: '200px', cursor: 'crosshair', display: 'block' }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseOut={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>
                            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>
                                חתום באמצעות העכבר או האצבע
                            </p>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            onClick={handleSign}
                            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            <PenNib size={24} /> אני מאשר/ת וחותם/ת
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DocumentSign;
