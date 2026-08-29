export default function PlayLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-hidden>
        {Array.from({ length: 25 }, (_, index) => (
          <div
            key={index}
            className="aspect-square animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
      <p className="sr-only">Loading your card…</p>
    </div>
  );
}
