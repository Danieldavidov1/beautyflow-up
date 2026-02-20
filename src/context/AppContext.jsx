// src/context/AppContext.jsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AppContext = createContext();

// ✅ פונקציית עזר חכמה לשליפה בטוחה מ-localStorage. 
// מונעת קריסת אפליקציה במקרה של נתונים פגומים בזיכרון (JSON לא תקין).
const getSavedData = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error(`Error parsing data for ${key} from localStorage`, error);
    return fallback; // אם יש שגיאה, מחזיר את ערך ברירת המחדל במקום לקרוס
  }
};

// ✅ טעינה ראשונית בטוחה ונקייה יותר
const loadInitialState = () => {
  return {
    incomes: getSavedData('incomes', []),
    expenses: getSavedData('expenses', []),
    budget: getSavedData('budget', { income: 10000, expenses: 8000 }),
    categoryBudgets: getSavedData('categoryBudgets', {}),
    goals: getSavedData('goals', [
      { id: 1, title: 'חיסכון לחופשה', target: 5000, current: 2300, deadline: '2026-06-30', category: 'חיסכון' },
      { id: 2, title: 'הגדלת ההכנסות ב-20%', target: 50000, current: 38000, deadline: '2026-12-31', category: 'הכנסות' },
    ]),
  };
};

const appReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INCOMES':
      return { ...state, incomes: action.payload };
    case 'ADD_INCOME':
      return { ...state, incomes: [action.payload, ...state.incomes] };
    case 'UPDATE_INCOME':
      return {
        ...state,
        incomes: state.incomes.map(i => i.id === action.payload.id ? action.payload : i)
      };
    case 'DELETE_INCOME':
      return { ...state, incomes: state.incomes.filter(i => i.id !== action.payload) };
      
    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload };
    case 'ADD_EXPENSE':
      return { ...state, expenses: [action.payload, ...state.expenses] };
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e)
      };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) };
      
    case 'SET_BUDGET':
      return { ...state, budget: action.payload };
    case 'SET_CATEGORY_BUDGETS':
      return { ...state, categoryBudgets: action.payload };

    case 'SET_GOALS':
      return { ...state, goals: action.payload };
    case 'ADD_GOAL':
      return { ...state, goals: [action.payload, ...state.goals] };
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map(g => g.id === action.payload.id ? action.payload : g)
      };
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter(g => g.id !== action.payload) };

    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  // ✅ אתחול סינכרוני ובטוח של הסטייט
  const [state, dispatch] = useReducer(appReducer, loadInitialState());

  // ✅ שמירה ל-LocalStorage. מאזין לכל שינוי באובייקט state.
  useEffect(() => {
    try {
      localStorage.setItem('incomes', JSON.stringify(state.incomes));
      localStorage.setItem('expenses', JSON.stringify(state.expenses));
      localStorage.setItem('budget', JSON.stringify(state.budget));
      localStorage.setItem('categoryBudgets', JSON.stringify(state.categoryBudgets));
      localStorage.setItem('goals', JSON.stringify(state.goals));
    } catch (error) {
      console.error("Error saving data to localStorage", error);
    }
  }, [state]); // מספיק להאזין ל-state כולו, הרי ה-reducer מייצר אובייקט חדש בכל עדכון!

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};