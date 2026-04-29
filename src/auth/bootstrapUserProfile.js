// src/auth/bootstrapUserProfile.js - פתרון סינכרון משתמשים מלא
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export const initUserProfileBootstrap = () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        console.log('🔄 Checking user profile for:', user.uid);

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        const isAdminOverride = user.email === 'guy@mir.co.il';

        if (!userDocSnap.exists()) {
          console.log('✨ UID document not found, searching by email...');
          let existingData = null;
          let oldDocId = null;

          if (user.email) {
            const usersRef = collection(db, 'users');
            // חפש מסמך (כנראה של אדמין) שיש לו את אותו אימייל אבל מזהה אחר
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            // אם מצא שתי רשומות ויותר ניקח את הראשונה
            if (!querySnapshot.empty) {
              const oldDoc = querySnapshot.docs[0];
              existingData = oldDoc.data();
              oldDocId = oldDoc.id;
              console.log('🔍 Found existing admin/excel user document by email, id: ' + oldDocId);
            }
          }

          if (existingData) {
            console.log('🔄 Migrating old user data to official UID document...');
            // מעביר את הנתונים הישנים (תפקידים, מספרי טלפון וכו') למסמך החדש המבוסס על ה-UID של המשתמש
            await setDoc(userDocRef, {
              ...existingData,
              lastLoginAt: serverTimestamp(),
            });

            // מוחק את המסמך הישן (הזהיר שנוצר אוטומטית על ידי firebase ללא קשר ל-auth)
            if (oldDocId) {
              await deleteDoc(doc(db, 'users', oldDocId));
            }
            console.log('✅ User document migrated successfully!');
          } else {
            console.log('✨ Creating brand new user document...');
            await setDoc(userDocRef, {
              email: user.email,
              name: user.displayName || user.email?.split('@')[0] || 'משתמש',
              firstName: '',
              lastName: '',
              phone: user.phoneNumber || '',
              photoURL: user.photoURL || '',
              role: isAdminOverride ? 'admin' : 'user',
              isProfessional: false,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            });
            console.log('✅ User document created successfully!');
          }
        } else {
          console.log('✅ User document exists, updating lastLoginAt...');

          const updateData = {
            lastLoginAt: serverTimestamp(),
          };

          // Force admin role if override is true
          if (isAdminOverride) {
            updateData.role = 'admin';
          }

          await setDoc(userDocRef, updateData, { merge: true });
        }
      } catch (error) {
        console.error('❌ Error in user profile bootstrap:', error);
      }
    }
  });
};