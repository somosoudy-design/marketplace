export default function Loading() {
  return (
    <div className="wrap loading" role="status" aria-label="Cargando productos">
      <div className="skeleton loading-title" />
      <div className="product-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton loading-card" key={i} />
        ))}
      </div>
      <span className="sr-only">Cargando productos…</span>
    </div>
  );
}
