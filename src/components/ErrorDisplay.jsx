export default function ErrorDisplay({ error }) {
  const isNotFound = error.type === 'not_found';

  const containerClass = 'rounded-2xl p-6 border ' + 
    (isNotFound 
      ? 'bg-amber-500/10 border-amber-500/30' 
      : 'bg-red-500/10 border-red-500/30');

  const iconContainerClass = 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ' +
    (isNotFound ? 'bg-amber-500/20' : 'bg-red-500/20');

  const iconClass = 'w-5 h-5 ' + (isNotFound ? 'text-amber-400' : 'text-red-400');

  const titleClass = 'font-semibold ' + (isNotFound ? 'text-amber-300' : 'text-red-300');

  return (
    <div className="max-w-2xl mx-auto">
      <div className={containerClass}>
        <div className="flex items-start space-x-4">
          <div className={iconContainerClass}>
            {isNotFound ? (
              <svg
                className={iconClass}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            ) : (
              <svg
                className={iconClass}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>
          <div>
            <h3 className={titleClass}>
              {isNotFound ? 'Foundation Not Found' : 'Error Occurred'}
            </h3>
            <p className="text-slate-400 mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
