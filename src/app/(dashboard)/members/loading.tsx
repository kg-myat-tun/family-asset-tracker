export default function MembersLoading() {
  return (
    <div className="max-w-3xl space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
