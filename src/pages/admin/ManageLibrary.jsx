// src/pages/admin/ManageLibrary.jsx - עדכון מלא עם חיפוש בהשאלות פעילות
import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase/config';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save,
  UserPlus,
  CheckCircle,
  Search,
  Calendar,
  AlertCircle,
  Filter
} from 'lucide-react';

function ManageLibrary() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('books');
  
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    description: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    availability: 'all'
  });
  const [categories, setCategories] = useState([]);

  const [borrowings, setBorrowings] = useState([]);
  const [filteredBorrowings, setFilteredBorrowings] = useState([]);
  const [borrowingSearchTerm, setBorrowingSearchTerm] = useState('');
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin' || userProfile?.role === 'librarian') {
      loadBooks();
      loadBorrowings();
      loadUsers();
    }
  }, [userProfile]);

  useEffect(() => {
    applyFilters();
  }, [books, searchTerm, filters]);

  useEffect(() => {
    applyBorrowingFilters();
  }, [borrowings, borrowingSearchTerm]);

  const checkAdminAccess = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists()) {
        navigate('/');
        return;
      }

      const userData = userDoc.data();
      if (userData.role !== 'admin' && userData.role !== 'librarian') {
        navigate('/');
        return;
      }

      setUserProfile(userData);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadBooks = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'books'));
      const booksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBooks(booksData);

      const uniqueCategories = [...new Set(booksData.map(book => book.category).filter(Boolean))];
      setCategories(uniqueCategories.sort());
    } catch (error) {
      console.error('Error loading books:', error);
    }
  };

  const applyFilters = () => {
    let result = [...books];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(book => 
        book.title?.toLowerCase().includes(term) ||
        book.author?.toLowerCase().includes(term) ||
        book.isbn?.toLowerCase().includes(term) ||
        book.category?.toLowerCase().includes(term) ||
        book.description?.toLowerCase().includes(term)
      );
    }

    if (filters.category) {
      result = result.filter(book => book.category === filters.category);
    }

    if (filters.availability === 'available') {
      result = result.filter(book => book.available === true);
    } else if (filters.availability === 'borrowed') {
      result = result.filter(book => book.available === false);
    }

    setFilteredBooks(result);
  };

  const applyBorrowingFilters = () => {
    let result = [...borrowings];

    if (borrowingSearchTerm.trim()) {
      const term = borrowingSearchTerm.toLowerCase().trim();
      result = result.filter(borrowing => 
        borrowing.book?.title?.toLowerCase().includes(term) ||
        borrowing.book?.author?.toLowerCase().includes(term) ||
        borrowing.user?.name?.toLowerCase().includes(term) ||
        borrowing.user?.email?.toLowerCase().includes(term) ||
        borrowing.user?.phone?.toLowerCase().includes(term)
      );
    }

    setFilteredBorrowings(result);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      category: '',
      availability: 'all'
    });
  };

  const loadBorrowings = async () => {
    try {
      const q = query(
        collection(db, 'borrowings'),
        where('returnDate', '==', null)
      );
      const snapshot = await getDocs(q);
      
      const borrowingsData = await Promise.all(
        snapshot.docs.map(async (borrowDoc) => {
          const borrowing = { id: borrowDoc.id, ...borrowDoc.data() };
          
          const bookDoc = await getDoc(doc(db, 'books', borrowing.bookId));
          borrowing.book = bookDoc.exists() ? { id: bookDoc.id, ...bookDoc.data() } : null;
          
          const userDoc = await getDoc(doc(db, 'users', borrowing.userId));
          borrowing.user = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;

          return borrowing;
        })
      );

      borrowingsData.sort((a, b) => {
        const dateA = a.borrowDate?.toDate ? a.borrowDate.toDate() : new Date(0);
        const dateB = b.borrowDate?.toDate ? b.borrowDate.toDate() : new Date(0);
        return dateB - dateA;
      });

      setBorrowings(borrowingsData);
      setFilteredBorrowings(borrowingsData);
    } catch (error) {
      console.error('Error loading borrowings:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), {
          ...bookForm,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'books'), {
          ...bookForm,
          available: true,
          createdAt: serverTimestamp()
        });
      }

      setShowBookModal(false);
      setEditingBook(null);
      setBookForm({ title: '', author: '', isbn: '', category: '', description: '' });
      loadBooks();
    } catch (error) {
      console.error('Error saving book:', error);
      alert('שגיאה בשמירת הספר');
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הספר?')) return;

    try {
      await deleteDoc(doc(db, 'books', bookId));
      loadBooks();
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('שגיאה במחיקת הספר');
    }
  };

  const handleBorrowBook = async (e) => {
    e.preventDefault();

    if (!selectedBook || !selectedUser || !dueDate) {
      alert('נא למלא את כל השדות');
      return;
    }

    try {
      await addDoc(collection(db, 'borrowings'), {
        bookId: selectedBook.id,
        userId: selectedUser.id,
        borrowDate: serverTimestamp(),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        returnDate: null,
        createdBy: auth.currentUser.uid
      });

      await updateDoc(doc(db, 'books', selectedBook.id), {
        available: false
      });

      setShowBorrowModal(false);
      setSelectedBook(null);
      setSelectedUser(null);
      setDueDate('');
      setSearchUser('');
      loadBooks();
      loadBorrowings();
    } catch (error) {
      console.error('Error borrowing book:', error);
      alert('שגיאה בהשאלת הספר');
    }
  };

  const handleReturnBook = async (borrowingId, bookId) => {
    if (!confirm('האם אתה בטוח שברצונך לסמן את הספר כהוחזר?')) return;

    try {
      await updateDoc(doc(db, 'borrowings', borrowingId), {
        returnDate: serverTimestamp()
      });

      await updateDoc(doc(db, 'books', bookId), {
        available: true
      });

      loadBooks();
      loadBorrowings();
    } catch (error) {
      console.error('Error returning book:', error);
      alert('שגיאה בהחזרת הספר');
    }
  };

  const openEditBook = (book) => {
    setEditingBook(book);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      category: book.category || '',
      description: book.description || ''
    });
    setShowBookModal(true);
  };

  const openBorrowModal = (book) => {
    setSelectedBook(book);
    setShowBorrowModal(true);
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

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

  const activeFiltersCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.availability !== 'all') count++;
    return count;
  };

  if (loading) {
    return <div className="loading">טוען...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <style>{`
        .desktop-table { 
          display: none;
        }
        .mobile-cards { 
          display: block; 
        }
        
        @media (min-width: 769px) {
          .desktop-table { 
            display: table !important; 
          }
          .mobile-cards { 
            display: none !important; 
          }
        }
        
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }
        .admin-table thead {
          background: var(--bg-secondary);
        }
        .admin-table th {
          padding: 12px 16px;
          text-align: right;
          font-weight: bold;
          font-size: 14px;
          border-bottom: 2px solid var(--border-color);
        }
        .admin-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          font-size: 14px;
        }
        .admin-table tbody tr:hover {
          background: var(--bg-secondary);
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>ניהול ספרייה</h2>
        <button 
          onClick={() => navigate('/admin')}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ← חזרה
        </button>
      </div>

      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--border-color)',
        padding: '0',
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderRadius: '8px 8px 0 0'
      }}>
        <button
          onClick={() => setActiveTab('books')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'books' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'books' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'books' ? 'bold' : 'normal'
          }}
        >
          מאגר ספרים ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('borrowings')}
          style={{
            padding: '16px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'borrowings' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'borrowings' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'borrowings' ? 'bold' : 'normal'
          }}
        >
          השאלות פעילות ({borrowings.length})
        </button>
      </div>

      {activeTab === 'books' && (
        <>
          <button
            onClick={() => {
              setEditingBook(null);
              setBookForm({ title: '', author: '', isbn: '', category: '', description: '' });
              setShowBookModal(true);
            }}
            style={{
              padding: '12px 24px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={20} />
            הוסף ספר חדש
          </button>

          <div style={{ marginBottom: '24px', background: 'white', padding: '16px', borderRadius: '8px' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חפש לפי שם ספר, מחבר, ISBN, קטגוריה או תיאור..."
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  fontSize: '16px',
                  border: '2px solid var(--border-color)',
                  borderRadius: '8px'
                }}
              />
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  right: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)'
                }} 
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  padding: '8px 16px',
                  background: showFilters ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  color: showFilters ? 'white' : 'var(--text-primary)',
                  border: showFilters ? 'none' : '2px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Filter size={16} />
                סינון
                {activeFiltersCount() > 0 && (
                  <span style={{
                    background: showFilters ? 'white' : 'var(--primary-color)',
                    color: showFilters ? 'var(--primary-color)' : 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {activeFiltersCount()}
                  </span>
                )}
              </button>

              {(searchTerm || activeFiltersCount() > 0) && (
                <button
                  onClick={clearFilters}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--danger-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <X size={16} />
                  נקה הכל
                </button>
              )}

              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                מציג {filteredBooks.length} מתוך {books.length} ספרים
              </div>
            </div>

            {showFilters && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    קטגוריה
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '16px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    <option value="">כל הקטגוריות</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                    זמינות
                  </label>
                  <select
                    value={filters.availability}
                    onChange={(e) => setFilters({ ...filters, availability: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '16px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  >
                    <option value="all">הכל</option>
                    <option value="available">זמין</option>
                    <option value="borrowed">מושאל</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {filteredBooks.length === 0 ? (
            <div style={{ 
              background: 'white', 
              padding: '60px 20px', 
              textAlign: 'center',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                {books.length === 0 ? 'אין ספרים במאגר' : 'לא נמצאו ספרים התואמים לחיפוש'}
              </div>
            </div>
          ) : (
            <>
              <table className="admin-table desktop-table">
                <thead>
                  <tr>
                    <th>שם הספר</th>
                    <th>מחבר</th>
                    <th>ISBN</th>
                    <th>קטגוריה</th>
                    <th>זמינות</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map(book => (
                    <tr key={book.id}>
                      <td style={{ fontWeight: '600' }}>{book.title}</td>
                      <td>{book.author}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{book.isbn || '-'}</td>
                      <td>{book.category || '-'}</td>
                      <td>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          background: book.available ? '#D1FAE5' : '#FEE2E2',
                          color: book.available ? '#059669' : '#DC2626'
                        }}>
                          {book.available ? 'זמין' : 'מושאל'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {book.available && (
                            <button
                              onClick={() => openBorrowModal(book)}
                              style={{
                                padding: '6px',
                                background: 'var(--secondary-color)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="השאל ספר"
                            >
                              <UserPlus size={16} color="white" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditBook(book)}
                            style={{
                              padding: '6px',
                              background: 'var(--primary-color)',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="ערוך"
                          >
                            <Edit2 size={16} color="white" />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book.id)}
                            style={{
                              padding: '6px',
                              background: 'var(--danger-color)',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="מחק"
                          >
                            <Trash2 size={16} color="white" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredBooks.map(book => (
                  <div key={book.id} style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
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
                        {book.isbn && (
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            ISBN: {book.isbn}
                          </p>
                        )}
                        {book.category && (
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            קטגוריה: {book.category}
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
                          {book.available ? 'זמין' : 'מושאל'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {book.available && (
                          <button
                            onClick={() => openBorrowModal(book)}
                            style={{
                              padding: '8px',
                              background: 'var(--secondary-color)',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            <UserPlus size={20} color="white" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditBook(book)}
                          style={{
                            padding: '8px',
                            background: 'var(--primary-color)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={20} color="white" />
                        </button>
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          style={{
                            padding: '8px',
                            background: 'var(--danger-color)',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={20} color="white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'borrowings' && (
        <>
          {/* חיפוש השאלות */}
          <div style={{ marginBottom: '24px', background: 'white', padding: '16px', borderRadius: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={borrowingSearchTerm}
                onChange={(e) => setBorrowingSearchTerm(e.target.value)}
                placeholder="חפש לפי ספר, מחבר, שם שואל, אימייל או טלפון..."
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  fontSize: '16px',
                  border: '2px solid var(--border-color)',
                  borderRadius: '8px'
                }}
              />
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  right: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)'
                }} 
              />
              {borrowingSearchTerm && (
                <button
                  onClick={() => setBorrowingSearchTerm('')}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              מציג {filteredBorrowings.length} מתוך {borrowings.length} השאלות
            </div>
          </div>

          {filteredBorrowings.length === 0 ? (
            <div style={{ 
              background: 'white', 
              padding: '60px 20px', 
              textAlign: 'center',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                {borrowings.length === 0 ? 'אין השאלות פעילות' : 'לא נמצאו השאלות התואמות לחיפוש'}
              </div>
            </div>
          ) : (
            <>
              <table className="admin-table desktop-table">
                <thead>
                  <tr>
                    <th>ספר</th>
                    <th>מחבר</th>
                    <th>שואל</th>
                    <th>תאריך השאלה</th>
                    <th>תאריך החזרה</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBorrowings.map(borrowing => {
                    const daysRemaining = getDaysRemaining(borrowing.dueDate);
                    const isOverdue = daysRemaining < 0;
                    
                    return (
                      <tr key={borrowing.id}>
                        <td style={{ fontWeight: '600' }}>{borrowing.book?.title || '-'}</td>
                        <td>{borrowing.book?.author || '-'}</td>
                        <td>
                          <div>
                            <div style={{ fontWeight: '600' }}>{borrowing.user?.name || '-'}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {borrowing.user?.email || '-'}
                            </div>
                          </div>
                        </td>
                        <td>{formatDate(borrowing.borrowDate)}</td>
                        <td style={{ 
                          fontWeight: '600',
                          color: isOverdue ? 'var(--danger-color)' : 'var(--text-primary)'
                        }}>
                          {formatDate(borrowing.dueDate)}
                        </td>
                        <td>
                          {isOverdue ? (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '13px',
                              fontWeight: '600',
                              background: '#FEE2E2',
                              color: '#DC2626'
                            }}>
                              איחור {Math.abs(daysRemaining)} ימים
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '13px',
                              fontWeight: '600',
                              background: '#D1FAE5',
                              color: '#059669'
                            }}>
                              נותרו {daysRemaining} ימים
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => handleReturnBook(borrowing.id, borrowing.bookId)}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--secondary-color)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle size={16} />
                            החזר
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredBorrowings.map(borrowing => {
                  const daysRemaining = getDaysRemaining(borrowing.dueDate);
                  const isOverdue = daysRemaining < 0;

                  return (
                    <div key={borrowing.id} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      {borrowing.book && borrowing.user && (
                        <>
                          <div style={{ marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>
                              {borrowing.book.title}
                            </h3>
                            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
                              {borrowing.book.author}
                            </p>
                          </div>

                          <div style={{ 
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            marginBottom: '12px'
                          }}>
                            <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                              שואל: {borrowing.user.name}
                            </p>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                              {borrowing.user.email}
                            </p>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                              <Calendar size={16} color="var(--text-secondary)" />
                              <span style={{ color: 'var(--text-secondary)' }}>
                                תאריך השאלה: {formatDate(borrowing.borrowDate)}
                              </span>
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              fontSize: '15px',
                              fontWeight: '600',
                              color: isOverdue ? 'var(--danger-color)' : 'var(--text-primary)'
                            }}>
                              {isOverdue ? (
                                <AlertCircle size={16} color="var(--danger-color)" />
                              ) : (
                                <Calendar size={16} color="var(--text-secondary)" />
                              )}
                              <span>
                                תאריך החזרה: {formatDate(borrowing.dueDate)}
                                {isOverdue && ` (איחור של ${Math.abs(daysRemaining)} ימים)`}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleReturnBook(borrowing.id, borrowing.bookId)}
                            style={{
                              width: '100%',
                              padding: '12px',
                              background: 'var(--secondary-color)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            <CheckCircle size={20} />
                            סמן כהוחזר
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Book Modal */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                {editingBook ? 'עריכת ספר' : 'ספר חדש'}
              </h2>
              <button
                onClick={() => {
                  setShowBookModal(false);
                  setEditingBook(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveBook}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  שם הספר *
                </label>
                <input
                  type="text"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  שם המחבר *
                </label>
                <input
                  type="text"
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  ISBN
                </label>
                <input
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  קטגוריה
                </label>
                <input
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  placeholder="למשל: רומן, מתח, ביוגרפיה..."
                  list="categories-list"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
                <datalist id="categories-list">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  תיאור
                </label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <button 
                type="submit" 
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={20} />
                שמור
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {showBorrowModal && selectedBook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                השאלת ספר
              </h2>
              <button
                onClick={() => {
                  setShowBorrowModal(false);
                  setSelectedBook(null);
                  setSelectedUser(null);
                  setSearchUser('');
                  setDueDate('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ 
              padding: '16px', 
              background: 'var(--bg-secondary)', 
              borderRadius: '8px', 
              marginBottom: '24px' 
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                {selectedBook.title}
              </h3>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0 }}>
                {selectedBook.author}
              </p>
            </div>

            <form onSubmit={handleBorrowBook}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  חיפוש משתמש *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="שם או אימייל..."
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 12px',
                      fontSize: '16px',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  />
                  <Search 
                    size={20} 
                    style={{ 
                      position: 'absolute', 
                      right: '12px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)'
                    }} 
                  />
                </div>
                
                {searchUser && (
                  <div style={{ 
                    marginTop: '8px', 
                    maxHeight: '200px', 
                    overflow: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}>
                    {filteredUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchUser(user.name);
                        }}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          background: selectedUser?.id === user.id ? 'var(--bg-secondary)' : 'white',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ fontWeight: '600' }}>{user.name}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{user.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  תאריך החזרה *
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <button 
                type="submit" 
                disabled={!selectedUser}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: selectedUser ? 'var(--primary-color)' : '#9CA3AF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedUser ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <UserPlus size={20} />
                השאל ספר
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageLibrary;