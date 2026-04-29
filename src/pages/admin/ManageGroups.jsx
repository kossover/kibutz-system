import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UsersThree, Plus, Trash, CheckSquare, Square, MagnifyingGlass, MagicWand, X, Spinner } from '@phosphor-icons/react';

function ManageGroups() {
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiText, setAiText] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch groups master list
            const groupsDocRef = doc(db, 'config', 'groups');
            const groupsSnap = await getDoc(groupsDocRef);
            if (groupsSnap.exists() && groupsSnap.data().list) {
                setGroups(groupsSnap.data().list);
            } else {
                setGroups([]);
            }

            // Fetch users
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort users by display name
            usersData.sort((a, b) => {
                const nameA = a.displayName || a.name || a.firstName || '';
                const nameB = b.displayName || b.name || b.firstName || '';
                return nameA.localeCompare(nameB);
            });
            setUsers(usersData);
        } catch (error) {
            console.error('Error fetching groups/users:', error);
            alert('שגיאה בטעינת הנתונים');
        } finally {
            setLoading(false);
        }
    };

    const handleAddGroup = async (e) => {
        e.preventDefault();
        const cleanName = newGroupName.trim();
        if (!cleanName) return;
        if (groups.includes(cleanName)) {
            alert('קבוצה זו כבר קיימת');
            return;
        }

        try {
            const newList = [...groups, cleanName];
            await setDoc(doc(db, 'config', 'groups'), { list: newList }, { merge: true });
            setGroups(newList);
            setNewGroupName('');
        } catch (error) {
            console.error('Error adding group:', error);
            alert('שגיאה בהוספת קבוצה');
        }
    };

    const handleDeleteGroup = async (groupName) => {
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הקבוצה "${groupName}"?`)) return;

        try {
            const newList = groups.filter(g => g !== groupName);
            await setDoc(doc(db, 'config', 'groups'), { list: newList }, { merge: true });
            setGroups(newList);
            if (selectedGroup === groupName) {
                setSelectedGroup(null);
            }

            // Optional: remove this group from all users
            // Here we just update local state, and firestore asynchronously
            const batchPromises = [];
            const updatedUsers = users.map(u => {
                if (u.groups && u.groups.includes(groupName)) {
                    batchPromises.push(updateDoc(doc(db, 'users', u.id), {
                        groups: arrayRemove(groupName)
                    }));
                    return { ...u, groups: u.groups.filter(g => g !== groupName) };
                }
                return u;
            });
            setUsers(updatedUsers);
            await Promise.all(batchPromises);
            
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('שגיאה במחיקת קבוצה');
        }
    };

    const handleToggleUserInGroup = async (userId, currentGroups, add) => {
        try {
            const userRef = doc(db, 'users', userId);
            if (add) {
                await updateDoc(userRef, { groups: arrayUnion(selectedGroup) });
            } else {
                await updateDoc(userRef, { groups: arrayRemove(selectedGroup) });
            }

            // Update local state
            setUsers(users.map(u => {
                if (u.id === userId) {
                    const newGroups = add 
                        ? [...(u.groups || []), selectedGroup]
                        : (u.groups || []).filter(g => g !== selectedGroup);
                    return { ...u, groups: newGroups };
                }
                return u;
            }));
        } catch (error) {
            console.error('Error toggling user group:', error);
            alert('שגיאה בעדכון המשתמש');
        }
    };

    const handleAiImport = async () => {
        if (!aiText.trim()) return;
        setIsAiLoading(true);

        try {
            // Find all Israeli mobile phone numbers (with or without hyphens)
            const phoneMatches = aiText.match(/05\d-?\d{7}|05\d{8}/g) || [];
            if (phoneMatches.length === 0) {
                alert('לא זוהו מספרי טלפון תקינים בטקסט.');
                setIsAiLoading(false);
                return;
            }

            const cleanPhones = [...new Set(phoneMatches.map(p => p.replace(/-/g, '')))];
            
            const matchedUsers = users.filter(u => u.phone && cleanPhones.includes(u.phone.replace(/-/g, '')));
            
            let addedCount = 0;
            const batchPromises = [];
            const updatedUsers = [...users];

            for (const user of matchedUsers) {
                if (!user.groups || !user.groups.includes(selectedGroup)) {
                    batchPromises.push(updateDoc(doc(db, 'users', user.id), {
                        groups: arrayUnion(selectedGroup)
                    }));
                    
                    const uIndex = updatedUsers.findIndex(u => u.id === user.id);
                    if (uIndex > -1) {
                        updatedUsers[uIndex] = { ...updatedUsers[uIndex], groups: [...(updatedUsers[uIndex].groups || []), selectedGroup] };
                    }
                    addedCount++;
                }
            }

            await Promise.all(batchPromises);
            setUsers(updatedUsers);
            
            alert(`תוצאות סריקה:\n- זוהו ${cleanPhones.length} מספרי טלפון ייחודיים בטקסט.\n- נמצאו ${matchedUsers.length} משתמשים מתאימים במערכת.\n- ${addedCount} משתמשים שוייכו לקבוצה בהצלחה!`);
            
            setShowAiModal(false);
            setAiText('');
        } catch (error) {
            console.error('AI Import error:', error);
            alert('שגיאה בתהליך שיוך המשתמשים.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const search = searchTerm.toLowerCase();
        return (
            (user.displayName || user.name || '').toLowerCase().includes(search) ||
            (user.phone || '').toLowerCase().includes(search)
        );
    });

    if (loading) {
        return <div className="loading">טוען קבוצות...</div>;
    }

    return (
        <div>
            <div className="flex-between mb-4">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UsersThree size={28} color="var(--primary-color)" /> ניהול קבוצות
                </h2>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Groups List Side */}
                <div style={{ flex: '1 1 300px', minWidth: '300px' }}>
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ marginBottom: '16px' }}>קבוצות קיימות</h3>
                        
                        <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="שם קבוצה חדשה" 
                                value={newGroupName} 
                                onChange={e => setNewGroupName(e.target.value)} 
                                style={{ margin: 0 }}
                            />
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px' }} title="הוסף קבוצה">
                                <Plus size={20} />
                            </button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {groups.length === 0 ? (
                                <p style={{ color: '#64748b' }}>אין קבוצות מוגדרות.</p>
                            ) : (
                                groups.map(group => {
                                    const count = users.filter(u => u.groups && u.groups.includes(group)).length;
                                    const isSelected = selectedGroup === group;
                                    
                                    return (
                                        <div 
                                            key={group} 
                                            style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center', 
                                                padding: '12px 16px', 
                                                background: isSelected ? '#e0e7ff' : '#f8fafc',
                                                border: `1px solid ${isSelected ? '#818cf8' : '#e2e8f0'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={() => setSelectedGroup(group)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#3730a3' : '#334155' }}>{group}</span>
                                                <span style={{ background: isSelected ? '#c7d2fe' : '#e2e8f0', color: isSelected ? '#3730a3' : '#475569', fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px' }}>
                                                    {count} משתמשים
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }} 
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                title="מחק קבוצה"
                                            >
                                                <Trash size={20} style={{ flexShrink: 0 }} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Users Selection Side */}
                <div style={{ flex: '2 1 500px', minWidth: '300px' }}>
                    <div className="card" style={{ padding: '20px', minHeight: '400px' }}>
                        {!selectedGroup ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', minHeight: '300px' }}>
                                <UsersThree size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <h3>בחר קבוצה כדי לנהל את החברים בה</h3>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                    <h3 style={{ margin: 0 }}>חברי קבוצה: <span style={{ color: 'var(--primary-color)' }}>{selectedGroup}</span></h3>
                                    
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => setShowAiModal(true)} 
                                            className="btn" 
                                            style={{ width: 'auto', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none', padding: '8px 16px', fontSize: '0.9rem' }}
                                        >
                                            <MagicWand size={18} weight="fill" /> שיוך מהיר
                                        </button>
                                        
                                        <div style={{ position: 'relative', width: '250px' }}>
                                            <MagnifyingGlass size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="חיפוש משתמש..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ paddingRight: '36px', margin: 0, height: '40px' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ maxHeight: '600px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '12px', width: '50px', textAlign: 'center' }}>שייך</th>
                                                <th style={{ padding: '12px' }}>שם משתמש</th>
                                                <th style={{ padding: '12px' }}>טלפון</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => {
                                                const isMember = user.groups && user.groups.includes(selectedGroup);
                                                return (
                                                    <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0', background: isMember ? '#f0fdf4' : 'transparent', cursor: 'pointer' }} onClick={() => handleToggleUserInGroup(user.id, user.groups, !isMember)}>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            {isMember ? <CheckSquare size={24} weight="fill" color="#16a34a" /> : <Square size={24} color="#cbd5e1" />}
                                                        </td>
                                                        <td style={{ padding: '12px', fontWeight: isMember ? 'bold' : 'normal', color: isMember ? '#166534' : '#334155' }}>
                                                            {user.displayName || user.name || user.firstName || 'ללא שם'}
                                                        </td>
                                                        <td style={{ padding: '12px', color: '#64748b' }} dir="ltr">
                                                            {user.phone || '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredUsers.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                                        לא נמצאו משתמשים בחיפוש זה.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showAiModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#7e22ce' }}>
                                <MagicWand size={24} weight="fill" /> שיוך חכם מקטע טקסט
                            </h3>
                            <button onClick={() => setShowAiModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            הדבק כאן רשימה ארוכה של מספרי טלפון מכל מקור שהוא (למשל הודעת וואטסאפ או אקסל). המערכת תחפש את המספרים במסד הנתונים ותשייך את כל המשתמשים שיימצאו לקבוצה <strong>{selectedGroup}</strong>.
                        </p>
                        <textarea
                            className="form-input"
                            rows="6"
                            placeholder="הדבק כאן מספרי טלפון..."
                            value={aiText}
                            onChange={(e) => setAiText(e.target.value)}
                            disabled={isAiLoading}
                            style={{ resize: 'vertical' }}
                        ></textarea>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowAiModal(false)} disabled={isAiLoading}>ביטול</button>
                            <button
                                className="btn"
                                style={{ width: 'auto', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none' }}
                                onClick={handleAiImport}
                                disabled={isAiLoading || !aiText.trim()}
                            >
                                {isAiLoading ? 'מעבד נתונים...' : 'מצא ושייך לקבוצה'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageGroups;
