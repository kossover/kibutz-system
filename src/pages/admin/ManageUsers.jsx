import { useState, useEffect } from 'react';
import axios from 'axios';
import { db, auth } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import * as XLSX from 'xlsx';
import {
  PencilSimple,
  Check,
  X,
  ShieldCheck,
  User,
  Phone,
  EnvelopeSimple,
  Trash,
  Key,
  UploadSimple,
  DownloadSimple,
  MagicWand,
  Spinner,
  MagnifyingGlass,
  CaretUp,
  CaretDown,
  ArrowsLeftRight,
  Users,
  GitMerge
} from '@phosphor-icons/react';

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);

  // AI Import State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Duplicates State
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);

  // Search and Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('displayName');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // Load available groups master list
      const groupsSnap = await getDoc(doc(db, 'config', 'groups'));
      if (groupsSnap.exists() && groupsSnap.data().list) {
          setAvailableGroups(groupsSnap.data().list);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineUpdate = async (userId, field, value) => {
    try {
      let updateData = { [field]: value };
      
      // Update name logic if needed
      if (field === 'displayName') {
        updateData.name = value;
      }
      
      // Force admin role for the main admin
      const userToUpdate = users.find(u => u.id === userId);
      if (field === 'role' && userToUpdate?.email === 'guy@mir.co.il') {
        return; // Prevent changing main admin role
      }

      await updateDoc(doc(db, 'users', userId), updateData);
      setUsers(users.map(u => u.id === userId ? { ...u, ...updateData } : u));
    } catch (error) {
      console.error('Error updating user inline:', error);
      alert('שגיאה בעדכון השדה');
    }
  };

  const handleGroupToggle = async (user, index, groupName, isChecked, isShiftKey, filteredList) => {
    try {
      if (isShiftKey && lastChecked && lastChecked.groupName === groupName) {
        const startIdx = Math.min(lastChecked.index, index);
        const endIdx = Math.max(lastChecked.index, index);
        const usersToUpdate = filteredList.slice(startIdx, endIdx + 1);
        
        const updatedUsers = [...users];
        
        const updatePromises = usersToUpdate.map(async (u) => {
          const currentGroups = u.groups || [];
          const hasGroup = currentGroups.includes(groupName);
          
          if (isChecked && !hasGroup) {
            const newGroups = [...currentGroups, groupName];
            const uIdx = updatedUsers.findIndex(x => x.id === u.id);
            if (uIdx !== -1) updatedUsers[uIdx] = { ...updatedUsers[uIdx], groups: newGroups };
            return updateDoc(doc(db, 'users', u.id), { groups: newGroups });
          } else if (!isChecked && hasGroup) {
            const newGroups = currentGroups.filter(g => g !== groupName);
            const uIdx = updatedUsers.findIndex(x => x.id === u.id);
            if (uIdx !== -1) updatedUsers[uIdx] = { ...updatedUsers[uIdx], groups: newGroups };
            return updateDoc(doc(db, 'users', u.id), { groups: newGroups });
          }
        });
        
        setUsers(updatedUsers);
        await Promise.all(updatePromises);
      } else {
        const currentGroups = user.groups || [];
        const newGroups = isChecked 
          ? [...currentGroups, groupName] 
          : currentGroups.filter(g => g !== groupName);
        
        await updateDoc(doc(db, 'users', user.id), { groups: newGroups });
        setUsers(users.map(u => u.id === user.id ? { ...u, groups: newGroups } : u));
      }
      
      setLastChecked({ groupName, index });
    } catch (error) {
      console.error('Error updating user groups:', error);
      alert('שגיאה בעדכון קבוצה');
    }
  };

  const formatGroupHeader = (groupName) => {
    if (!groupName) return '';
    const words = groupName.trim().split(/\s+/);
    if (words.length > 2) {
      return `${words[0]}...${words[words.length - 1]}`;
    }
    return groupName;
  };

  const handleSwapNames = async (user) => {
    try {
      const newFirstName = user.lastName || '';
      const newLastName = user.firstName || '';
      const newDisplayName = `${newFirstName} ${newLastName}`.trim();
      
      const updateData = {
        firstName: newFirstName,
        lastName: newLastName,
        displayName: newDisplayName,
        name: newDisplayName
      };
      
      await updateDoc(doc(db, 'users', user.id), updateData);
      
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, ...updateData } : u
      ));
    } catch (error) {
      console.error('Error swapping names:', error);
      alert('שגיאה בהחלפת השמות');
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'chip-blue';
      case 'culture_admin': return 'chip-green';
      case 'pub_admin': return 'chip-amber';
      case 'professionals_admin': return 'chip-gray';
      case 'librarian': return 'chip-gray';
      case 'recipes_admin': return 'chip-orange';
      case 'archive_admin': return 'chip-blue';
      default: return 'chip-gray';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'מנהל ראשי';
      case 'culture_admin': return 'מנהל תרבות';
      case 'pub_admin': return 'מנהל פאב';
      case 'professionals_admin': return 'מנהל בעלי מקצוע';
      case 'librarian': return 'ספרן';
      case 'recipes_admin': return 'מנהל מתכונים';
      case 'archive_admin': return 'מנהל ארכיון';
      default: return 'משתמש';
    }
  };

  const getDisplayName = (user) => {
    return user.displayName || user.name || (`${user.firstName || ''} ${user.lastName || ''}`).trim() || 'ללא שם';
  };

  const handleDelete = async (user) => {
    const userName = getDisplayName(user);
    if (user.email) {
      if (!window.confirm(`למשתמש ${userName} יש אימייל / פרטי כניסה. האם אתה בטוח שברצונך למחוק אותו? (פעולה זו אינה הפיכה)`)) return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', user.id));
        await loadUsers();
        alert('המשתמש נמחק בהצלחה!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('שגיאה במחיקת משתמש');
    }
  };

  const handlePasswordReset = async (email, userName) => {
    if (!email) {
      alert('למשתמש זה אין כתובת אימייל מוגדרת למשלוח קישור איפוס.');
      return;
    }
    if (window.confirm(`האם לשלוח קישור לאיפוס סיסמה אל ${email} עבור המשתמש ${userName}?`)) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert('קישור לאיפוס סיסמה נשלח בהצלחה לתיבת המייל של המשתמש!');
      } catch (error) {
        console.error('Error sending reset email:', error);
        alert('שגיאה בשליחת קישור איפוס: ' + error.message);
      }
    }
  };

  const handleDownloadExcel = () => {
    const exportData = users.map(user => ({
      'ID (לא לשנות)': user.id,
      'שם פרטי': user.firstName || '',
      'שם משפחה': user.lastName || '',
      'אימייל': user.email || '',
      'טלפון': user.phone || '',
      'קבוצות (מופרדות בפסיק)': (user.groups || []).join(', '),
      'תפקיד': user.role || 'user'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משתמשים");
    XLSX.writeFile(wb, "users_export.xlsx");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let added = 0;
      let updated = 0;

      for (const row of jsonData) {
        const id = row['ID (לא לשנות)']?.toString().trim() || '';
        const firstName = row['שם פרטי']?.toString().trim() || '';
        const lastName = row['שם משפחה']?.toString().trim() || '';
        const email = row['אימייל']?.toString().trim() || '';
        const phone = row['טלפון']?.toString().trim() || '';
        const role = row['תפקיד']?.toString().trim() || row['תפקיד (user/admin/culture_admin/pub_admin...)']?.toString().trim() || 'user';
        const groupsStr = row['קבוצות (מופרדות בפסיק)']?.toString().trim() || '';
        const groups = groupsStr ? groupsStr.split(',').map(g => g.trim()).filter(Boolean) : [];

        if (!email && !firstName && !lastName && !phone) continue;

        const displayName = `${firstName} ${lastName}`.trim();

        const existingUser = users.find(u =>
          (id && u.id === id) ||
          (email && u.email?.toLowerCase() === email.toLowerCase()) ||
          (phone && u.phone === phone)
        );

        let finalRole = role;
        if (existingUser && existingUser.email === 'guy@mir.co.il') {
            finalRole = 'admin'; // Protect main admin from being downgraded
        }

        const userData = {
          firstName,
          lastName,
          email,
          phone,
          role: finalRole,
          groups,
          name: displayName,
          displayName,
          source: 'excel_import'
        };

        if (existingUser) {
          await updateDoc(doc(db, 'users', existingUser.id), userData);
          updated++;
        } else {
          await addDoc(collection(db, 'users'), userData);
          added++;
        }
      }

      await loadUsers();
      alert(`העלאה הסתיימה בהצלחה!\nעודכנו: ${updated} משתמשים\nנוספו: ${added} משתמשים`);
    } catch (error) {
      console.error('Error importing users:', error);
      alert('שגיאה ביבוא קובץ האקסל. ודא שהקובץ תקין ובפורמט הנכון.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleAiImport = async () => {
    if (!aiText.trim()) return;
    setIsAiLoading(true);

    try {
      // Fetch API Key
      const docSnap = await getDoc(doc(db, 'config', 'appSettings'));
      const apiKey = docSnap.exists() ? docSnap.data().apiKeys?.openai : null;

      if (!apiKey) {
        alert('לא נמצא מפתח OpenAI בהגדרות המערכת. אנא הוסף בהגדרות מתקדמות.');
        setIsAiLoading(false);
        return;
      }

      const prompt = `
המשתמש הזין טקסט פשוט שמכיל רשימה של אנשים. עליך לחלץ מהטקסט את האנשים ולהחזיר מערך של אובייקטים מסוג JSON בלבד, ללא כל טקסט אחר (כדי שאוכל לעשות JSON.parse).

הטקסט (בדרך כלל גיבוב של שמות, טלפונים ולפעמים אימייל):
"${aiText}"

המבנה הנדרש (חובה להחזיר רק את המערך!):
[
  {
    "firstName": "שם פרטי (חובה)",
    "lastName": "שם משפחה (אם יש, אחרת ריק)",
    "phone": "טלפון (אם יש)",
    "email": "אימייל (אם יש, אחרת לחפש בטקסט)",
    "role": "user" (תמיד 'user' אלא אם מוזכר במפורש מנהל)
  }
]
`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponseText = response.data.choices[0].message.content;
      const cleanedText = aiResponseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsedUsers = JSON.parse(cleanedText);

      if (!Array.isArray(parsedUsers)) {
        throw new Error("AI did not return an array");
      }

      let added = 0;
      let updated = 0;

      for (const row of parsedUsers) {
        const firstName = String(row.firstName || '').trim();
        const lastName = String(row.lastName || '').trim();
        const email = String(row.email || '').trim();
        const phone = String(row.phone || '').trim();
        const role = String(row.role || 'user').trim();

        if (!email && !firstName && !lastName) continue;

        const displayName = `${firstName} ${lastName}`.trim();
        const userData = { firstName, lastName, email, phone, role, name: displayName, displayName, source: 'ai_import' };

        const existingUser = users.find(u =>
          (email && u.email?.toLowerCase() === email.toLowerCase()) ||
          (phone && u.phone === phone)
        );

        if (existingUser) {
          await updateDoc(doc(db, 'users', existingUser.id), userData);
          updated++;
        } else {
          await addDoc(collection(db, 'users'), userData);
          added++;
        }
      }

      await loadUsers();
      alert(`עיבוד AI הסתיים בהצלחה!\nזיהינו ${parsedUsers.length} רשומות.\nעודכנו קיימים: ${updated}\nנוספו חדשים: ${added}`);
      setShowAiModal(false);
      setAiText('');

    } catch (error) {
      console.error('AI Import Error:', error);
      alert('הייתה שגיאה בניתוח הטקסט. אנא ודא שהטקסט ברור או נסה שוב מאוחר יותר.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFindDuplicates = () => {
    const duplicates = [];
    const processedIds = new Set();

    for (let i = 0; i < users.length; i++) {
        if (processedIds.has(users[i].id)) continue;
        const current = users[i];
        const currentGroup = [current];

        for (let j = i + 1; j < users.length; j++) {
            if (processedIds.has(users[j].id)) continue;
            const other = users[j];

            const samePhone = current.phone && other.phone && current.phone === other.phone;
            const sameEmail = current.email && other.email && current.email.toLowerCase() === other.email.toLowerCase();
            
            const name1 = `${current.firstName || ''} ${current.lastName || ''}`.trim().toLowerCase();
            const name1Rev = `${current.lastName || ''} ${current.firstName || ''}`.trim().toLowerCase();
            const name2 = `${other.firstName || ''} ${other.lastName || ''}`.trim().toLowerCase();
            const sameName = name1 && name2 && (name1 === name2 || name1Rev === name2);

            if (samePhone || sameEmail || sameName) {
                currentGroup.push(other);
                processedIds.add(other.id);
            }
        }

        if (currentGroup.length > 1) {
            processedIds.add(current.id);
            duplicates.push(currentGroup);
        }
    }
    
    setDuplicateGroups(duplicates);
    setShowDuplicatesModal(true);
  };

  const handleMergeGroup = async (groupIndex) => {
    const group = duplicateGroups[groupIndex];
    if (!group || group.length < 2) return;

    if (!window.confirm('האם אתה בטוח שברצונך למזג את המשתמשים הללו למשתמש אחד? המשתמשים הנותרים יימחקו מהמערכת.')) return;

    const master = group.find(u => u.email) || group[0];
    const others = group.filter(u => u.id !== master.id);

    const mergedData = { ...master };
    const mergedGroups = new Set(master.groups || []);

    for (const other of others) {
        if (!mergedData.firstName && other.firstName) mergedData.firstName = other.firstName;
        if (!mergedData.lastName && other.lastName) mergedData.lastName = other.lastName;
        if (!mergedData.email && other.email) mergedData.email = other.email;
        if (!mergedData.phone && other.phone) mergedData.phone = other.phone;
        if (other.role && other.role !== 'user') mergedData.role = other.role;
        
        if (other.groups) {
            other.groups.forEach(g => mergedGroups.add(g));
        }
    }

    mergedData.groups = Array.from(mergedGroups);
    mergedData.displayName = `${mergedData.firstName || ''} ${mergedData.lastName || ''}`.trim() || mergedData.displayName || mergedData.name;
    mergedData.name = mergedData.displayName;

    try {
        setLoading(true);
        await updateDoc(doc(db, 'users', master.id), {
            firstName: mergedData.firstName || '',
            lastName: mergedData.lastName || '',
            email: mergedData.email || '',
            phone: mergedData.phone || '',
            role: mergedData.role || 'user',
            groups: mergedData.groups || [],
            displayName: mergedData.displayName || '',
            name: mergedData.name || ''
        });

        for (const other of others) {
            if (other.email === 'guy@mir.co.il') continue;
            await deleteDoc(doc(db, 'users', other.id));
        }

        const dups = [...duplicateGroups];
        dups.splice(groupIndex, 1);
        setDuplicateGroups(dups);
        await loadUsers();
        
        alert('המשתמשים מוזגו בהצלחה!');
    } catch (error) {
        console.error("Error merging users:", error);
        alert('שגיאה במיזוג המשתמשים');
    } finally {
        setLoading(false);
    }
  };

  const handleMergeAllDuplicates = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למזג את כל הכפילויות באופן אוטומטי? פעולה זו אינה הפיכה.')) return;
    
    setLoading(true);
    let successCount = 0;
    
    try {
        for (const group of duplicateGroups) {
            if (!group || group.length < 2) continue;
            
            const master = group.find(u => u.email) || group[0];
            const others = group.filter(u => u.id !== master.id);

            const mergedData = { ...master };
            const mergedGroups = new Set(master.groups || []);

            for (const other of others) {
                if (!mergedData.firstName && other.firstName) mergedData.firstName = other.firstName;
                if (!mergedData.lastName && other.lastName) mergedData.lastName = other.lastName;
                if (!mergedData.email && other.email) mergedData.email = other.email;
                if (!mergedData.phone && other.phone) mergedData.phone = other.phone;
                if (other.role && other.role !== 'user') mergedData.role = other.role;
                
                if (other.groups) {
                    other.groups.forEach(g => mergedGroups.add(g));
                }
            }

            mergedData.groups = Array.from(mergedGroups);
            mergedData.displayName = `${mergedData.firstName || ''} ${mergedData.lastName || ''}`.trim() || mergedData.displayName || mergedData.name;
            mergedData.name = mergedData.displayName;

            await updateDoc(doc(db, 'users', master.id), {
                firstName: mergedData.firstName || '',
                lastName: mergedData.lastName || '',
                email: mergedData.email || '',
                phone: mergedData.phone || '',
                role: mergedData.role || 'user',
                groups: mergedData.groups || [],
                displayName: mergedData.displayName || '',
                name: mergedData.name || ''
            });

            for (const other of others) {
                if (other.email === 'guy@mir.co.il') continue;
                await deleteDoc(doc(db, 'users', other.id));
            }
            successCount++;
        }
        
        setDuplicateGroups([]);
        await loadUsers();
        alert(`מוזגו בהצלחה ${successCount} קבוצות של כפילויות!`);
        setShowDuplicatesModal(false);
    } catch (error) {
        console.error("Error merging all users:", error);
        alert('שגיאה במיזוג כפילויות');
    } finally {
        setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedUsers = users
    .filter(user => {
      const search = searchTerm.toLowerCase();
      return (
        (user.displayName || user.name || '').toLowerCase().includes(search) ||
        (user.firstName || '').toLowerCase().includes(search) ||
        (user.lastName || '').toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search) ||
        (user.phone || '').toLowerCase().includes(search) ||
        getRoleLabel(user.role).toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      if (sortField === 'displayName') {
        aValue = getDisplayName(a);
        bValue = getDisplayName(b);
      } else if (sortField === 'role') {
        aValue = getRoleLabel(a.role);
        bValue = getRoleLabel(b.role);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return <div className="loading">טוען משתמשים...</div>;
  }

  return (
    <div>
      <style>{`
        .user-row .swap-btn { opacity: 0; transition: opacity 0.2s; background: #f8fafc; border: 1px solid #e2e8f0; color: #8b5cf6; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
        .user-row:hover .swap-btn { opacity: 1; }
        .user-row .swap-btn:hover { background: #e2e8f0; }
      `}</style>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          ניהול משתמשים <span className="text-muted text-sm">({users.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleFindDuplicates} className="btn" style={{ width: 'auto', background: '#ef4444', color: 'white', border: 'none' }}>
            <Users size={20} weight="fill" /> טיפול בכפילויות
          </button>
          <button onClick={() => setShowAiModal(true)} className="btn" style={{ width: 'auto', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none' }}>
            <MagicWand size={20} weight="fill" /> הוספה חכמה עם AI
          </button>
          <button onClick={handleDownloadExcel} className="btn btn-secondary" style={{ width: 'auto' }}>
            <DownloadSimple size={20} /> ייצוא / הורדה לאקסל
          </button>
          <label className="btn btn-accent" style={{ width: 'auto', cursor: 'pointer', margin: 0 }}>
            <UploadSimple size={20} /> העלה קובץ
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {showAiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#7e22ce' }}>
                <MagicWand size={24} weight="fill" /> הוספת משתמשים מכל טקסט
              </h3>
              <button onClick={() => setShowAiModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
              הדבק כאן כל טקסט (מתוך הודעת וואטסאפ, מייל, רשימה מבולגנת וכו') המכיל שמות וטלפונים. המערכת תזהה לבד את המשתמשים ותוסיף אותם מיד לרשימה!
            </p>
            <textarea
              className="form-input"
              rows="6"
              placeholder="למשל: דני כהן 050-1234567, דינה לוי 054-9876543..."
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              disabled={isAiLoading}
            ></textarea>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowAiModal(false)} disabled={isAiLoading}>ביטול</button>
              <button
                className="btn"
                style={{ width: 'auto', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none' }}
                onClick={handleAiImport}
                disabled={isAiLoading || !aiText.trim()}
              >
                {isAiLoading ? <Spinner className="spin" size={20} /> : 'נתח ויבא לאתר'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicatesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <Users size={24} weight="fill" /> טיפול בכפילויות משתמשים ({duplicateGroups.length} קבוצות)
              </h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {duplicateGroups.length > 0 && (
                  <button className="btn" style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', width: 'auto' }} onClick={handleMergeAllDuplicates}>
                    <Check size={18} /> אשר הכל
                  </button>
                )}
                <button onClick={() => setShowDuplicatesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
              </div>
            </div>
            
            {duplicateGroups.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#10b981', padding: '40px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                איזה יופי! לא נמצאו משתמשים כפולים במערכת.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
                {duplicateGroups.map((group, index) => (
                  <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0 }}>קבוצת כפילות #{index + 1} ({group.length} רשומות)</h4>
                      <button className="btn" style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', width: 'auto', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleMergeGroup(index)}>
                        <GitMerge size={18} /> מזג למשתמש אחד
                      </button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '8px' }}>שם פרטי</th>
                          <th style={{ padding: '8px' }}>שם משפחה</th>
                          <th style={{ padding: '8px' }}>אימייל</th>
                          <th style={{ padding: '8px' }}>טלפון</th>
                          <th style={{ padding: '8px' }}>קבוצות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map(user => (
                          <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px' }}>{user.firstName || '-'}</td>
                            <td style={{ padding: '8px' }}>{user.lastName || '-'}</td>
                            <td style={{ padding: '8px' }} dir="ltr">{user.email || '-'}</td>
                            <td style={{ padding: '8px' }} dir="ltr">{user.phone || '-'}</td>
                            <td style={{ padding: '8px' }}>{user.groups?.join(', ') || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
          <MagnifyingGlass size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="חיפוש משתמש לפי שם, אימייל, טלפון או תפקיד..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingRight: '40px' }}
          />
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', paddingBottom: '20px' }}>
        <table className="table" style={{ minWidth: '900px', width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>
              <th onClick={() => handleSort('displayName')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                שם תצוגה / מלא {sortField === 'displayName' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              <th onClick={() => handleSort('firstName')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                שם פרטי {sortField === 'firstName' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              <th onClick={() => handleSort('lastName')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                שם משפחה {sortField === 'lastName' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              <th onClick={() => handleSort('email')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                אימייל {sortField === 'email' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              <th onClick={() => handleSort('phone')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                טלפון {sortField === 'phone' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              <th onClick={() => handleSort('role')} style={{ padding: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                תפקיד {sortField === 'role' && (sortDirection === 'asc' ? <CaretUp size={14} /> : <CaretDown size={14} />)}
              </th>
              {availableGroups.map(g => (
                 <th key={g} style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center', minWidth: '80px', fontSize: '0.85rem' }} title={g}>
                   {formatGroupHeader(g)}
                 </th>
              ))}
              <th style={{ padding: '12px', textAlign: 'center' }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedUsers.map((user, index) => (
              <tr key={user.id} className="user-row" style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        defaultValue={getDisplayName(user)}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== getDisplayName(user)) {
                            handleInlineUpdate(user.id, 'displayName', val);
                          }
                        }}
                        placeholder="שם תצוגה"
                        style={{ minWidth: '120px', padding: '8px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          className="form-input"
                          defaultValue={user.firstName || ''}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val !== (user.firstName || '')) {
                              handleInlineUpdate(user.id, 'firstName', val);
                            }
                          }}
                          placeholder="שם פרטי"
                          style={{ minWidth: '90px', padding: '8px' }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        defaultValue={user.lastName || ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (user.lastName || '')) {
                            handleInlineUpdate(user.id, 'lastName', val);
                          }
                        }}
                        placeholder="שם משפחה"
                        style={{ minWidth: '90px', padding: '8px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="email"
                        className="form-input"
                        defaultValue={user.email || ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (user.email || '')) {
                            handleInlineUpdate(user.id, 'email', val);
                          }
                        }}
                        style={{ minWidth: '150px', padding: '8px' }}
                        dir="ltr"
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="tel"
                        className="form-input"
                        defaultValue={user.phone ? user.phone.replace(/-/g, '') : ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim().replace(/-/g, '');
                          if (val !== (user.phone ? user.phone.replace(/-/g, '') : '')) {
                            handleInlineUpdate(user.id, 'phone', val);
                          }
                        }}
                        style={{ minWidth: '110px', padding: '8px' }}
                        dir="ltr"
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select
                        className="form-input"
                        value={user.role || 'user'}
                        onChange={(e) => {
                           if (user.email === 'guy@mir.co.il') return;
                           handleInlineUpdate(user.id, 'role', e.target.value);
                        }}
                        style={{ minWidth: '130px', padding: '8px' }}
                        disabled={user.email === 'guy@mir.co.il'}
                      >
                        <option value="user">משתמש</option>
                        <option value="admin">מנהל מערכת</option>
                        <option value="culture_admin">מנהל תרבות</option>
                        <option value="pub_admin">מנהל פאב</option>
                        <option value="professionals_admin">מנהל בעלי מקצוע</option>
                        <option value="librarian">מנהל ספרייה</option>
                        <option value="recipes_admin">מנהל מתכונים</option>
                        <option value="archive_admin">מנהל ארכיון</option>
                      </select>
                    </td>

                    {availableGroups.map(g => (
                      <td key={g} style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={(user.groups || []).includes(g)}
                          onChange={(e) => handleGroupToggle(user, index, g, e.target.checked, e.nativeEvent.shiftKey, filteredAndSortedUsers)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', margin: '0 auto', display: 'block' }}
                          title={g}
                        />
                      </td>
                    ))}

                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn btn-secondary" onClick={() => handleSwapNames(user)} title="החלף פרטי ומשפחה" style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex' }}>
                          <ArrowsLeftRight size={18} />
                        </button>
                        <button
                          onClick={() => handlePasswordReset(user.email, getDisplayName(user))}
                          className="btn btn-secondary"
                          style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex', color: '#8b5cf6' }}
                          title="שלח איפוס סיסמה"
                        >
                          <Key size={18} />
                        </button>
                        {user.email !== 'guy@mir.co.il' && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="btn btn-secondary"
                            style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex', color: '#ef4444' }}
                            title="מחק משתמש"
                          >
                            <Trash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
              </tr>
            ))}
            {filteredAndSortedUsers.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b', fontSize: '1.1rem' }}>
                  לא נמצאו משתמשים התואמים את החיפוש.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div >
  );
}

export default ManageUsers;