'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchX, RefreshCw } from 'lucide-react';
export function Failure({
  href = '/',
  message = 'No pudimos cargar esta página.',
}: {
  href?: string;
  message?: string;
}) {
  const router = useRouter();
  return (
    <section className="state" role="alert">
      <RefreshCw size={28} />
      <h1>{message}</h1>
      <p>Revisa tu conexión e inténtalo de nuevo.</p>
      <button
        className="button"
        onClick={() => {
          if (window.location.pathname === href.split('?')[0]) router.refresh();
          else router.push(href);
        }}
      >
        Volver a intentar
      </button>
    </section>
  );
}
export function Empty({
  title,
  text,
  href = '/buscar',
  action = 'Explorar productos',
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className="state">
      <SearchX size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button" href={href}>
        {action}
      </Link>
    </section>
  );
}
