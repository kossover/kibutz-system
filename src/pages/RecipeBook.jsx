
import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { CookingPot, Users, Heart, MagnifyingGlass, BookOpen, ShareNetwork, Printer, ForkKnife, X, WhatsappLogo } from '@phosphor-icons/react';
import BackButton from '../components/BackButton';

function RecipeBook() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                // Fetch only approved recipes
                const q = query(
                    collection(db, 'recipes'),
                    where('isApproved', '==', true),
                    orderBy('createdAt', 'desc')
                );

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

    const filteredRecipes = recipes.filter(recipe => {
        const searchLower = searchTerm.toLowerCase();
        return (
            recipe.recipeName?.toLowerCase().includes(searchLower) ||
            recipe.familyName?.toLowerCase().includes(searchLower) ||
            recipe.ingredients?.toLowerCase().includes(searchLower)
        );
    });

    const handleShareWhatsapp = (recipe) => {
        const title = `*${recipe.recipeName}*`;
        const family = `מאת משפחת: ${recipe.familyName}`;
        const ingredientsTitle = `*רכיבים:*`;
        const prepTitle = `*אופן ההכנה:*`;

        // Construct the message
        let message = `${title}\n${family}\n\n${ingredientsTitle}\n${recipe.ingredients}\n\n${prepTitle}\n${recipe.preparation}`;

        // Add image link if exists, or just a footer
        if (recipe.imageUrl) {
            message += `\n\n*תמונה:* ${recipe.imageUrl}`;
        }

        message += `\n\nנשלח מאפליקציית הקיבוץ 🌾`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#fff7ed',
                color: '#ea580c',
                fontSize: '24px',
                fontWeight: 'bold',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <CookingPot size={64} weight="duotone" className="spin-slow" />
                <div>פותחים את ספר המתכונים...</div>
                <style>{`
                    @keyframes spin { 
                        from { transform: rotate(0deg); } 
                        to { transform: rotate(360deg); } 
                    }
                    .spin-slow { animation: spin 3s linear infinite; }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#fff7ed', fontFamily: 'Rubik, sans-serif' }}>
            {/* Hero Header */}
            <header style={{
                background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
                padding: '60px 20px 40px',
                textAlign: 'center',
                color: 'white',
                boxShadow: '0 4px 20px rgba(194, 65, 12, 0.3)',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{
                        display: 'inline-flex',
                        padding: '12px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        marginBottom: '16px',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <BookOpen size={48} weight="duotone" color="#fff" />
                    </div>
                    <h1 style={{
                        fontSize: '3rem',
                        fontWeight: '800',
                        margin: '0 0 8px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        ספר המתכונים הקיבוצי
                    </h1>
                    <p style={{
                        fontSize: '1.25rem',
                        opacity: 0.9,
                        maxWidth: '600px',
                        margin: '0 auto',
                        fontWeight: '300'
                    }}>
                        טעמים, זכרונות וסיפורים של הקהילה שלנו
                    </p>
                </div>

                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -50, left: -50, width: 200, height: 200, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: -50, right: -50, width: 300, height: 300, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
            </header>

            {/* Search Bar */}
            <div style={{
                maxWidth: '800px',
                margin: '-24px auto 40px',
                padding: '0 20px',
                position: 'relative',
                zIndex: 20
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '100px',
                    padding: '8px 24px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: '1px solid #fed7aa'
                }}>
                    <MagnifyingGlass size={24} color="#9ca3af" />
                    <input
                        type="text"
                        placeholder="חפשו מתכון, משפחה או רכיב..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            fontSize: '16px',
                            color: '#4b5563',
                            background: 'transparent',
                            height: '40px'
                        }}
                    />
                </div>
            </div>

            {/* Recipe Grid */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '0 20px 80px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '32px'
            }}>
                {filteredRecipes.length > 0 ? (
                    filteredRecipes.map(recipe => (
                        <div key={recipe.id} style={{
                            background: 'white',
                            borderRadius: '24px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                            transition: 'transform 0.3s, box-shadow 0.3s',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            border: '1px solid #ffedd5'
                        }}
                            onClick={() => setSelectedRecipe(recipe)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px)';
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
                            }}
                        >
                            {/* Image Area */}
                            <div style={{
                                height: '220px',
                                background: '#f1f5f9',
                                backgroundImage: recipe.imageUrl ? `url(${recipe.imageUrl})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                position: 'relative'
                            }}>
                                {!recipe.imageUrl && (
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#fff7ed'
                                    }}>
                                        <CookingPot size={64} color="#fdba74" weight="duotone" />
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '16px',
                                    right: '16px',
                                    background: 'rgba(255,255,255,0.95)',
                                    padding: '6px 16px',
                                    borderRadius: '100px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#ea580c',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Users size={16} weight="duotone" />
                                    {recipe.familyName}
                                </div>
                            </div>

                            {/* Content Area */}
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <h3 style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    color: '#1f2937',
                                    marginBottom: '16px',
                                    lineHeight: 1.2
                                }}>
                                    {recipe.recipeName}
                                </h3>

                                <div style={{
                                    marginBottom: '20px',
                                    background: '#fff7ed',
                                    padding: '16px',
                                    borderRadius: '16px'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px',
                                        color: '#ea580c',
                                        fontWeight: '600',
                                        fontSize: '0.9rem'
                                    }}>
                                        <ForkKnife size={20} />
                                        רכיבים:
                                    </div>
                                    <p style={{
                                        fontSize: '0.95rem',
                                        color: '#4b5563',
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-line',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {recipe.ingredients}
                                    </p>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px',
                                        color: '#ea580c',
                                        fontWeight: '600',
                                        fontSize: '0.9rem'
                                    }}>
                                        <CookingPot size={20} />
                                        אופן ההכנה:
                                    </div>
                                    <p style={{
                                        fontSize: '0.95rem',
                                        color: '#4b5563',
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-line',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {recipe.preparation}
                                    </p>
                                </div>

                                <div style={{ marginTop: '16px', textAlign: 'center', color: '#ea580c', fontWeight: 'bold', fontSize: '14px' }}>
                                    לחץ להצגת המתכון המלא
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#9ca3af'
                    }}>
                        <CookingPot size={64} weight="duotone" style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>לא נמצאו מתכונים</h3>
                        <p>נסו לחפש משהו אחר...</p>
                    </div>
                )}
            </div>

            <footer style={{
                textAlign: 'center',
                padding: '32px',
                color: '#9a3412',
                fontSize: '0.9rem',
                opacity: 0.8
            }}>
                &copy; כל הזכויות שמורות לחברי הקיבוץ
            </footer>

            <BackButton pageKey="recipe_book" />

            {/* Recipe Modal */}
            {selectedRecipe && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    zIndex: 2100,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }} onClick={() => setSelectedRecipe(null)}>
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        maxWidth: '800px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        position: 'relative',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'fadeIn 0.3s ease-out'
                    }} onClick={(e) => e.stopPropagation()}>

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedRecipe(null)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                                zIndex: 10
                            }}
                        >
                            <X size={24} color="#64748b" />
                        </button>

                        <div style={{
                            height: '300px',
                            background: '#f1f5f9',
                            backgroundImage: selectedRecipe.imageUrl ? `url(${selectedRecipe.imageUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            position: 'relative'
                        }}>
                            {!selectedRecipe.imageUrl && (
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#fff7ed'
                                }}>
                                    <CookingPot size={80} color="#fdba74" weight="duotone" />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                                <div>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: '#ffedd5',
                                        color: '#ea580c',
                                        padding: '4px 12px',
                                        borderRadius: '100px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        marginBottom: '12px'
                                    }}>
                                        <Users size={16} weight="bold" />
                                        מטבח: {selectedRecipe.familyName}
                                    </div>
                                    <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                                        {selectedRecipe.recipeName}
                                    </h2>
                                </div>

                                <button
                                    onClick={() => handleShareWhatsapp(selectedRecipe)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: '#25D366',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                    }}
                                >
                                    <WhatsappLogo size={24} weight="fill" />
                                    שתף בוואטסאפ
                                </button>
                            </div>

                            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <ForkKnife size={24} color="#ea580c" />
                                        רכיבים
                                    </h3>
                                    <div style={{
                                        background: '#f8fafc',
                                        padding: '24px',
                                        borderRadius: '16px',
                                        whiteSpace: 'pre-line',
                                        lineHeight: 1.8,
                                        color: '#475569',
                                        fontSize: '1.1rem'
                                    }}>
                                        {selectedRecipe.ingredients}
                                    </div>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <CookingPot size={24} color="#ea580c" />
                                        אופן ההכנה
                                    </h3>
                                    <div style={{
                                        whiteSpace: 'pre-line',
                                        lineHeight: 1.8,
                                        color: '#334155',
                                        fontSize: '1.1rem'
                                    }}>
                                        {selectedRecipe.preparation}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div >
    );
}

export default RecipeBook;
