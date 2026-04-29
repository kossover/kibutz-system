import { useState } from 'react';
import { auth, db } from '../firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { House, Lightbulb } from '@phosphor-icons/react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // צור משתמש ב-Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('User created in Auth:', userCredential.user.uid);
        
        // המתן רגע קצר כדי ש-Auth יתעדכן
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // שמור את המשתמש ב-Firestore
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: email,
            name: email.split('@')[0],
            phone: '',
            role: 'user', // משתמש רגיל - תשנה ידנית לאדמין ב-Firestore Console
            isProfessional: false,
            createdAt: serverTimestamp()
          });
          console.log('User saved to Firestore!');
        } catch (firestoreError) {
          console.error('Firestore Error:', firestoreError);
          // המשתמש נוצר ב-Auth אבל לא ב-Firestore
          // זה בסדר - ניתן להוסיף אותו ידנית ב-Console
        }
        
        alert('נרשמת בהצלחה!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error('Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('המייל כבר בשימוש');
      } else if (err.code === 'auth/weak-password') {
        setError('הסיסמה חלשה מדי (לפחות 6 תווים)');
      } else if (err.code === 'auth/invalid-email') {
        setError('כתובת מייל לא תקינה');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('מייל או סיסמה שגויים');
      } else if (err.code === 'permission-denied') {
        setError('שגיאת הרשאות - פנה למנהל המערכת');
      } else {
        setError('אירעה שגיאה: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <House size={48} weight="duotone" color="#667eea" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold' }}>
            ברוכים הבאים
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            מערכת הקיבוץ
          </p>
        </div>

        {/* הודעה על צפייה חופשית */}
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #3B82F6',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '14px',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <Lightbulb size={18} weight="duotone" color="#3B82F6" />
          <div style={{ flex: 1, textAlign: 'right' }}>
            ניתן לצפות באירועים ובמדריך בעלי המקצוע ללא התחברות.{' '}
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                color: '#3B82F6',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit'
              }}
            >
              חזור למסך הבית
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">מייל</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">סיסמה</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '8px',
              marginBottom: '16px',
              textAlign: 'center',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ marginBottom: '12px' }}
          >
            {loading ? 'רגע...' : (isSignUp ? 'הרשם' : 'התחבר')}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            {isSignUp ? 'כבר יש לי חשבון' : 'אין לי חשבון - הרשמה'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;