import React, { useState, useRef } from 'react';
import { X } from '@phosphor-icons/react';

export default function TagInput({ label, value = [], onChange, suggestions = [], placeholder = '' }) {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);

    const filteredSuggestions = suggestions.filter(s =>
        s && s.toLowerCase().includes(inputValue.toLowerCase()) &&
        !value.includes(s)
    );

    const handleAdd = (item) => {
        const trimmed = item.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
        }
        setInputValue('');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd(inputValue);
        } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const handleRemove = (itemToRemove) => {
        onChange(value.filter(item => item !== itemToRemove));
    };

    return (
        <div className="form-group mb-0" style={{ position: 'relative' }}>
            <label className="form-label" style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '4px' }}>{label}</label>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                border: '1px solid var(--border-color)', borderRadius: '8px',
                padding: '6px', background: 'white', minHeight: '42px',
                alignItems: 'center'
            }}>
                {value.map(item => (
                    <span key={item} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#f1f5f9', color: '#334155',
                        padding: '4px 8px', borderRadius: '16px', fontSize: '0.85rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        {item}
                        <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#64748b' }}
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={value.length === 0 ? placeholder : ''}
                    style={{ flex: 1, border: 'none', outline: 'none', minWidth: '120px', background: 'transparent', padding: '4px', fontSize: '0.95rem' }}
                />
            </div>
            {showSuggestions && (inputValue || filteredSuggestions.length > 0) && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'white', border: '1px solid #e2e8f0',
                    borderRadius: '8px', marginTop: '4px', zIndex: 10,
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    maxHeight: '150px', overflowY: 'auto'
                }}>
                    {filteredSuggestions.map(suggestion => (
                        <div
                            key={suggestion}
                            onClick={() => handleAdd(suggestion)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}
                            onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            {suggestion}
                        </div>
                    ))}
                    {inputValue && !filteredSuggestions.includes(inputValue) && !value.includes(inputValue) && (
                        <div
                            onClick={() => handleAdd(inputValue)}
                            style={{ padding: '8px 12px', cursor: 'pointer', background: '#f0f9ff', color: '#0369a1', fontSize: '0.9rem' }}
                        >
                            + הוסף "{inputValue}"
                        </div>
                    )}
                </div>
            )}
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>הקש Enter כדי להוסיף</p>
        </div>
    );
}
