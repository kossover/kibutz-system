import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, getDocs, where } from 'firebase/firestore';

function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '⚡',
    order: 0
  });

  // אייקונים לבחירה
  const availableIcons = [
  // כללי / קיימים
  '⚡','🔧','🌳','🏗️','💻','🚗','🎨','🔨',
  '🏠','🚿','💡','🪴','🔑','📱','🎭','📷',
  '🎵','🏋️','🍳','🧹','🪟','🚪','🛠️','⚙️',
  '🔌','📺','🖥️','🖨️','📞','🎓','📚','✂️',
  '💅','💇','🐕','🐈','🌺','🧺','🧼','🧴',

  // 🍽️ אוכל
  '🍽️','🍔','🍕','🍜','🍣','🍰','☕','🧑‍🍳',

  // ⚖️ עו"ד
  '⚖️','🏛️','📜','🧑‍⚖️','🖋️',

  // 💼 ייעוץ פיננסי
  '💼','💰','📈','📉','💳','🏦','🧮',

  // 🩺 טיפולים
  '🧑‍⚕️','🩺','💉','💊','🧪','💆','💆‍♀️','🧘',

  // 🤝 נותני שירות
  '🤝','🧰','🧽','🧯','🧑‍🔧','🧑‍💼','🚚','📦',

  // 🏗️ תכנון ובינוי
  '📐','📏','🧱',
  

  // 🎒 חוגים
  '🎒','🏫','🎨','🎸','🥋','🏊','🤖','🔬','🧩','📖',

  // 🖌️ אומנות
  '🖌️','🖼️','🎬','🎼','🎻','🎷','🩰','🎙️',

  // 👶 בייביסיטר
  '👶','🍼','🧸','🧑‍🍼','🧑‍👧','🧑‍👦'
];

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'professionalCategories'), 
      (snapshot) => {
        const categoriesData = [];
        snapshot.forEach((doc) => {
          categoriesData.push({ id: doc.id, ...doc.data() });
        });
        setCategories(categoriesData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'professionalCategories', editingCategory.id), formData);
        alert('הקטגוריה עודכנה בהצלחה!');
      } else {
        await addDoc(collection(db, 'professionalCategories'), formData);
        alert('הקטגוריה נוספה בהצלחה!');
      }

      resetForm();
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה: ' + error.message);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon,
      order: category.order || 0
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (categoryId, categoryName) => {
    // בדוק אם יש בעלי מקצוע בקטגוריה זו
    const profsQuery = query(
      collection(db, 'professionals'),
      where('category', '==', categoryName)
    );
    const profsSnapshot = await getDocs(profsQuery);

    if (!profsSnapshot.empty) {
      alert(`לא ניתן למחוק - יש ${profsSnapshot.size} בעלי מקצוע בקטגוריה זו`);
      return;
    }

    if (window.confirm('האם אתה בטוח שברצונך למחוק את הקטגוריה?')) {
      try {
        await deleteDoc(doc(db, 'professionalCategories', categoryId));
        alert('הקטגוריה נמחקה בהצלחה!');
      } catch (error) {
        console.error('Error:', error);
        alert('אירעה שגיאה במחיקה');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      icon: '⚡',
      order: 0
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
          ניהול קטגוריות ({categories.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '12px 24px',
            background: showForm ? 'var(--danger-color)' : 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {showForm ? '✕ ביטול' : '+ קטגוריה חדשה'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
            {editingCategory ? 'ערוך קטגוריה' : 'קטגוריה חדשה'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">שם הקטגוריה *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: חשמל"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">סדר תצוגה</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">בחר אייקון *</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '48px',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px'
                }}>
                  {formData.icon}
                </div>
                <div style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                  האייקון שנבחר
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '8px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {availableIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    style={{
                      fontSize: '32px',
                      padding: '12px',
                      background: formData.icon === icon ? 'var(--primary-color)' : 'white',
                      border: formData.icon === icon ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingCategory ? 'עדכן' : 'הוסף'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* רשימת קטגוריות */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {categories.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            אין קטגוריות עדיין
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            {categories.map((category) => (
              <div
                key={category.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  marginBottom: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '40px' }}>{category.icon}</div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {category.name}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      סדר: {category.order || 0}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(category)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✏️ ערוך
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--danger-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️ מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageCategories;