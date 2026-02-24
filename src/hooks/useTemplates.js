// src/hooks/useTemplates.js
import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }
      if (!user) {
        setTemplates([]);
        setLoading(false);
        return;
      }
      // שאילתה עם מיון - זכור ליצור אינדקס אם מופיעה שגיאה בקונסול
      const q = query(
        collection(db, 'templates'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubSnap = onSnapshot(
        q,
        (snapshot) => {
          setTemplates(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (error) => {
          console.error('[useTemplates] onSnapshot error:', error);
          setLoading(false);
        }
      );
      unsubscribeSnapshotRef.current = unsubSnap;
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  const addTemplate = async ({ title, body, categories }) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'templates'), {
        title,
        body,
        categories: categories ?? [], // שמירת הקטגוריות ב-DB
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[useTemplates] addTemplate error:', error);
      throw error;
    }
  };

  const updateTemplate = async (templateId, { title, body, categories }) => {
    try {
      await updateDoc(doc(db, 'templates', templateId), {
        title,
        body,
        categories: categories ?? [], // עדכון הקטגוריות ב-DB
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[useTemplates] updateTemplate error:', error);
      throw error;
    }
  };

  const deleteTemplate = async (templateId) => {
    try {
      await deleteDoc(doc(db, 'templates', templateId));
    } catch (error) {
      console.error('[useTemplates] deleteTemplate error:', error);
      throw error;
    }
  };

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate };
}