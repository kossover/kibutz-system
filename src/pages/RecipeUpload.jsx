
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CookingPot, UploadSimple, CheckCircle, Warning, Heart, Users, ArrowLeft } from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function RecipeUpload() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [showStartScreen, setShowStartScreen] = useState(true);

    // Hide Bottom Nav
    useEffect(() => {
        const nav = document.querySelector('.bottom-nav-wrapper');
        // Always trying to hide it on mount of this component, 
        // regardless of start screen or form
        if (nav) nav.style.display = 'none';

        return () => {
            // Restore when leaving this page
            if (nav) nav.style.display = '';
        }
    }, []);

    const [formData, setFormData] = useState({
        familyName: '',
        recipeName: '',
        ingredients: '',
        preparation: '',
        image: null
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resizeAndCompressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
            };
        });
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setFormData(prev => ({
                ...prev,
                image: e.target.files[0]
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let imageUrl = null;

            // 1. Convert Image to Base64 if exists
            if (formData.image) {
                imageUrl = await resizeAndCompressImage(formData.image);
            }

            // 2. Save to Firestore
            await addDoc(collection(db, 'recipes'), {
                familyName: formData.familyName,
                recipeName: formData.recipeName,
                ingredients: formData.ingredients,
                preparation: formData.preparation,
                imageUrl: imageUrl, // Storing Base64 string directly
                createdAt: serverTimestamp(),
                likes: 0
            });

            setSuccess(true);
            setFormData({
                familyName: '',
                recipeName: '',
                ingredients: '',
                preparation: '',
                image: null
            });

            // Reset success message after 3 seconds
            // setTimeout(() => {
            //     setSuccess(false);
            //     navigate('/'); // Optional: navigate back home
            // }, 3000);

        } catch (err) {
            console.error("Error uploading recipe: ", err);
            setError("אירעה שגיאה בהעלאת המתכון. אנא נסו שוב.");
        } finally {
            setLoading(false);
        }
    };

    if (showStartScreen) {
        return (
            <div className="page-container" style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                padding: '24px',
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                zIndex: 100
            }}>
                <img
                    src="/tarbutenu.png"
                    alt="תרבותנו"
                    style={{
                        height: '140px',
                        marginBottom: '32px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 10px 15px rgba(234, 88, 12, 0.2))'
                    }}
                />

                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    color: '#9a3412',
                    marginBottom: '16px',
                    lineHeight: 1.2
                }}>
                    יום המשפחה, פברואר 2026
                    <br />
                    <span style={{ fontSize: '24px', fontWeight: '600', color: '#c2410c' }}>ספר המתכונים הקיבוצי</span>
                </h1>

                <p style={{
                    fontSize: '18px',
                    lineHeight: 1.6,
                    color: '#7c2d12',
                    maxWidth: '400px',
                    marginBottom: '40px'
                }}>
                    לכל משפחה יש את המנה האהובה שלה... 🍲 <br />
                    זה יכול להיות כל דבר! לאו דווקא מאכלי חג או עדות. כל מה שאתם אוהבים לאכול ביחד.<br />
                    וכמובן... מומלץ מאוד להביא את המנה לארוחה הקהילתית!
                </p>

                <button
                    onClick={() => setShowStartScreen(false)}
                    style={{
                        background: '#ea580c',
                        color: 'white',
                        border: 'none',
                        padding: '16px 32px',
                        borderRadius: '50px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'transform 0.2s',
                        width: '100%',
                        maxWidth: '300px',
                        justifyContent: 'center'
                    }}
                >
                    אני רוצה להשתתף
                    <ArrowLeft size={24} weight="bold" />
                </button>
            </div>
        );
    }

    return (
        <div className="page-container" style={{ paddingBottom: '40px', maxWidth: '800px', margin: '0 auto' }}>

            {/* Header - Simplified without back button */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                padding: '16px 0'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        color: 'var(--primary-color)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                    }}>
                        <CookingPot size={32} weight="duotone" color="#ea580c" />
                        המתכון שלנו
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>ספרו לנו על המנה המפורסמת שלכם</p>
                </div>
            </div>

            <div className="card" style={{ padding: '32px', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
                {success ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <CheckCircle size={64} color="#10b981" weight="fill" style={{ marginBottom: '16px' }} />
                        <h2 style={{ fontSize: '24px', color: '#10b981', marginBottom: '8px' }}>המתכון נוסף בהצלחה!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>תודה ששיתפתם איתנו את המתכון שלכם ❤️</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                            <button
                                onClick={() => setSuccess(false)}
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: '600'
                                }}
                            >
                                העלאת מתכון נוסף
                            </button>


                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Family Name */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                שם המשפחה
                            </label>
                            <input
                                required
                                type="text"
                                name="familyName"
                                value={formData.familyName}
                                onChange={handleChange}
                                placeholder="למשל: משפחת כהן"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '16px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    background: '#f8fafc'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                            />
                        </div>

                        {/* Recipe Name */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                שם המתכון
                            </label>
                            <input
                                required
                                type="text"
                                name="recipeName"
                                value={formData.recipeName}
                                onChange={handleChange}
                                placeholder="למשל: עוגת הביסקוויטים המפורסמת"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '16px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    background: '#f8fafc'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                            {/* Ingredients */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    רכיבים
                                </label>
                                <textarea
                                    required
                                    name="ingredients"
                                    value={formData.ingredients}
                                    onChange={handleChange}
                                    placeholder="רשימת המצרכים הדרושים..."
                                    rows={6}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        background: '#f8fafc',
                                        resize: 'vertical'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                />
                            </div>

                            {/* Preparation */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    אופן ההכנה
                                </label>
                                <textarea
                                    required
                                    name="preparation"
                                    value={formData.preparation}
                                    onChange={handleChange}
                                    placeholder="שלבי ההכנה..."
                                    rows={6}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '16px',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        background: '#f8fafc',
                                        resize: 'vertical'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                                />
                            </div>
                        </div>

                        {/* Image Upload - Saving as Base64 */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                תמונה (אופציונלי)
                            </label>
                            <div
                                style={{
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                onClick={() => document.getElementById('imageInput').click()}
                            >
                                <input
                                    type="file"
                                    id="imageInput"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{ display: 'none' }}
                                />

                                {formData.image ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--primary-color)' }}>
                                        <CheckCircle size={24} weight="fill" />
                                        <span>{formData.image.name}</span>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        <UploadSimple size={32} style={{ marginBottom: '8px' }} />
                                        <p>לחצו כאן להעלאת תמונה מגרה 📸</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                background: '#fee2e2',
                                color: '#ef4444',
                                padding: '12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px'
                            }}>
                                <Warning size={20} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{
                                marginTop: '16px',
                                width: '100%',
                                padding: '16px',
                                fontSize: '18px',
                                fontWeight: '700',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px'
                            }}
                        >
                            {loading ? 'שולח...' : (
                                <>
                                    <Heart weight="fill" color="#fff" size={24} />
                                    שליחת מתכון
                                </>
                            )}
                        </button>

                    </form>
                )}
            </div>
            {/* <button className="btn btn-secondary" onClick={() => navigate('/recipes/book')}>חזרה</button> */}
            <BackButton pageKey="recipes_upload" />
        </div>
    );
}

export default RecipeUpload;
