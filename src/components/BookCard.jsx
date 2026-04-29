// src/components/BookCard.jsx - קובץ חדש
import { BookOpen, User } from 'lucide-react';

function BookCard({ book, onBorrow, showBorrowButton = false }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <BookOpen size={24} color="var(--primary-color)" />
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
              {book.title}
            </h3>
          </div>
          
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {book.author}
          </p>
          
          {book.category && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              קטגוריה: {book.category}
            </p>
          )}
          
          {book.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
              {book.description}
            </p>
          )}
          
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            background: book.available ? '#D1FAE5' : '#FEE2E2',
            color: book.available ? '#059669' : '#DC2626'
          }}>
            {book.available ? 'זמין להשאלה' : 'מושאל'}
          </div>
        </div>

        {showBorrowButton && book.available && onBorrow && (
          <button
            onClick={() => onBorrow(book)}
            style={{
              padding: '8px 16px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <User size={16} />
            השאל
          </button>
        )}
      </div>
    </div>
  );
}

export default BookCard;