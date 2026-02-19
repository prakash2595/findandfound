export default function LoadingSpinner() {
  const steps = [
    'Connecting to website...',
    'Identifying foundation...',
    'Extracting events...',
    'Finding registration tools...',
    'Locating team contacts...'
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center space-x-3 text-slate-400">
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              ></div>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-sm text-center mt-6">
          This may take 15-30 seconds...
        </p>
      </div>
    </div>
  );
}