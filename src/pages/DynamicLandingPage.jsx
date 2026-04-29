import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { ShareNetwork } from '@phosphor-icons/react';

function DynamicLandingPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadPage = async () => {
            if (!slug) return;
            try {
                const docRef = doc(db, 'landingPages', slug);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPageData(docSnap.data());
                } else {
                    setError('הדף לא נמצא');
                }
            } catch (err) {
                console.error(err);
                setError('שגיאה בטעינת הדף');
            } finally {
                setLoading(false);
            }
        };
        loadPage();
    }, [slug]);

    if (loading) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#fff7ed' }}>
                <div className="loading" style={{ color: '#ea580c' }}>טוען...</div>
            </div>
        );
    }

    if (error || !pageData) {
        return (
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center', background: '#fff7ed' }}>
                <h2 style={{ color: '#c2410c' }}>אופס! הדף לא נמצא.</h2>
                <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '20px', width: 'auto' }}>חזרה לדף הבית</button>
            </div>
        );
    }

    const { title, description, imageUrl, buttons, logoUrl, backgroundColor } = pageData;

    return (
        <div className="page-container" style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            background: backgroundColor || 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            padding: '24px',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            overflowY: 'auto'
        }}>
            <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto' }}>

                {/* Logo - Top Center */}
                {logoUrl && (
                    <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                        <img
                            src={logoUrl}
                            alt="Logo"
                            style={{ maxHeight: '80px', objectFit: 'contain' }}
                        />
                    </div>
                )}

                {/* Title */}
                <h1 style={{
                    fontSize: '36px',
                    fontWeight: '900',
                    color: '#9a3412', // Consider making this dynamic based on background if needed, but keeping compliant for now
                    marginBottom: '16px',
                    lineHeight: 1.2
                }}>
                    {title}
                </h1>

                {/* Description */}
                {description && (
                    <div style={{
                        fontSize: '18px',
                        lineHeight: 1.6,
                        color: '#7c2d12',
                        whiteSpace: 'pre-wrap',
                        marginBottom: '40px'
                    }}>
                        {description}
                    </div>
                )}

                {/* Buttons Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>
                    {(buttons || []).map((btn, index) => {
                        // Base style
                        let btnStyle = {
                            padding: '16px 32px',
                            borderRadius: '50px',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            width: '100%',
                            maxWidth: '320px',
                            textDecoration: 'none',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            border: 'none',
                            background: '#ea580c', // default fallback
                            color: 'white' // default fallback
                        };

                        // Check if it's a hex color (new system)
                        const isHex = (color) => color && color.includes('#');

                        if (isHex(btn.color)) {
                            btnStyle.background = btn.color;
                            btnStyle.color = btn.textColor || '#ffffff'; // Use saved text color or default white
                            btnStyle.boxShadow = `0 4px 12px ${btn.color}66`; // Add transparency to shadow
                        } else {
                            // Fallback for legacy presets
                            if (btn.color === 'secondary') {
                                btnStyle.background = '#e2e8f0';
                                btnStyle.color = '#1e293b';
                            } else if (btn.color === 'outline') {
                                btnStyle.background = 'transparent';
                                btnStyle.color = '#ea580c';
                                btnStyle.border = '2px solid #ea580c';
                                btnStyle.boxShadow = 'none';
                            } else if (btn.color === 'green') {
                                btnStyle.background = '#10b981';
                                btnStyle.color = 'white';
                            } else if (btn.color === 'blue') {
                                btnStyle.background = '#3b82f6';
                                btnStyle.color = 'white';
                            }
                        }

                        // Handle external/internal links
                        const isExternal = btn.url && btn.url.startsWith('http');

                        const handleClick = () => {
                            if (!btn.url) return;
                            if (isExternal) {
                                window.location.href = btn.url;
                            } else {
                                navigate(btn.url);
                            }
                        };

                        return (
                            <button key={index} onClick={handleClick} style={btnStyle}>
                                {btn.label}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Share Button */}
                <div style={{ marginTop: '40px', opacity: 0.8, marginBottom: '32px' }}>
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: title,
                                    text: description,
                                    url: window.location.href
                                });
                            } else {
                                navigator.clipboard.writeText(window.location.href);
                                alert('הקישור הועתק');
                            }
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9a3412',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            margin: '0 auto',
                            fontSize: '14px',
                            fontWeight: '600'
                        }}>
                        <ShareNetwork size={16} weight="bold" />
                        שתף דף
                    </button>
                </div>

                {/* Main Image - Now at the bottom */}
                {imageUrl && (
                    <div style={{ marginBottom: '32px' }}>
                        <img
                            src={imageUrl}
                            alt={title}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                objectFit: 'contain',
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default DynamicLandingPage;
