import { useState } from 'react';

export default function SearchForm({ onSearch, loading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim() && !loading) {
      onSearch(url.trim());
    }
  };

  const handleChange = (e) => {
    setUrl(e.target.value);
  };

  const isDisabled = loading || !url.trim();

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-12">
      <div className="relative">
        <input
          type="text"
          value={url}
          onChange={handleChange}
          placeholder="Enter hospital or organization URL (e.g., mayoclinic.org)"
          className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
        >
          {loading ? 'Researching...' : 'Research'}
        </button>
      </div>
      <p className="text-slate-500 text-sm mt-3 text-center">
        Enter any hospital, health system, or nonprofit organization URL
      </p>
    </form>
  );
}
