export default function AssetsLoading() {
  return (
    <div className="max-w-4xl space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/5" />
            </div>
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
