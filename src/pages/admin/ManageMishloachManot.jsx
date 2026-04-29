import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { Gift, UserMinus, Shuffle, ArrowsLeftRight, PencilSimple, Check, X, Trash, Gear } from '@phosphor-icons/react';

function ManageMishloachManot() {
    const [families, setFamilies] = useState([]);
    const [loading, setLoading] = useState(true);

    // Exclusions management states
    const [editingExclusionsId, setEditingExclusionsId] = useState(null);
    const [selectedExclusions, setSelectedExclusions] = useState([]);

    // Manual matching states
    const [editingAssignmentId, setEditingAssignmentId] = useState(null);
    const [assignmentValue, setAssignmentValue] = useState('');

    const [settings, setSettings] = useState({
        registrationDeadline: 'היום בשעה 14:00',
        distributionTime: 'מחר במהלך היום',
        note1: '',
        note2: '',
        note3: 'נשמח אם תצלמו ותשתפו את ההכנות ואת מסירת משלוח המנות לנסיה! 📸',
        isRegistrationClosed: true
    });
    const [isEditingSettings, setIsEditingSettings] = useState(false);

    useEffect(() => {
        const unsubFamilies = onSnapshot(collection(db, 'mishloachManot'), (snapshot) => {
            const data = [];
            snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
            setFamilies(data);
            setLoading(false);
        });

        const unsubSettings = onSnapshot(doc(db, 'settings', 'mishloachManot'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.isRegistrationClosed === undefined) {
                    data.isRegistrationClosed = true;
                }
                setSettings(data);
            }
        });

        return () => {
            unsubFamilies();
            unsubSettings();
        };
    }, []);

    const saveSettings = async () => {
        try {
            await setDoc(doc(db, 'settings', 'mishloachManot'), settings);
            setIsEditingSettings(false);
            alert('ההגדרות נשמרו בהצלחה!');
        } catch (err) {
            console.error('Error saving settings', err);
            alert('שגיאה בשמירת הפעילות');
        }
    };

    const getDisplayName = (fam) => {
        if (!fam) return '';
        const nameCount = families.filter(f => f.familyName === fam.familyName).length;
        return nameCount > 1 ? `${fam.familyName} (${fam.phone})` : fam.familyName;
    };

    const handleDelete = async (id) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק משפחה זו? (המחיקה אינה הפיכה)')) {
            try {
                await deleteDoc(doc(db, 'mishloachManot', id));
            } catch (err) {
                console.error("Error deleting doc", err);
                alert('שגיאה במחיקת המשפחה');
            }
        }
    };

    const saveExclusions = async (id) => {
        try {
            await updateDoc(doc(db, 'mishloachManot', id), {
                excludedFamilies: selectedExclusions
            });
            setEditingExclusionsId(null);
        } catch (err) {
            console.error(err);
            alert('שגיאה בשמירת הגדרות');
        }
    };

    const runRaffle = async () => {
        if (families.length < 2) {
            alert('צריך לפחות 2 משפחות כדי לבצע הגרלה');
            return;
        }

        if (!window.confirm('האם אתה בטוח שברצונך לבצע הגרלה? זה ידרוס שיבוצים קיימים.')) return;

        let success = false;
        let assignments = {};

        // Try up to 150 times to find a valid arrangement
        for (let attempts = 0; attempts < 150; attempts++) {
            let givers = [...families];
            let receivers = [...families];

            // Shuffle receivers
            for (let i = receivers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
            }

            let valid = true;
            assignments = {};

            for (let i = 0; i < givers.length; i++) {
                const giver = givers[i];
                const receiver = receivers[i];

                if (giver.id === receiver.id) {
                    valid = false;
                    break;
                }

                if (giver.excludedFamilies && giver.excludedFamilies.length > 0) {
                    const isExcluded = giver.excludedFamilies.some(
                        ex => receiver.familyName.includes(ex) || ex.includes(receiver.familyName) || receiver.id === ex
                    );
                    if (isExcluded) {
                        valid = false;
                        break;
                    }
                }

                assignments[giver.id] = receiver;
            }

            if (valid) {
                success = true;
                break;
            }
        }

        if (!success) {
            alert('למרות מאמצינו, לא נמצא ציוות שעומד בכל התנאים (ללא עצמי וללא חריגים). נסה להוריד חלק ממגבלות החריגים ולנסות שוב.');
            return;
        }

        try {
            setLoading(true);
            const updates = [];
            for (const giverId in assignments) {
                const receiver = assignments[giverId];
                updates.push(updateDoc(doc(db, 'mishloachManot', giverId), {
                    assignedTo: {
                        id: receiver.id,
                        familyName: receiver.familyName,
                        phone: receiver.phone
                    }
                }));
            }
            await Promise.all(updates);
            alert('ההגרלה בוצעה בהצלחה!');
        } catch (err) {
            console.error(err);
            alert('שגיאה בשמירת ההגרלה');
        } finally {
            setLoading(false);
        }
    };

    const manualAssign = async (giverId) => {
        try {
            const currentGiver = families.find(f => f.id === giverId);

            if (!assignmentValue) {
                await updateDoc(doc(db, 'mishloachManot', giverId), {
                    assignedTo: null
                });
            } else {
                const selectedReceiver = families.find(f => f.id === assignmentValue);
                if (!selectedReceiver) return;

                // בדיקה אם מישהו אחר כבר מביא למשפחה שנבחרה
                const existingGiverToThisReceiver = families.find(f => f.assignedTo?.id === assignmentValue && f.id !== giverId);

                if (existingGiverToThisReceiver) {
                    const confirmSwap = window.confirm(`שים לב: ${getDisplayName(existingGiverToThisReceiver)} כבר אמורים להביא את המשלוח ל-${getDisplayName(selectedReceiver)}.\n\nהאם לבצע החלפה (להעביר ל-${getDisplayName(existingGiverToThisReceiver)} את המשפחה ש${getDisplayName(currentGiver)} היו מביאים לה עד כה)?`);
                    if (!confirmSwap) {
                        return; // לא רוצה להחליף
                    }

                    // ביצוע Swap (החלפה)
                    const oldReceiverOfCurrentGiver = currentGiver.assignedTo || null;
                    await updateDoc(doc(db, 'mishloachManot', existingGiverToThisReceiver.id), {
                        assignedTo: oldReceiverOfCurrentGiver
                    });
                }

                await updateDoc(doc(db, 'mishloachManot', giverId), {
                    assignedTo: {
                        id: selectedReceiver.id,
                        familyName: selectedReceiver.familyName,
                        phone: selectedReceiver.phone
                    }
                });
            }
            setEditingAssignmentId(null);
        } catch (err) {
            console.error(err);
            alert('שגיאה בעדכון ציוות');
        }
    };

    if (loading) return <div>טוען משפחות...</div>;

    return (
        <div>
            <div className="flex-between mb-4 flex-wrap gap-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ניהול משלוחי מנות</h2>
                <div>
                    <button onClick={runRaffle} className="btn btn-accent" style={{ background: '#d946ef', borderColor: '#d946ef' }}>
                        <Shuffle size={20} /> הגרל ציוותים
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Gear size={24} color="#86198f" /> הגדרות הרישום
                    </h3>
                    <button
                        onClick={() => setIsEditingSettings(!isEditingSettings)}
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '6px 16px' }}
                    >
                        {isEditingSettings ? 'ביטול' : 'ערוך קטעי טקסט'}
                    </button>
                </div>

                {isEditingSettings ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="form-label text-sm font-bold">טקסט לסיום הרשמה:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.registrationDeadline}
                                onChange={e => setSettings({ ...settings, registrationDeadline: e.target.value })}
                                placeholder="למשל: היום בשעה 14:00"
                            />
                        </div>
                        <div>
                            <label className="form-label text-sm font-bold">טקסט לזמני חלוקה:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.distributionTime}
                                onChange={e => setSettings({ ...settings, distributionTime: e.target.value })}
                                placeholder="למשל: מחר במהלך היום"
                            />
                        </div>
                        <div>
                            <label className="form-label text-sm font-bold">הערה נוספת 1:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.note1 || ''}
                                onChange={e => setSettings({ ...settings, note1: e.target.value })}
                                placeholder="למשל: שימו לב להביא משלוחים ארוזים היטב"
                            />
                        </div>
                        <div>
                            <label className="form-label text-sm font-bold">הערה נוספת 2:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.note2 || ''}
                                onChange={e => setSettings({ ...settings, note2: e.target.value })}
                                placeholder="למשל: נא לשים פתק עם שם השולח"
                            />
                        </div>
                        <div>
                            <label className="form-label text-sm font-bold">הערה נוספת 3:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.note3 !== undefined ? settings.note3 : 'נשמח אם תצלמו ותשתפו את ההכנות ואת מסירת משלוח המנות לנסיה! 📸'}
                                onChange={e => setSettings({ ...settings, note3: e.target.value })}
                                placeholder="למשל: נשמח אם תצלמו לקבוצה"
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fee2e2', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                            <input
                                type="checkbox"
                                id="isRegistrationClosed"
                                checked={settings.isRegistrationClosed}
                                onChange={e => setSettings({ ...settings, isRegistrationClosed: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: '#ef4444', cursor: 'pointer' }}
                            />
                            <label htmlFor="isRegistrationClosed" className="form-label text-sm font-bold" style={{ margin: 0, color: '#b91c1c', cursor: 'pointer' }}>סגור הרשמה למשלוחי מנות</label>
                        </div>
                        <button
                            className="btn btn-success"
                            onClick={saveSettings}
                            style={{ width: 'auto', alignSelf: 'flex-start' }}
                        >
                            <Check size={18} /> שמור הגדרות טקסט
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#4b5563' }}>
                        <div style={{ display: 'flex', gap: '8px', background: '#fdf4ff', padding: '12px', borderRadius: '8px', border: '1px solid #f0abfc' }}>
                            <strong style={{ color: '#86198f' }}>סיום הרשמה:</strong> {settings.registrationDeadline || 'לא הוגדר'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', background: '#fdf4ff', padding: '12px', borderRadius: '8px', border: '1px solid #f0abfc' }}>
                            <strong style={{ color: '#86198f' }}>זמן חלוקה:</strong> {settings.distributionTime || 'לא הוגדר'}
                        </div>
                        {settings.note1 && (
                            <div style={{ display: 'flex', gap: '8px', background: '#fdf4ff', padding: '12px', borderRadius: '8px', border: '1px solid #f0abfc' }}>
                                <strong style={{ color: '#86198f' }}>הערה 1:</strong> {settings.note1}
                            </div>
                        )}
                        {settings.note2 && (
                            <div style={{ display: 'flex', gap: '8px', background: '#fdf4ff', padding: '12px', borderRadius: '8px', border: '1px solid #f0abfc' }}>
                                <strong style={{ color: '#86198f' }}>הערה 2:</strong> {settings.note2}
                            </div>
                        )}
                        {settings.note3 && (
                            <div style={{ display: 'flex', gap: '8px', background: '#fdf4ff', padding: '12px', borderRadius: '8px', border: '1px solid #f0abfc' }}>
                                <strong style={{ color: '#86198f' }}>הערה 3:</strong> {settings.note3}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', background: settings.isRegistrationClosed ? '#fee2e2' : '#dcfce3', padding: '12px', borderRadius: '8px', border: `1px solid ${settings.isRegistrationClosed ? '#fca5a5' : '#86efac'}` }}>
                            <strong style={{ color: settings.isRegistrationClosed ? '#b91c1c' : '#166534' }}>סטטוס הרשמה:</strong> {settings.isRegistrationClosed ? 'סגורה 🔒' : 'פתוחה 🟢'}
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ overflowX: 'auto', paddingBottom: '120px' }}>
                <table className="table" style={{ minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th>שם המשפחה</th>
                            <th>מספר טלפון</th>
                            <th style={{ width: '250px' }}>חריגים (לא יקבלו את:)</th>
                            <th>המשפחה שקיבלו</th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        {families.map(family => {
                            const excludedNames = family.excludedFamilies?.map(ex => {
                                const f = families.find(fam => fam.id === ex);
                                return f ? getDisplayName(f) : ex;
                            });

                            return (
                                <tr key={family.id}>
                                    <td style={{ fontWeight: '500' }}>{getDisplayName(family)}</td>
                                    <td dir="ltr" style={{ textAlign: 'right' }}>{family.phone}</td>
                                    <td>
                                        {editingExclusionsId === family.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '4px', background: '#f8fafc' }}>
                                                    {families.filter(f => f.id !== family.id).map(f => (
                                                        <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedExclusions.includes(f.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedExclusions([...selectedExclusions, f.id]);
                                                                    } else {
                                                                        setSelectedExclusions(selectedExclusions.filter(id => id !== f.id));
                                                                    }
                                                                }}
                                                                style={{ width: '16px', height: '16px', accentColor: '#d946ef' }}
                                                            />
                                                            {getDisplayName(f)}
                                                        </label>
                                                    ))}
                                                    {families.length <= 1 && <div style={{ fontSize: '0.9rem', color: '#64748b' }}>אין משפחות אחרות</div>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => saveExclusions(family.id)} className="btn btn-secondary" style={{ padding: '6px', flex: 1, color: '#15803d' }}>
                                                        שמור
                                                    </button>
                                                    <button onClick={() => setEditingExclusionsId(null)} className="btn btn-secondary" style={{ padding: '6px', flex: 1, color: '#ef4444' }}>
                                                        ביטול
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                                    {excludedNames?.length > 0 ? excludedNames.join(', ') : 'אין מגבלות'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const currentIds = families.filter(f =>
                                                            family.excludedFamilies?.some(ex => ex === f.id || f.familyName.includes(ex))
                                                        ).map(f => f.id);
                                                        setSelectedExclusions(currentIds);
                                                        setEditingExclusionsId(family.id);
                                                    }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', flexShrink: 0 }}
                                                    title="ערוך חריגים"
                                                >
                                                    <PencilSimple size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        {editingAssignmentId === family.id ? (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <select
                                                    value={assignmentValue}
                                                    onChange={e => setAssignmentValue(e.target.value)}
                                                    className="form-input"
                                                    style={{ padding: '6px 8px', maxWidth: '200px' }}
                                                >
                                                    <option value="">ללא הקצאה</option>
                                                    {families.filter(f => f.id !== family.id).map(f => (
                                                        <option key={f.id} value={f.id}>{getDisplayName(f)}</option>
                                                    ))}
                                                </select>
                                                <button onClick={() => manualAssign(family.id)} className="btn btn-secondary" style={{ padding: '6px' }} title="אשר שינוי"><Check size={16} /></button>
                                                <button onClick={() => setEditingAssignmentId(null)} className="btn btn-secondary" style={{ padding: '6px' }} title="ביטול"><X size={16} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: 'bold', color: family.assignedTo ? '#15803d' : '#ef4444' }}>
                                                    {family.assignedTo ? getDisplayName(families.find(f => f.id === family.assignedTo.id) || family.assignedTo) : 'טרם נבחר'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setAssignmentValue(family.assignedTo ? family.assignedTo.id : '');
                                                        setEditingAssignmentId(family.id);
                                                    }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', flexShrink: 0 }}
                                                    title="שנה הקצאה ידנית"
                                                >
                                                    <ArrowsLeftRight size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleDelete(family.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                            title="מחק משפחה"
                                        >
                                            <Trash size={20} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {families.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                    טרם נרשמו משפחות.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ManageMishloachManot;
