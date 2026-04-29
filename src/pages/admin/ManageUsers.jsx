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
  CaretDown
} from '@phosphor-icons/react';

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'user'
  });

  // AI Import State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

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
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setEditForm({
      displayName: user.displayName || user.name || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'user'
    });
  };

  const handleSave = async (userId) => {
    try {
      const updateData = {
        displayName: editForm.displayName.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
      };

      // Force admin role for the main admin
      if (editForm.email === 'guy@mir.co.il') {
        updateData.role = 'admin';
      }

      // Ensure 'name' field is populated for backwards compatibility, prioritizing displayName
      updateData.name = updateData.displayName || `${updateData.firstName} ${updateData.lastName}`.trim();

      await updateDoc(doc(db, 'users', userId), updateData);

      await loadUsers();
      setEditingUser(null);
      alert('המשתמש עודכן בהצלחה!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('שגיאה בעדכון המשתמש');
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

  const handleDelete = async (userId, userName) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש ${userName}? (פעולה זו אינה הפיכה)`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        await loadUsers();
        alert('המשתמש נמחק בהצלחה!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('שגיאה במחיקת המשתמש');
      }
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

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'שם פרטי': 'ישראל',
        'שם משפחה': 'ישראלי',
        'אימייל': 'israel@example.com',
        'טלפון': '050-1234567',
        'תפקיד (user/admin/culture_admin/pub_admin...)': 'user'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משתמשים");
    XLSX.writeFile(wb, "users_template.xlsx");
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
        const firstName = row['שם פרטי']?.toString().trim() || '';
        const lastName = row['שם משפחה']?.toString().trim() || '';
        const email = row['אימייל']?.toString().trim() || '';
        const phone = row['טלפון']?.toString().trim() || '';
        const role = row['תפקיד (user/admin/culture_admin/pub_admin...)']?.toString().trim() || 'user';

        if (!email && !firstName && !lastName) continue;

        const displayName = `${firstName} ${lastName}`.trim();

        const userData = {
          firstName,
          lastName,
          email,
          phone,
          role,
          name: displayName,
          displayName,
          source: 'excel_import'
        };

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
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          ניהול משתמשים <span className="text-muted text-sm">({users.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAiModal(true)} className="btn" style={{ width: 'auto', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none' }}>
            <MagicWand size={20} weight="fill" /> הוספה חכמה עם AI
          </button>
          <button onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ width: 'auto' }}>
            <DownloadSimple size={20} /> תבנית להעלאה
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
              <th style={{ padding: '12px', textAlign: 'center' }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                {editingUser === user.id ? (
                  <>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.displayName}
                        onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                        placeholder="שם תצוגה"
                        style={{ minWidth: '120px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        placeholder="שם פרטי"
                        style={{ minWidth: '100px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        placeholder="שם משפחה"
                        style={{ minWidth: '100px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="email"
                        className="form-input"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        style={{ minWidth: '150px' }}
                        dir="ltr"
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="tel"
                        className="form-input"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        style={{ minWidth: '120px' }}
                        dir="ltr"
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select
                        className="form-input"
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        style={{ minWidth: '140px' }}
                        disabled={user.email === 'guy@mir.co.il'}
                      >
                        <option value="user">משתמש רגיל</option>
                        <option value="admin">מנהל מערכת</option>
                        <option value="culture_admin">מנהל תרבות</option>
                        <option value="pub_admin">מנהל פאב</option>
                        <option value="professionals_admin">מנהל בעלי מקצוע</option>
                        <option value="librarian">מנהל ספרייה</option>
                        <option value="recipes_admin">מנהל מתכונים</option>
                        <option value="archive_admin">מנהל ארכיון</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => handleSave(user.id)} className="btn btn-secondary" style={{ padding: '6px', color: '#15803d' }} title="שמור">
                          <Check size={18} />
                        </button>
                        <button onClick={() => setEditingUser(null)} className="btn btn-secondary" style={{ padding: '6px', color: '#ef4444' }} title="ביטול">
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={18} className="text-muted" />
                        {getDisplayName(user)}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>{user.firstName || '-'}</td>
                    <td style={{ padding: '12px' }}>{user.lastName || '-'}</td>
                    <td style={{ padding: '12px' }} dir="ltr">{user.email || '-'}</td>
                    <td style={{ padding: '12px' }} dir="ltr">{user.phone || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <div className={`chip ${getRoleBadgeClass(user.role)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={14} />
                        {getRoleLabel(user.role)}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(user)}
                          className="btn btn-secondary"
                          style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex' }}
                          title="ערוך משתמש"
                        >
                          <PencilSimple size={18} />
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
                            onClick={() => handleDelete(user.id, getDisplayName(user))}
                            className="btn btn-secondary"
                            style={{ padding: '6px', minWidth: 'auto', display: 'inline-flex', color: '#ef4444' }}
                            title="מחק משתמש"
                          >
                            <Trash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                )}
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