import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Save, Loader, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function LibrarySchedule() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [openDays, setOpenDays] = useState(null);
  const [shifts, setShifts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettingsAndShifts();
  }, [currentDate]);

  const loadSettingsAndShifts = async () => {
    setLoading(true);
    try {
      // Load open days
      let currentOpenDays = openDays;
      if (!currentOpenDays) {
        const settingsDoc = await getDoc(doc(db, 'settings', 'library'));
        if (settingsDoc.exists() && settingsDoc.data().openDays) {
          currentOpenDays = settingsDoc.data().openDays;
          setOpenDays(currentOpenDays);
        } else {
          currentOpenDays = {};
        }
      }

      // Load shifts for current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // 1-12
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const prefix = `${year}-${monthStr}`;

      // We'll just fetch all shifts and filter by prefix since it's small,
      // or we can just fetch everything. To be efficient, let's query where document ID starts with prefix.
      // Firestore doesn't support startsWith on document IDs easily, so we can store the month as a field.
      // Alternatively, fetch all and filter in memory, or use >= and <=.
      const startId = `${prefix}-01`;
      const endId = `${prefix}-31`;

      const shiftsRef = collection(db, 'libraryShifts');
      // Just fetch all for simplicity, or we can use bounds
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const renderCalendar = () => {
    if (!openDays) return null;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();

    const monthStr = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;

    const days = [];
    const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    // Fill empty slots before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Fill actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const dayOfWeek = dayDate.getDay();
      const isOpen = openDays[dayOfWeek];
      
      const dayStr = i < 10 ? `0${i}` : `${i}`;
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      days.push(
        <div key={dateKey} className={`calendar-day ${isOpen ? 'open' : 'closed'} ${
          new Date().toDateString() === dayDate.toDateString() ? 'today' : ''
        }`}>
          <div className="day-number">{i}</div>
          {isOpen ? (
            <div className="shift-input-container">
              <input
                type="text"
                placeholder="הכנס שם..."
                value={shifts[dateKey] !== undefined ? shifts[dateKey] : ''}
                onChange={(e) => {
                  setShifts(prev => ({ ...prev, [dateKey]: e.target.value }));
                }}
                onBlur={(e) => handleSaveShift(dateKey, e.target.value)}
                className="shift-input"
              />
            </div>
          ) : (
            <div className="closed-text">סגור</div>
          )}
        </div>
      );
    }

    return (
      <div className="calendar-container">
        <div className="calendar-header-row">
          {weekdays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {days}
        </div>
      </div>
    );
  };

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  return (
    <div className="page-container">
      <style>{`
        .calendar-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          overflow: hidden;
          margin-top: 24px;
        }
        .calendar-header-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
        }
        .calendar-weekday {
          padding: 12px;
          text-align: center;
          font-weight: bold;
          color: var(--text-secondary);
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }
        .calendar-day {
          min-height: 100px;
          border-bottom: 1px solid var(--border-color);
          border-left: 1px solid var(--border-color);
          padding: 8px;
          display: flex;
          flex-direction: column;
        }
        .calendar-day:nth-child(7n) {
          border-left: none;
        }
        .calendar-day.empty {
          background: var(--bg-secondary);
          opacity: 0.5;
        }
        .calendar-day.closed {
          background: #f9fafb;
        }
        .calendar-day.today {
          background: #eff6ff;
        }
        .day-number {
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text-primary);
        }
        .today .day-number {
          color: var(--primary-color);
        }
        .closed-text {
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
          margin-top: auto;
          margin-bottom: auto;
        }
        .shift-input-container {
          margin-top: auto;
        }
        .shift-input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          text-align: center;
          transition: border-color 0.2s;
        }
        .shift-input:focus {
          border-color: var(--primary-color);
          outline: none;
        }
        .shift-input:not(:placeholder-shown) {
          background: #d1fae5;
          border-color: #059669;
          color: #065f46;
          font-weight: 600;
        }
        
        @media (max-width: 768px) {
          .calendar-weekday {
            font-size: 12px;
            padding: 8px 4px;
          }
          .calendar-day {
            min-height: 80px;
            padding: 4px;
          }
          .shift-input {
            padding: 4px;
            font-size: 12px;
          }
          .day-number {
            font-size: 14px;
            margin-bottom: 4px;
          }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <CalendarIcon size={32} color="var(--primary-color)" />
        <h1 className="page-title" style={{ margin: 0 }}>שיבוץ משמרות ספרייה</h1>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'white',
            border: '1px solid var(--border-color)',
            padding: '8px 16px',
            borderRadius: '24px',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <ArrowRight size={20} />
          חזרה למסך הבית
        </button>
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
            ניתן להזין שם בתיבת הטקסט עבור הימים הפתוחים. השינוי נשמר אוטומטית ביציאה מהתיבה.
          </p>
          {renderCalendar()}
        </>
      )}
    </div>
  );
}

export default LibrarySchedule;
