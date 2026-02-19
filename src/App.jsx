import { useState } from 'react';
import SearchForm from './components/SearchForm';
import Results from './components/Results';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';

export default function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (url) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/.netlify/functions/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      if (data.error === 'FOUNDATION_NOT_FOUND') {
        setError({ type: 'not_found', message: data.message || 'No foundation found.' });
      } else if (data.error) {
        setError({ type: 'error', message: data.error });
      } else {
        setResults(data);
      }
    } catch (e) {
      setError({ type: 'error', message: e.message || 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl mb-6 shadow-lg shadow-blue-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Foundation Research Intelligence
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Extract foundation details, events, registration tools, and team contacts from any hospital or organization website.
          </p>
        </header>

        <SearchForm onSearch={handleSearch} loading={loading} />
        {loading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {results && <Results data={results} />}

        <footer className="mt-16 text-center text-slate-500 text-sm">
          <p>Data scraped from public sources only.</p>
        </footer>
      </div>
    </div>
  );
}