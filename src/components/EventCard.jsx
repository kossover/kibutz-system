import { Calendar, Clock, MapPin, Users } from 'lucide-react';

function EventCard({ event, onClick }) {
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'numeric' 
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      {event.imageUrl && (
        <img 
          src={event.imageUrl} 
          alt={event.title}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
            borderRadius: '8px',
            marginBottom: '12px'
          }}
        />
      )}
      
      <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px' }}>
        {event.title}
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} />
          <span>{formatDate(event.date)}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} />
          <span>{formatTime(event.date)}</span>
        </div>
        
        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} />
            <span>{event.location}</span>
          </div>
        )}
        
        {event.maxParticipants && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} />
            <span>נרשמו: {event.currentParticipants || 0}/{event.maxParticipants}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventCard;