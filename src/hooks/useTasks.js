// src/hooks/useTasks.js
import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    // ── 1. מחכים ל-Auth להתייצב לפני כל גישה ל-Firestore ──
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // נקה Snapshot קודם אם קיים (למשל במעבר בין משתמשים)
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (!user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // ── 2. Firestore query — רק משימות של המשתמש הנוכחי ──
      const q = query(
        collection(db, 'tasks'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      // ── 3. Real-time listener ──
      const unsubSnap = onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setTasks(fetched);
          setLoading(false);
        },
        (error) => {
          console.error('[useTasks] onSnapshot error:', error);
          setLoading(false);
        }
      );

      unsubscribeSnapshotRef.current = unsubSnap;
    });

    // ── Cleanup מלא ──
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  // ── 4. CRUD Functions ──

  /**
   * הוסף משימה חדשה
   * @param {{ title, description, priority, category, dueDate }} taskData
   */
  const addTask = async (taskData) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        userId: user.uid,
        status: 'todo',
        dueDate: taskData.dueDate ?? null,
        description: taskData.description ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[useTasks] addTask error:', error);
      throw error; // מאפשר ל-UI לתפוס עם Toast
    }
  };

  /**
   * עדכן שדות של משימה קיימת
   * @param {string} taskId
   * @param {Partial<TaskData>} updates
   */
  const updateTask = async (taskId, updates) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[useTasks] updateTask error:', error);
      throw error;
    }
  };

  /**
   * עדכן רק את סטטוס המשימה (פעולה נפוצה — פונקציה ייעודית)
   * @param {string} taskId
   * @param {'todo' | 'in_progress' | 'done'} newStatus
   */
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[useTasks] updateTaskStatus error:', error);
      throw error;
    }
  };

  /**
   * מחק משימה לצמיתות
   * @param {string} taskId
   */
  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      console.error('[useTasks] deleteTask error:', error);
      throw error;
    }
  };

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
  };
}
