import { useState, useEffect } from 'react';
import { db } from '../../firebase/config'; // Fixed import path
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  Briefcase, 
  Trash, 
  PencilSimple, 
  DownloadSimple, 
  UploadSimple, 
  Plus, 
  X,
  Check,
  Funnel,
  FileXls
} from '@phosphor-icons/react';

function ManageProfessionals() {
  const [professionals, setProfessionals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState(null);
  const [uploading, setUploading] = useState(false);

  // הצעות
  const [suggestions, setSuggestions] = useState([]);
  const [editingSuggestionId, setEditingSuggestionId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    profession: '',
    category: '',
    phone: '',
    description: '',
    recommendedBy: '',
  });

  useEffect(() => {
    const unsubscribeCategories = onSnapshot(collection(db, 'professionalCategories'),(snapshot) => {
        const categoriesData = [];
        snapshot.forEach((doc) => categoriesData.push({ id: doc.id, ...doc.data() }));
        setCategories(categoriesData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    );

    const unsubscribe = onSnapshot(collection(db, 'professionals'), (snapshot) => {
      const profsData = [];
      snapshot.forEach((doc) => profsData.push({ id: doc.id, ...doc.data() }));
      setProfessionals(profsData.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });

    const unsubSug = onSnapshot(collection(db, 'professionalSuggestions'), (snapshot) => {
      const arr = [];
      snapshot.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setSuggestions(arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    });

    return () => { unsubscribeCategories(); unsubscribe(); unsubSug(); };
  }, []);

  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[^\d+]/g, '');
    cleaned = cleaned.replace(/^\+/, '');
    if (cleaned.startsWith('972')) cleaned = '0' + cleaned.substring(3);
    if (!cleaned.startsWith('0') && cleaned.length === 9) cleaned = '0' + cleaned;
    if (cleaned.length === 10) return cleaned.substring(0, 3) + '-' + cleaned.substring(3);
    return cleaned;
  };

  const downloadTemplate = () => {
    const template = [{
        'שם מלא': 'דוגמה: משה כהן',
        'שם חברה': 'דוגמה: חשמל ישראל (אופציונלי)',
        'מקצוע': 'דוגמה: חשמלאי מוסמך',
        'קטגוריה': categories.length > 0 ? categories[0].name : 'חשמל',
        'טלפון': '050-1234567',
        'תיאור': 'דוגמה: תיקון והתקנת מערכות חשמל (אופציונלי)',
        'מומלץ על ידי': 'דוגמה: יוסי לוי (אופציונלי)',
      }];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'תבנית');
    XLSX.writeFile(wb, 'תבנית_בעלי_מקצוע.xlsx');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      let successCount = 0; let errorCount = 0; const errors = [];

      for (const row of jsonData) {
        try {
          if (row['שם מלא']?.includes('דוגמה:')) continue;
          const name = row['שם מלא']?.trim();
          const phone = cleanPhoneNumber(row['טלפון']);
          const profession = row['מקצוע']?.trim();
          const category = row['קטגוריה']?.trim();

          if (!name || !phone || !profession || !category) {
            errors.push(`שורה עם שם "${name || 'לא ידוע'}" - חסרים שדות חובה`);
            errorCount++; continue;
          }
          const categoryExists = categories.some((cat) => cat.name === category);
          if (!categoryExists) {
            errors.push(`שורה "${name}" - קטגוריה "${category}" לא קיימת`);
            errorCount++; continue;
          }
          await addDoc(collection(db, 'professionals'), {
            name, company: row['שם חברה']?.trim() || '', profession, category,
            phone, description: row['תיאור']?.trim() || '', recommendedBy: row['מומלץ על ידי']?.trim() || '',
          });
          successCount++;
        } catch (err) {
          console.error(err); errors.push(`שורה "${row['שם מלא']}" - ${err.message}`); errorCount++;
        }
      }
      let message = `✅ ${successCount} בעלי מקצוע נוספו בהצלחה!`;
      if (errorCount > 0) message += `\n\n❌ ${errorCount} שורות נכשלו:\n${errors.slice(0, 5).join('\n')}`;
      alert(message);
    } catch (error) {
      console.error('Error:', error); alert('אירעה שגיאה בקריאת הקובץ');
    } finally {
      setUploading(false); event.target.value = '';
    }
  };

  const exportToExcel = () => {
    const data = professionals.map((prof) => ({
      'שם מלא': prof.name,
      'שם חברה': prof.company || '',
      'מקצוע': prof.profession,
      'קטגוריה': prof.category,
      'טלפון': prof.phone,
      'תיאור': prof.description || '',
      'מומלץ על ידי': prof.recommendedBy || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'בעלי מקצוע');
    XLSX.writeFile(wb, `בעלי_מקצוע_${new Date().toLocaleDateString('he-IL')}.xlsx`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = { ...formData, phone: cleanPhoneNumber(formData.phone) };
      if (editingProfessional) {
        await updateDoc(doc(db, 'professionals', editingProfessional.id), dataToSave);
        alert('בעל המקצוע עודכן בהצלחה!');
      } else {
        await addDoc(collection(db, 'professionals'), dataToSave);
        alert('בעל המקצוע נוסף בהצלחה!');
      }
      if (editingSuggestionId && !editingProfessional) {
        await deleteDoc(doc(db, 'professionalSuggestions', editingSuggestionId));
        setEditingSuggestionId(null);
      }
      resetForm();
    } catch (error) {
      console.error('Error:', error); alert('אירעה שגיאה: ' + error.message);
    }
  };

  const handleEdit = (professional) => {
    setEditingProfessional(professional);
    setEditingSuggestionId(null);
    setFormData({
      name: professional.name, company: professional.company || '', profession: professional.profession,
      category: professional.category, phone: professional.phone, description: professional.description || '',
      recommendedBy: professional.recommendedBy || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (professionalId) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את בעל המקצוע?')) return;
    try {
      await deleteDoc(doc(db, 'professionals', professionalId));
    } catch (error) { console.error('Error:', error); alert('אירעה שגיאה במחיקה'); }
  };

  const resetForm = () => {
    setFormData({ name: '', company: '', profession: '', category: '', phone: '', description: '', recommendedBy: '' });
    setEditingProfessional(null); setEditingSuggestionId(null); setShowForm(false);
  };

  const approveSuggestionQuick = async (sug) => {
    if (!window.confirm(`לאשר את "${sug.name}"?`)) return;
    try {
      await addDoc(collection(db, 'professionals'), {
        name: sug.name, company: sug.company || '', profession: sug.profession, category: sug.category,
        phone: cleanPhoneNumber(sug.phone), description: sug.description || '', recommendedBy: sug.recommendedBy || '',
      });
      await deleteDoc(doc(db, 'professionalSuggestions', sug.id));
      alert('ההצעה אושרה.');
    } catch (e) { console.error(e); alert('שגיאה באישור'); }
  };

  const editSuggestionIntoForm = (sug) => {
    setEditingProfessional(null); setEditingSuggestionId(sug.id);
    setFormData({
      name: sug.name || '', company: sug.company || '', profession: sug.profession || '',
      category: sug.category || '', phone: cleanPhoneNumber(sug.phone || ''),
      description: sug.description || '', recommendedBy: sug.recommendedBy || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSuggestion = async (sugId) => {
    if (!window.confirm('למחוק את ההצעה הזו?')) return;
    try { await deleteDoc(doc(db, 'professionalSuggestions', sugId)); } 
    catch (e) { console.error(e); alert('שגיאה במחיקה'); }
  };

  return (
    <div>
      <div className="flex-between mb-4 flex-wrap gap-2">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          ניהול בעלי מקצוע <span className="text-muted text-sm">({professionals.length})</span>
        </h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={downloadTemplate} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            <DownloadSimple size={18} /> תבנית
          </button>
          
          <label className="btn btn-accent" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            <UploadSimple size={18} /> {uploading ? '...' : 'יבוא'}
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
          </label>

          {professionals.length > 0 && (
            <button onClick={exportToExcel} className="btn btn-secondary" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
              <FileXls size={18} /> יצוא
            </button>
          )}

          <button onClick={() => { setShowForm((v) => !v); setEditingProfessional(null); setEditingSuggestionId(null); }} className={`btn ${showForm ? 'btn-danger' : 'btn-primary'}`} style={{width: 'auto', fontSize: '0.9rem', padding: '8px 12px'}}>
            {showForm ? <><X size={18} /> ביטול</> : <><Plus size={18} /> הוסף</>}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="flex-between mb-2">
            <h3 className="text-bold" style={{fontSize: '1.1rem'}}>הצעות ממתינות ({suggestions.length})</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {suggestions.map((sug) => (
              <div key={sug.id} className="card" style={{ border: '2px solid #FCD34D', background: '#FFFBEB' }}>
                <div className="flex-between mb-2">
                  <div className="font-bold">{sug.name}</div>
                  <span className="chip chip-amber">{sug.category}</span>
                </div>
                <div className="text-sm text-muted mb-2">{sug.profession} • {sug.phone}</div>
                {sug.recommendedBy && <div className="text-sm text-muted mb-2">הומלץ ע"י: {sug.recommendedBy}</div>}
                
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-success btn-sm" onClick={() => approveSuggestionQuick(sug)}>
                    <Check size={16} /> אשר
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => editSuggestionIntoForm(sug)}>
                    <PencilSimple size={16} /> ערוך
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSuggestion(sug.id)}>
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card">
          <h3 className="text-bold mb-4" style={{ fontSize: '1.25rem' }}>
            {editingProfessional ? 'ערוך בעל מקצוע' : editingSuggestionId ? 'ערוך הצעה ואשר' : 'בעל מקצוע חדש'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">שם מלא *</label>
                <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">שם חברה</label>
                <input type="text" className="form-input" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} placeholder="אופציונלי" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">מקצוע *</label>
                <input type="text" className="form-input" value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">קטגוריה *</label>
                <select className="form-input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
                  <option value="">בחר...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">טלפון *</label>
              <input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
            </div>

            <div className="form-group">
              <label className="form-label">תיאור</label>
              <textarea className="form-input" rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{resize:'vertical'}} />
            </div>

            <div className="form-group">
              <label className="form-label">מומלץ על ידי</label>
              <input type="text" className="form-input" value={formData.recommendedBy} onChange={(e) => setFormData({ ...formData, recommendedBy: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="submit" className="btn btn-primary">{editingProfessional ? 'עדכן' : editingSuggestionId ? 'אשר והוסף' : 'הוסף'}</button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">ביטול</button>
            </div>
          </form>
        </div>
      )}

      {/* Professionals List */}
      <div style={{ display: 'grid', gap: 12 }}>
        {professionals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Briefcase size={48} /></div>
            <div className="empty-state-text">אין בעלי מקצוע ברשימה</div>
          </div>
        ) : (
          professionals.map((prof) => (
            <div key={prof.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="flex-between mb-2">
                    <h3 className="text-bold" style={{ fontSize: '1.1rem', margin: 0 }}>{prof.name}</h3>
                    <span className="chip chip-gray" style={{fontSize: '0.8rem'}}>{prof.category}</span>
                  </div>
                  {prof.company && <div className="text-sm text-muted">{prof.company}</div>}
                  <div className="text-sm text-muted" style={{marginTop: 4}}>{prof.profession} • {prof.phone}</div>
                  {prof.recommendedBy && <div className="chip chip-green" style={{ marginTop: 8, fontSize: '0.75rem', padding: '2px 8px' }}>מומלץ ע"י {prof.recommendedBy}</div>}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleEdit(prof)} className="btn btn-secondary" style={{width: 'auto', padding: 8, minWidth: 'auto'}}>
                    <PencilSimple size={18} />
                  </button>
                  <button onClick={() => handleDelete(prof.id)} className="btn btn-danger" style={{width: 'auto', padding: 8, minWidth: 'auto'}}>
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ManageProfessionals;