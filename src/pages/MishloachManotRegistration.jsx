import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Gift, CheckCircle } from '@phosphor-icons/react';

function MishloachManotRegistration() {
    const [formData, setFormData] = useState({
        familyName: '',
        phone: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState({
        registrationDeadline: 'היום בשעה 14:00',
        distributionTime: 'מחר במהלך היום',
        isRegistrationClosed: true
    });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'mishloachManot'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.isRegistrationClosed === undefined) {
                        data.isRegistrationClosed = true;
                    }
                    setSettings(data);
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check if family already exists
            const q = query(
                collection(db, 'mishloachManot'),
                where('phone', '==', formData.phone)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                throw new Error('מספר טלפון זה כבר רשום במערכת.');
            }

            await addDoc(collection(db, 'mishloachManot'), {
                familyName: formData.familyName,
                phone: formData.phone,
                excludedFamilies: [],
                assignedTo: null, // מי המשפחה שאני מביא לה
                receivedFrom: null, // מי מביא לי - למרות שזה בד"כ אסימטרי בהגרלה
                createdAt: serverTimestamp()
            });

            setSuccess(true);
        } catch (err) {
            console.error('Error registering:', err);
            setError(err.message || 'אירעה שגיאה בהרשמה. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf4ff', padding: '20px' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
                    <CheckCircle size={64} color="#d946ef" weight="fill" style={{ margin: '0 auto 20px' }} />
                    <h1 style={{ color: '#d946ef', marginBottom: '16px', fontSize: '2rem' }}>ההרשמה נקלטה בהצלחה!</h1>
                    <p style={{ color: '#4b5563', fontSize: '1.1rem', marginBottom: '24px' }}>
                        תודה {formData.familyName}. נעדכן אתכם לגבי ההגרלה בקרוב. פורים שמח! 🎭
                    </p>
                </div>
            </div>
        );
    }

    if (settings.isRegistrationClosed) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf4ff', padding: '20px' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '100%', borderTop: '6px solid #d946ef' }}>
                    <Gift size={64} color="#d946ef" weight="duotone" style={{ margin: '0 auto 20px' }} />
                    <h1 style={{ color: '#86198f', marginBottom: '16px', fontSize: '2rem' }}>ההרשמה נסגרה</h1>
                    <p style={{ color: '#4b5563', fontSize: '1.2rem', marginBottom: '8px' }}>
                        ההרשמה למשלוחי מנות לשנה זו הסתיימה.
                    </p>
                    <p style={{ color: '#4b5563', fontSize: '1.1rem' }}>
                        פורים שמח! 🎭
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf4ff', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%', borderTop: '6px solid #d946ef' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <Gift size={48} color="#d946ef" weight="duotone" style={{ margin: '0 auto 16px' }} />
                    <h1 style={{ color: '#86198f', fontSize: '1.8rem', margin: '0 0 8px 0' }}>הרשמה למשלוחי מנות</h1>
                    <p style={{ color: '#6b7280', margin: '0 0 16px 0' }}>הצטרפו לחגיגת פורים הקהילתית!</p>

                    <div style={{ background: '#fdf4ff', padding: '16px', borderRadius: '8px', fontSize: '1rem', color: '#86198f', textAlign: 'right', border: '1px solid #f0abfc' }}>
                        <ul style={{ margin: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {settings.registrationDeadline && <li><strong>סיום הרשמה:</strong> {settings.registrationDeadline}</li>}
                            {settings.distributionTime && <li><strong>חלוקה:</strong> {settings.distributionTime}</li>}
                            {settings.note1 && <li>{settings.note1}</li>}
                            {settings.note2 && <li>{settings.note2}</li>}
                            {settings.note3 !== undefined ? (
                                settings.note3 && <li>{settings.note3}</li>
                            ) : (
                                <li>נשמח אם תצלמו ותשתפו את ההכנות ואת מסירת משלוח המנות לנסיה! 📸</li>
                            )}
                        </ul>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>שם המשפחה (למשל: משפחת כהן)</label>
                        <input
                            type="text"
                            required
                            value={formData.familyName}
                            onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                            style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
                            placeholder="הזן שם משפחה מפורט"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#374151', fontWeight: '500' }}>מספר טלפון ליצירת קשר</label>
                        <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
                            placeholder="050-0000000"
                            dir="ltr"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: loading ? '#e879f9' : '#d946ef',
                            color: '#fff',
                            padding: '14px',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '8px',
                            transition: 'background 0.2s'
                        }}
                    >
                        {loading ? 'שולח...' : 'הרשמו עכשיו'} 🎭
                    </button>
                </form>
            </div>
        </div>
    );
}

export default MishloachManotRegistration;
