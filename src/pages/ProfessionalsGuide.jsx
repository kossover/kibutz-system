import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlass, 
  Toolbox, 
  PlusCircle, 
  WhatsappLogo, 
  PhoneCall,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Wrench,
  PaintRoller,
  Lightning
} from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function ProfessionalsGuide() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    {
      id: 'intro',
      title: 'ברוכים הבאים למדריך בעלי המקצוע',
      text: 'כאן תוכלו ללמוד כיצד להשתמש במאגר בעלי המקצוע שלנו ביעילות. המאגר מאפשר למצוא בקלות אנשי מקצוע מומלצים, ליצור איתם קשר מהיר, וגם להציע אנשי מקצוע חדשים שאתם מכירים.',
      visual: (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Toolbox size={80} weight="duotone" color="var(--primary-color)" />
          <h3 style={{ marginTop: '1rem', color: 'var(--text-color)' }}>מדריך קצר - מתחילים</h3>
        </div>
      )
    },
    {
      id: 'search',
      title: 'איך מחפשים?',
      text: 'בראש הדף תמצאו את שורת החיפוש. תוכלו להקליד שם של בעל מקצוע, מקצוע (למשל "חשמלאי" או "אינסטלטור"), או שם של חברה.',
      visual: (
        <div style={{ padding: '2rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="חפש לפי שם, מקצוע או חברה..." 
              readOnly
              value="חשמל"
              style={{ paddingRight: '48px', margin: 0, pointerEvents: 'none' }}
            />
            <MagnifyingGlass size={20} weight="bold" color="var(--text-secondary)" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          {/* Animated pointer */}
          <div className="pointer-animation" style={{ position: 'absolute', top: '60%', left: '40%', zIndex: 10 }}>
            <div style={{ width: 20, height: 20, background: 'rgba(99, 102, 241, 0.4)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 10, left: -5 }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86 3.12 7.02c.16.36.57.51.93.35l2.45-1.09c.36-.16.51-.57.35-.93l-3.13-7.03 5.44-.81c.44-.07.61-.62.29-.91L6.34 2.86c-.32-.3-.84-.08-.84.35z" fill="#1e293b" />
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'filter',
      title: 'סינון לפי קטגוריות',
      text: 'מתחת לשורת החיפוש ישנם כפתורי קטגוריות (למשל: שיפוצים, גינון, חשמל). לחיצה על קטגוריה תציג רק את בעלי המקצוע מאותו התחום. המספר הקטן מראה כמה בעלי מקצוע יש בכל קטגוריה.',
      visual: (
        <div style={{ padding: '2rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
          <button className="cat-chip" style={{ background: 'var(--primary-color)', color: 'white', pointerEvents: 'none' }}>
            <span className="emj"><Lightning size={18} weight="duotone" /></span> חשמל <span style={{ opacity: .7, fontSize: 12 }}>3</span>
          </button>
          <button className="cat-chip" style={{ background: 'white', color: 'var(--text-color)', pointerEvents: 'none' }}>
            <span className="emj"><PaintRoller size={18} weight="duotone" /></span> שיפוצים <span style={{ opacity: .7, fontSize: 12 }}>5</span>
          </button>
          <button className="cat-chip" style={{ background: 'white', color: 'var(--text-color)', pointerEvents: 'none' }}>
            <span className="emj"><Wrench size={18} weight="duotone" /></span> אינסטלציה <span style={{ opacity: .7, fontSize: 12 }}>2</span>
          </button>
          
          <div className="pointer-animation" style={{ position: 'absolute', top: '70%', right: '25%', zIndex: 10 }}>
            <div style={{ width: 20, height: 20, background: 'rgba(99, 102, 241, 0.4)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 10, left: -5 }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86 3.12 7.02c.16.36.57.51.93.35l2.45-1.09c.36-.16.51-.57.35-.93l-3.13-7.03 5.44-.81c.44-.07.61-.62.29-.91L6.34 2.86c-.32-.3-.84-.08-.84.35z" fill="#1e293b" />
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'contact',
      title: 'יצירת קשר בקליק',
      text: 'בכל כרטיס של בעל מקצוע תמצאו כפתורים מהירים: "התקשר" לשיחת טלפון רגילה, ו-"WhatsApp" לשליחת הודעה ישירות לווטסאפ של בעל המקצוע.',
      visual: (
        <div style={{ padding: '1.5rem', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'relative' }}>
          <h4 style={{ margin: '0 0 5px', fontSize: '1.1rem' }}>ישראל ישראלי</h4>
          <p style={{ margin: '0 0 15px', color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>חשמלאי מוסמך</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-success" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
              <WhatsappLogo size={18} weight="fill" /> WhatsApp
            </button>
            <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
              <PhoneCall size={18} weight="bold" /> התקשר
            </button>
          </div>
          
          <div className="pointer-animation" style={{ position: 'absolute', top: '70%', right: '25%', zIndex: 10 }}>
            <div style={{ width: 20, height: 20, background: 'rgba(99, 102, 241, 0.4)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 10, left: -5 }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86 3.12 7.02c.16.36.57.51.93.35l2.45-1.09c.36-.16.51-.57.35-.93l-3.13-7.03 5.44-.81c.44-.07.61-.62.29-.91L6.34 2.86c-.32-.3-.84-.08-.84.35z" fill="#1e293b" />
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'suggest',
      title: 'הוספת בעל מקצוע למאגר',
      text: 'מכירים מישהו מומלץ? לחצו על "הצע בעל מקצוע", מלאו את הפרטים שלו, וההמלצה תעבור לאישור מנהל לפני שתפורסם לכולם. (שימו לב: יש להתחבר למערכת כדי להציע)',
      visual: (
        <div style={{ padding: '2rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none', fontWeight: 'bold' }}>
            <PlusCircle size={20} weight="duotone" /> הצע בעל מקצוע
          </button>
          
          <div className="pointer-animation" style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <div style={{ width: 20, height: 20, background: 'rgba(99, 102, 241, 0.4)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', top: 10, left: -5 }}>
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86 3.12 7.02c.16.36.57.51.93.35l2.45-1.09c.36-.16.51-.57.35-.93l-3.13-7.03 5.44-.81c.44-.07.61-.62.29-.91L6.34 2.86c-.32-.3-.84-.08-.84.35z" fill="#1e293b" />
            </svg>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Done - navigate to professionals page
      navigate('/professionals');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="page-container" style={{ direction: 'rtl', fontFamily: '"Noto Sans Hebrew", sans-serif', maxWidth: '600px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .cat-chip {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid var(--border-color); background: white; color: var(--text-primary);
          padding: 8px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
          font-size: 14px; font-family: inherit;
        }
      `}</style>
      <BackButton pageKey="professionals_guide" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem' }}>הסבר: מדריך בעלי מקצוע</h1>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.9rem' }} onClick={() => navigate('/professionals')}>
          מעבר לבעלי מקצוע
        </button>
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '2rem' }}>
        {steps.map((_, idx) => (
          <div 
            key={idx} 
            style={{ 
              height: '8px', 
              width: idx === currentStep ? '24px' : '8px', 
              background: idx === currentStep ? 'var(--primary-color)' : 'var(--border-color)', 
              borderRadius: '4px',
              transition: 'all 0.3s ease'
            }} 
          />
        ))}
      </div>

      <div className="card" style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#1e293b' }}>{step.title}</h2>
          <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.6, marginBottom: '2rem' }}>
            {step.text}
          </p>
          
          <div style={{ margin: '0 auto', maxWidth: '100%', overflow: 'hidden' }}>
            {step.visual}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: 'auto', padding: '10px 20px', visibility: currentStep === 0 ? 'hidden' : 'visible' }}
            onClick={handlePrev}
          >
            <CaretRight size={18} /> הקודם
          </button>
          
          <button 
            className="btn btn-primary" 
            style={{ width: 'auto', padding: '10px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? (
              <><CheckCircle size={20} /> סיום וכניסה למדריך</>
            ) : (
              <>הבא <CaretLeft size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfessionalsGuide;
