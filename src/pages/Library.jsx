// src/pages/Library.jsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { BookOpen, Calendar, Clock, AlertCircle } from 'lucide-react';
import BackButton from '../components/BackButton';

function Library() {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyBorrowings();
  }, []);

  const loadMyBorrowings = async () => {
    if (!auth.currentUser) return;

    try {
      const q = query(
        collection(db, 'borrowings'),
        where('userId', '==', auth.currentUser.uid),
        where('returnDate', '==', null)
      );

      const snapshot = await getDocs(q);
      const borrowingsData = await Promise.all(
        snapshot.docs.map(async (borrowDoc) => {
          const borrowing = { id: borrowDoc.id, ...borrowDoc.data() };

          const bookDoc = await getDoc(doc(db, 'books', borrowing.bookId));
          borrowing.book = bookDoc.exists() ? { id: bookDoc.id, ...bookDoc.data() } : null;

          return borrowing;
        })
      );

      borrowingsData.sort((a, b) => {
        const dateA = a.borrowDate?.toDate ? a.borrowDate.toDate() : new Date(0);
        const dateB = b.borrowDate?.toDate ? b.borrowDate.toDate() : new Date(0);
        return dateB - dateA;
      });

      setBorrowings(borrowingsData);
    } catch (error) {
      console.error('Error loading borrowings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (dueDate) => {
    if (!dueDate) return null;
    const due = dueDate.toDate ? dueDate.toDate() : new Date(dueDate.seconds * 1000);
    const today = new Date();
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDueDateColor = (daysRemaining) => {
    if (daysRemaining < 0) return 'var(--danger-color)';
    if (daysRemaining <= 3) return '#F59E0B';
    return 'var(--secondary-color)';
  };

  if (loading) {
    return (
      <div className="page-container">
        <h1 className="page-title">הספרים שלי</h1>
        <div className="loading">טוען...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">הספרים שלי</h1>
      <BackButton pageKey="library" />

      {borrowings.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '80px' }}>
          <div className="empty-state-icon" style={{ fontSize: '80px' }}>📚</div>
          <div className="empty-state-text" style={{ fontSize: '28px', marginBottom: '16px' }}>
            אין לך ספרים מושאלים
          </div>
          <div style={{ fontSize: '18px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            פנה למנהל הספרייה כדי לשאול ספרים
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {borrowings.map((borrowing) => {
            const daysRemaining = getDaysRemaining(borrowing.dueDate);
            const isOverdue = daysRemaining < 0;

            return (
              <div key={borrowing.id} className="card">
                {borrowing.book ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                      <BookOpen size={24} color="var(--primary-color)" />
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>
                          {borrowing.book.title}
                        </h3>
                        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
                          {borrowing.book.author}
                        </p>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                        <Calendar size={16} color="var(--text-secondary)" />
                        <span style={{ color: 'var(--text-secondary)' }}>
                          תאריך השאלה: {formatDate(borrowing.borrowDate)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                        <Clock size={16} style={{ color: getDueDateColor(daysRemaining) }} />
                        <span style={{ color: getDueDateColor(daysRemaining), fontWeight: '600' }}>
                          {isOverdue ? (
                            <>איחור של {Math.abs(daysRemaining)} ימים</>
                          ) : daysRemaining === 0 ? (
                            <>יש להחזיר היום</>
                          ) : (
                            <>נותרו {daysRemaining} ימים להחזרה</>
                          )}
                        </span>
                      </div>

                      {isOverdue && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          background: '#FEE2E2',
                          borderRadius: '8px',
                          marginTop: '4px'
                        }}>
                          <AlertCircle size={16} color="var(--danger-color)" />
                          <span style={{ fontSize: '14px', color: 'var(--danger-color)', fontWeight: '600' }}>
                            אנא החזר את הספר בהקדם
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>מידע על הספר לא זמין</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Library;