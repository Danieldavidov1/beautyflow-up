import { Search, X, Calendar, DollarSign } from 'lucide-react';

export default function FilterBar({ 
  filters, 
  setFilters, 
  categories = [],
  onClear 
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* שורת חיפוש */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🔍 חיפוש
          </label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              placeholder="חפש לפי שם מקור..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
            />
          </div>
        </div>

        {/* סינון קטגוריה */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📂 קטגוריה
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          >
            <option value="">הכל</option>
            {categories.map((cat, index) => (
              <option key={index} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* מיון */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🔄 מיין לפי
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          >
            <option value="date-desc">תאריך (חדש → ישן)</option>
            <option value="date-asc">תאריך (ישן → חדש)</option>
            <option value="amount-desc">סכום (גבוה → נמוך)</option>
            <option value="amount-asc">סכום (נמוך → גבוה)</option>
          </select>
        </div>

        {/* תאריך מ- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📅 מתאריך
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          />
        </div>

        {/* תאריך עד */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📅 עד תאריך
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          />
        </div>

        {/* סכום מ- */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💰 מסכום
          </label>
          <input
            type="number"
            value={filters.amountFrom}
            onChange={(e) => setFilters({...filters, amountFrom: e.target.value})}
            placeholder="0"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          />
        </div>

        {/* סכום עד */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💰 עד סכום
          </label>
          <input
            type="number"
            value={filters.amountTo}
            onChange={(e) => setFilters({...filters, amountTo: e.target.value})}
            placeholder="∞"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e5007e] focus:border-transparent"
          />
        </div>
      </div>

      {/* כפתור ניקוי */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          <X className="w-4 h-4" />
          נקה סינונים
        </button>
      </div>

      {/* תוצאות */}
      <div className="mt-3 text-sm text-gray-600 text-center">
        {(filters.search || filters.category || filters.dateFrom || filters.dateTo || filters.amountFrom || filters.amountTo) && (
          <span>🔍 מציג תוצאות מסוננות</span>
        )}
      </div>
    </div>
  );
}
