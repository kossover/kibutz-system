
import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Trash, CookingPot, User, CalendarBlank, Check, X, Pencil, HourglassHigh } from '@phosphor-icons/react';

function ManageRecipes() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [editForm, setEditForm] = useState({
        familyName: '',
        recipeName: '',
        ingredients: '',
        preparation: ''
    });

    useEffect(() => {
        loadRecipes();
    }, []);

    const loadRecipes = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'recipes'));
            const recipesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            recipesData.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setRecipes(recipesData);
        } catch (error) {
            console.error("Error loading recipes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (recipeId) => {
        if (window.confirm('האם אתם בטוחים שברצונכם למחוק מתכון זה?')) {
            try {
                await deleteDoc(doc(db, 'recipes', recipeId));
                setRecipes(prev => prev.filter(r => r.id !== recipeId));
            } catch (error) {
                console.error("Error deleting recipe:", error);
                alert('שגיאה במחיקת המתכון');
            }
        }
    };

    const handleApprove = async (recipe) => {
        try {
            await updateDoc(doc(db, 'recipes', recipe.id), {
                isApproved: true
            });
            setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, isApproved: true } : r));
        } catch (error) {
            console.error("Error approving recipe:", error);
            alert('שגיאה באישור המתכון');
        }
    };

    const handleToggleApproval = async (recipe) => {
        const newStatus = !recipe.isApproved;
        try {
            await updateDoc(doc(db, 'recipes', recipe.id), {
                isApproved: newStatus
            });
            setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, isApproved: newStatus } : r));
        } catch (error) {
            console.error("Error modifying approval:", error);
            alert('שגיאה בשינוי סטטוס');
        }
    };

    const startEditing = (recipe) => {
        setEditingRecipe(recipe.id);
        setEditForm({
            familyName: recipe.familyName,
            recipeName: recipe.recipeName,
            ingredients: recipe.ingredients,
            preparation: recipe.preparation
        });
    };

    const saveEdit = async () => {
        try {
            await updateDoc(doc(db, 'recipes', editingRecipe), {
                familyName: editForm.familyName,
                recipeName: editForm.recipeName,
                ingredients: editForm.ingredients,
                preparation: editForm.preparation
            });

            setRecipes(prev => prev.map(r => r.id === editingRecipe ? {
                ...r,
                familyName: editForm.familyName,
                recipeName: editForm.recipeName,
                ingredients: editForm.ingredients,
                preparation: editForm.preparation
            } : r));

            setEditingRecipe(null);
        } catch (error) {
            console.error("Error updating recipe:", error);
            alert('שגיאה בעדכון המתכון');
        }
    };

    if (loading) return <div className="loading">טוען מתכונים...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CookingPot size={28} weight="duotone" color="#ea580c" />
                    ניהול ספר מתכונים
                    <span className="text-muted text-sm" style={{ fontWeight: 'normal' }}>({recipes.length})</span>
                </h2>
            </div>

            {recipes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    עדיין אין מתכונים במערכת.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                    {recipes.map(recipe => (
                        <div key={recipe.id} className="card" style={{
                            padding: '0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            border: recipe.isApproved ? '1px solid #22c55e' : '1px solid #f59e0b',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                padding: '4px 12px',
                                background: recipe.isApproved ? '#22c55e' : '#f59e0b',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                borderBottomRightRadius: '8px',
                                zIndex: 10
                            }}>
                                {recipe.isApproved ? 'מאושר' : 'ממתין לאישור'}
                            </div>

                            {editingRecipe === recipe.id ? (
                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>עריכת מתכון</h3>

                                    <input
                                        className="form-input"
                                        value={editForm.familyName}
                                        onChange={e => setEditForm(prev => ({ ...prev, familyName: e.target.value }))}
                                        placeholder="שם משפחה"
                                    />
                                    <input
                                        className="form-input"
                                        value={editForm.recipeName}
                                        onChange={e => setEditForm(prev => ({ ...prev, recipeName: e.target.value }))}
                                        placeholder="שם המתכון"
                                    />
                                    <textarea
                                        className="form-input"
                                        value={editForm.ingredients}
                                        onChange={e => setEditForm(prev => ({ ...prev, ingredients: e.target.value }))}
                                        placeholder="רכיבים"
                                        rows={3}
                                    />
                                    <textarea
                                        className="form-input"
                                        value={editForm.preparation}
                                        onChange={e => setEditForm(prev => ({ ...prev, preparation: e.target.value }))}
                                        placeholder="אופן ההכנה"
                                        rows={3}
                                    />

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <button onClick={saveEdit} className="btn btn-success" style={{ flex: 1 }}>
                                            <Check size={16} /> שמור
                                        </button>
                                        <button onClick={() => setEditingRecipe(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                                            <X size={16} /> ביטול
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{
                                        height: '140px',
                                        background: '#f1f5f9',
                                        backgroundImage: recipe.imageUrl ? `url(${recipe.imageUrl})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        {!recipe.imageUrl && <CookingPot size={40} color="#cbd5e1" weight="duotone" />}

                                        <div style={{
                                            position: 'absolute',
                                            bottom: '8px',
                                            right: '8px',
                                            background: 'rgba(255,255,255,0.9)',
                                            padding: '4px 8px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <User size={12} weight="bold" />
                                            {recipe.familyName}
                                        </div>
                                    </div>

                                    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>{recipe.recipeName}</h3>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                            <CalendarBlank size={14} />
                                            {recipe.createdAt?.toDate ? recipe.createdAt.toDate().toLocaleDateString('he-IL') : 'תאריך לא ידוע'}
                                        </div>

                                        <p style={{
                                            fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {recipe.ingredients}
                                        </p>

                                        <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                className={`btn ${recipe.isApproved ? 'btn-secondary' : 'btn-success'}`}
                                                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                                                onClick={() => handleToggleApproval(recipe)}
                                            >
                                                {recipe.isApproved ? (
                                                    <><X size={16} style={{ marginLeft: '4px' }} /> בטל אישור</>
                                                ) : (
                                                    <><Check size={16} style={{ marginLeft: '4px' }} /> אשר</>
                                                )}
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                                                onClick={() => startEditing(recipe)}
                                            >
                                                <Pencil size={16} style={{ marginLeft: '4px' }} />
                                                ערוך
                                            </button>

                                            <button
                                                className="btn btn-danger"
                                                style={{ width: 'auto', padding: '8px', fontSize: '13px' }}
                                                onClick={() => handleDelete(recipe.id)}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ManageRecipes;
