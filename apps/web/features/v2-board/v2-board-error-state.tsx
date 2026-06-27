export function V2BoardErrorState({
  boardId,
  error,
}: {
  boardId: string;
  error: Error;
}) {
  return (
    <main className="loadStatePage">
      <section className="loadStatePanel" role="alert">
        <div className="brandMark">Y</div>
        <span className="eyebrow">Board unavailable</span>
        <h1>Could not load this board</h1>
        <p>
          Failed to load v2 board <code>{boardId}</code>.{" "}
          {error.message}
        </p>
        <div className="loadStateActions">
          <a href={`/v2/boards/${boardId}`}>Retry</a>
          <a href="/">Home</a>
        </div>
      </section>
    </main>
  );
}
