/** Inline API error card with optional retry action. */

export default function ApiErrorCard({ message = 'Could not load data', onRetry }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm text-red-600">⚠️ {message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary text-sm py-1.5 px-4 shrink-0 self-start sm:self-auto"
        >
          Retry
        </button>
      )}
    </div>
  )
}
