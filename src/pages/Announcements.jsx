import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Megaphone, Warning } from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsData = [];
      snapshot.forEach((doc) => {
        announcementsData.push({ id: doc.id, ...doc.data() });
      });
      setAnnouncements(announcementsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching announcements:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">טוען הודעות...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">לוח מודעות</h1>
      <BackButton pageKey="announcements" />

      {announcements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Megaphone size={48} weight="duotone" color="var(--text-secondary)" />
          </div>
          <div className="empty-state-text">אין הודעות כרגע</div>
        </div>
      ) : (
        <div>
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="card"
              style={{
                borderRight: announcement.priority === 'high'
                  ? '4px solid var(--danger-color)'
                  : '4px solid var(--primary-color)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px'
              }}>
                {announcement.priority === 'high' ? (
                  <Warning size={24} weight="fill" color="var(--danger-color)" />
                ) : (
                  <Megaphone size={24} weight="duotone" color="var(--primary-color)" />
                )}

                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: announcement.priority === 'high'
                      ? 'var(--danger-color)'
                      : 'var(--text-primary)'
                  }}>
                    {announcement.title}
                  </h3>

                  <p style={{
                    fontSize: '18px',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                    marginBottom: '12px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {announcement.content}
                  </p>

                  <div style={{
                    fontSize: '16px',
                    color: 'var(--text-secondary)'
                  }}>
                    {formatDate(announcement.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Announcements;