import Link from 'next/link';
import { SearchX, RefreshCw } from 'lucide-react';
export function Failure({
  href = '/',
  message = 'No pudimos cargar esta página.',
}: {
  href?: string;
  message?: string;
}) {
  return (
    <section className="state" role="alert">
      <RefreshCw size={28} />
      <h1>{message}</h1>
      <p>Revisa tu conexión e inténtalo de nuevo.</p>
      <Link className="button" href={href}>
        Volver a intentar
      </Link>
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
