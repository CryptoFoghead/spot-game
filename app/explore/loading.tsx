export default function ExploreLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl bg-muted"
            aria-hidden
          />
        ))}
      </div>
      <p className="sr-only">Loading games…</p>
    </div>
  );
}
