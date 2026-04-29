
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';
import { House, ArrowRight } from '@phosphor-icons/react'; // RTL arrow

function BackButton({ pageKey }) {
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false); // Default hidden until we confirm
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'config', 'appSettings'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.showBackButton && data.showBackButton[pageKey]) {
                    setVisible(true);
                } else {
                    setVisible(false);
                }
            } else {
                // If doc doesn't exist, we can decide default behavior (e.g. true for all)
                // But let's stick to false or explicit config
                setVisible(false);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [pageKey]);

    if (loading || !visible) return null;

    return (
        <button
            onClick={() => navigate('/')}
            className="btn-back"
            style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px', // LTR layout or absolute? Hebrew is RTL, so left is "end" of reading direction usually, but often back buttons are at top right/left.
                // Let's put it as a floating action button or just a button at the top.
                // The user said "return to home screen from the user's screen".
                // A floating button at bottom-left is unobtrusive and common for "Home".
                zIndex: 2000,
                padding: '12px',
                borderRadius: '50%',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                cursor: 'pointer'
            }}
            title="חזרה למסך הבית"
        >
            <House size={24} weight="fill" />
        </button>
    );
}

export default BackButton;
