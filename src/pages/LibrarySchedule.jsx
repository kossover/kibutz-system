import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Loader, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function LibrarySchedule() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [openDays, setOpenDays] = useState(null);
  const [librarians, setLibrarians] = useState([]);
  const [shifts, setShifts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettingsAndShifts();
  }, [currentDate]);

  const loadSettingsAndShifts = async () => {
    setLoading(true);
    try {
      // Load open days and librarians
      let currentOpenDays = openDays;
      if (!currentOpenDays || librarians.length === 0) {
        const settingsDoc = await getDoc(doc(db, 'settings', 'library'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.openDays) {
            currentOpenDays = data.openDays;
            setOpenDays(currentOpenDays);
          } else {
            currentOpenDays = {};
          }
          if (data.librarians) {
            setLibrarians(data.librarians);
          }
        } else {
          currentOpenDays = {};
        }
      }

      // Load shifts for current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // 1-12
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const prefix = `${year}-${monthStr}`;

      const startId = `${prefix}-01`;
      const endId = `${prefix}-31`;

      const shiftsRef = collection(db, 'libraryShifts');
      const snapshot = await getDocs(shiftsRef);
      const loadedShifts = {};
      snapshot.forEach(doc => {
        if (doc.id >= startId && doc.id <= endId) {
          loadedShifts[doc.id] = doc.data().assignee;
        }
      });
      setShifts(loadedShifts);
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const handleSaveShift = async (dateStr, assigneeName) => {
    try {
      if (!assigneeName.trim()) {
        await deleteDoc(doc(db, 'libraryShifts', dateStr));
        setShifts(prev => {
          const newShifts = { ...prev };
          delete newShifts[dateStr];
          return newShifts;
        });
      } else {
        await setDoc(doc(db, 'libraryShifts', dateStr), { assignee: assigneeName.trim() });
        setShifts(prev => ({ ...prev, [dateStr]: assigneeName.trim() }));
      }
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('שגיאה בשמירת השיבוץ');
    }
  };

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const renderScheduleList = () => {
    if (!openDays) return null;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const monthStr = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
    const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    const openDaysList = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const dayOfWeek = dayDate.getDay();
      
      if (openDays[dayOfWeek]) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        const dateKey = `${year}-${monthStr}-${dayStr}`;
        const isToday = new Date().toDateString() === dayDate.toDateString();

        openDaysList.push(
          <div key={dateKey} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            border: isToday ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {i} ב{monthNames[month]}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                יום {weekdays[dayOfWeek]}
              </span>
            </div>
            
            <div style={{ flex: 1, maxWidth: '200px' }}>
              <select
                value={shifts[dateKey] || ''}
                onChange={(e) => handleSaveShift(dateKey, e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  background: shifts[dateKey] ? '#d1fae5' : '#f9fafb',
                  color: shifts[dateKey] ? '#065f46' : 'inherit',
                  fontWeight: shifts[dateKey] ? 'bold' : 'normal',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                <option value="">בחר/י ספרנית...</option>
                {librarians.map(lib => (
                  <option key={lib.id} value={lib.name}>{lib.name}</option>
                ))}
              </select>
            </div>
          </div>
        );
      }
    }

    if (openDaysList.length === 0) {
      return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>אין ימי פתיחה מוגדרים בחודש זה.</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {openDaysList}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <CalendarIcon size={32} color="var(--primary-color)" />
        <h1 className="page-title" style={{ margin: 0 }}>שיבוץ משמרות ספרייה</h1>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'white',
          padding: '8px 16px',
          borderRadius: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <button 
            onClick={handlePrevMonth}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}
          >
            <ChevronRight size={24} />
          </button>
          
          <span style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '120px', textAlign: 'center' }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          
          <button 
            onClick={handleNextMonth}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader size={48} className="spin" color="var(--primary-color)" />
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
            בחר/י ספרנית מהרשימה עבור כל יום פתיחה. השינוי נשמר אוטומטית.
          </p>
          {renderScheduleList()}
        </>
      )}
    </div>
  );
}

export default LibrarySchedule;
