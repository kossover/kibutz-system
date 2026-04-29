
import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CookingPot, User, ArrowRight, Clock } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

function RecipesList() {
    const navigate = useNavigate();
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const recipesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRecipes(recipesData);
            } catch (error) {
                console.error("Error fetching recipes:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecipes();
    }, []);

    return (
        <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '32px',
                padding: '16px 0'
            }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'white',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '50%',
                        marginLeft: '16px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    <ArrowRight size={20} />
                </button>
                <div>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        color: 'var(--primary-color)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <CookingPot size={32} weight="duotone" color="#ea580c" />
                        מאגר המתכונים
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>כל המתכונים שהועלו למערכת ({recipes.length})</p>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    טוען מתכונים...
                </div>
            ) : recipes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                    <CookingPot size={48} color="var(--text-light)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>עדיין אין מתכונים</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-light)' }}>המתכונים שהמשפחות יעלו יופיעו כאן</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '24px'
                }}>
                    {recipes.map(recipe => (
                        <div key={recipe.id} className="card" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            overflow: 'hidden',
                            padding: 0,
                            border: '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            borderRadius: '16px'
                        }}>
                            {/* Image Section */}
                            <div style={{
                                height: '200px',
                                background: '#f1f5f9',
                                backgroundImage: recipe.imageUrl ? `url(${recipe.imageUrl})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                {!recipe.imageUrl && (
                                    <CookingPot size={48} color="#cbd5e1" weight="duotone" />
                                )}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                    padding: '16px',
                                    color: 'white'
                                }}>
                                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                        {recipe.recipeName}
                                    </h3>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '16px',
                                    color: 'var(--text-secondary)',
                                    fontSize: '14px',
                                    background: '#f8fafc',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    width: 'fit-content'
                                }}>
                                    <User size={16} weight="bold" color="var(--primary-color)" />
                                    <span style={{ fontWeight: 600 }}>{recipe.familyName}</span>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px' }}>רכיבים:</h4>
                                    <p style={{
                                        fontSize: '14px',
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'pre-wrap',
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical'
                                    }}>
                                        {recipe.ingredients}
                                    </p>
                                </div>

                                <div style={{ marginTop: 'auto' }}>
                                    <details style={{
                                        cursor: 'pointer',
                                        background: '#fff7ed',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        border: '1px solid #ffedd5'
                                    }}>
                                        <summary style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: '#c2410c',
                                            outline: 'none'
                                        }}>
                                            הצג אופן ההכנה
                                        </summary>
                                        <p style={{
                                            marginTop: '12px',
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            lineHeight: '1.6',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {recipe.preparation}
                                        </p>
                                    </details>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RecipesList;
