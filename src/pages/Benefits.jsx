import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, User, Home, Building2, Map, 
  ExternalLink, Briefcase, GraduationCap, HeartHandshake, 
  Tractor, Palette, Landmark, TreePine, ChevronDown, PhoneCall
} from 'lucide-react';
import { benefitsDb } from '../data/benefitsDb';
import BackButton from '../components/BackButton';

const CategoryIcon = ({ category, size = 16 }) => {
  switch (category) {
    case 'שירותים מקוונים': return <PhoneCall size={size} />;
    case 'תרבות ופנאי': return <Palette size={size} />;
    case 'תעסוקה ויזמות': return <Briefcase size={size} />;
    case 'תשתיות ופיתוח': return <Map size={size} />;
    case 'כלכלה ורווחה': 
    case 'כלכלה ופיתוח עסקי': return <Landmark size={size} />;
    case 'חקלאות וסביבה': return <Tractor size={size} />;
    case 'רווחה ושירותים חברתיים': return <HeartHandshake size={size} />;
    case 'חינוך ונוער': 
    case 'הכשרות ופיתוח מקצועי': return <GraduationCap size={size} />;
    default: return <TreePine size={size} />;
  }
};

export default function Benefits() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('הכל');
  const [selectedProvider, setSelectedProvider] = useState('הכל');

  const audiences = ['הכל', 'חבר קיבוץ', 'תושב', 'הקיבוץ כאגודה'];
  const providers = ['הכל', 'מועצה אזורית', 'התנועה הקיבוצית', 'מדינה וגופים נוספים'];

  const filteredData = useMemo(() => {
    return benefitsDb.filter(item => {
      const matchSearch = item.title.includes(searchTerm) || item.description.includes(searchTerm) || item.category.includes(searchTerm);
      const matchAudience = selectedAudience === 'הכל' || item.audiences.includes(selectedAudience);
      const matchProvider = selectedProvider === 'הכל' || item.provider === selectedProvider;
      return matchSearch && matchAudience && matchProvider;
    });
  }, [searchTerm, selectedAudience, selectedProvider]);

  return (
    <div className="page-container" style={{ maxWidth: '1400px' }}>
      <BackButton pageKey="benefits" />
      {/* Header */}
      <div className="page-title">
        <TreePine size={32} color="var(--primary-color)" />
        <h1>זכויות והטבות בעמק</h1>
      </div>
      <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
        מרכז המידע האינטראקטיבי לתושבי וחברי עמק המעיינות. מצא בקלות את הזכויות, התקציבים והשירותים שמגיעים לך.
      </p>

      {/* אזור החיפוש והסינון */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* חיפוש טקסטואלי */}
        <div>
          <label className="form-label">חיפוש חופשי</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="למשל: מלגות, מס, תרבות..." 
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingRight: '40px' }} // RTL padding
            />
            <Search style={{ position: 'absolute', right: '12px', top: '14px', color: 'var(--text-light)' }} size={20} />
          </div>
        </div>

        {/* סינון לפי מי אני */}
        <div>
          <label className="form-label">מי אני?</label>
          <div style={{ position: 'relative' }}>
            <select 
              className="form-input"
              value={selectedAudience}
              onChange={(e) => setSelectedAudience(e.target.value)}
            >
              {audiences.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>

        {/* סינון לפי ספק השירות */}
        <div>
          <label className="form-label">מי נותן השירות?</label>
          <div style={{ position: 'relative' }}>
            <select 
              className="form-input"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
            >
              {providers.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>

      </div>

      {/* תוצאות */}
      <div className="flex-between mb-4" style={{ padding: '0 8px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          נמצאו {filteredData.length} תוצאות
        </h2>
        {(searchTerm !== '' || selectedAudience !== 'הכל' || selectedProvider !== 'הכל') && (
          <button 
            onClick={() => { setSearchTerm(''); setSelectedAudience('הכל'); setSelectedProvider('הכל'); }}
            style={{ color: 'var(--accent-color)', fontSize: '0.95rem', fontWeight: '600' }}
          >
            נקה סינונים
          </button>
        )}
      </div>

      {filteredData.length === 0 ? (
        <div className="empty-state">
          <Filter className="empty-state-icon" />
          <div className="empty-state-text">לא נמצאו תוצאות לחיפוש שלך</div>
          <p className="text-muted">נסה לשנות את מילות החיפוש או הסינונים</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filteredData.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', marginBottom: 0 }}>
              
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <span className="chip chip-gray" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <CategoryIcon category={item.category} size={14} />
                  {item.category}
                </span>
                
                <span className={`chip ${
                  item.provider === 'מועצה אזורית' ? 'chip-blue' :
                  item.provider === 'התנועה הקיבוצית' ? 'chip-green' :
                  'chip-amber'
                }`}>
                  {item.provider}
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                {item.title}
              </h3>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px', flexGrow: 1, lineHeight: '1.6' }}>
                {item.description}
              </p>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {item.audiences.map(aud => (
                    <span key={aud} className="chip chip-gray" style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {aud === 'הקיבוץ כאגודה' ? <Home size={12}/> : <User size={12}/>}
                      {aud}
                    </span>
                  ))}
                </div>
                
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  למידע נוסף
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
