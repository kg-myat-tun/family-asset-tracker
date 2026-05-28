export default function LoansLoading() {
  return (
    <div className="max-w-4xl space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
