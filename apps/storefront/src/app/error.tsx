'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="state" role="alert">
      <h1>No pudimos abrir esta página</h1>
      <p>Inténtalo de nuevo. Tu cuenta y tu carrito se conservan.</p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}
