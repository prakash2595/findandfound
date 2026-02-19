export default function ErrorDisplay({ error }) {
  const isNotFound = error.type === 'not_found';

  if (isNotFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl p-6 border bg-amber-500/10 border-amber-500/30">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/20">
              <span className="text-amber-400 text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="font-semibold text-amber-300">Foundation Not Found</h3>
              <p className="text-slate-400 mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl p-6 border bg-red-500/10 border-red-500/30">
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500/20">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <div>
            <h3 className="font-semibold text-red-300">Error Occurred</h3>
            <p className="text-slate-400 mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
