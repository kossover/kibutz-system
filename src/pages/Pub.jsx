import { ShoppingCart } from 'lucide-react';
import BackButton from '../components/BackButton';

function Pub() {
  return (
    <div className="page-container">
      <h1 className="page-title">הפאב</h1>
      <BackButton pageKey="pub" />

      <div className="empty-state" style={{ marginTop: '80px' }}>
        <div className="empty-state-icon" style={{ fontSize: '80px' }}>🍺</div>
        <div className="empty-state-text" style={{ fontSize: '28px', marginBottom: '16px' }}>
          בקרוב...
        </div>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          מערכת הזמנות לפאב בבנייה
          <br />
          בינתיים תוכלו להזמין בדרכים המסורתיות 😊
        </div>
      </div>
    </div>
  );
}

export default Pub;