import { BadgeCheck } from 'lucide-react';
import './store-badge.css';

export function OfficialStoreSeal({ explain = false }: { explain?: boolean }) {
  const symbol = <BadgeCheck size={22} aria-hidden="true" />;
  if (!explain) return <span className="store-seal" role="img" aria-label="Tienda oficial">{symbol}</span>;
  return (
    <details className="store-seal-details">
      <summary className="store-seal" aria-label="Tienda oficial. Qué significa">{symbol}</summary>
      <div className="store-seal-note">
        <strong>Tienda oficial</strong>
        <p>La opera directamente MAYAMI.</p>
      </div>
    </details>
  );
}
