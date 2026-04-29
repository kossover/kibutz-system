import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

// אתחול יצירת/עדכון מסמך משתמש בכל התחברות
import { initUserProfileBootstrap } from './auth/bootstrapUserProfile';
initUserProfileBootstrap();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
