import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import './home-campaigns.css';

const features = [
  { slug: 'audio', label: 'Audio', title: 'Dale voz a tus ideas.', photo: 'am8' },
  { slug: 'belleza', label: 'Belleza', title: 'Un detalle muy tuyo.', photo: 'mandarin' },
] as const;

export function HomeCampaigns({ categories, tabletHref }: { categories: ReadonlyArray<{ slug: string }>; tabletHref?: string }) {
  return (
    <section className="campaigns" aria-label="Descubre mayami">
      <div className={tabletHref ? "campaign-lead campaign-tablet-feature" : "campaign-lead"}>
        <div className="campaign-copy">
          <span className="campaign-label">{tabletHref ? 'Tablet destacada' : 'Descubre mayami'}</span>
          <h1>{tabletHref ? 'Tu tablet con kit completo' : <>Tus favoritos,<br />a un toque.</>}</h1>
          <p>{tabletHref ? 'Pantalla de 10,1″ y 128 GB. Incluye teclado, mouse, lápiz y funda.' : 'Tecnología, belleza y mucho más, en un solo lugar.'}</p>
          <Link href={tabletHref ?? '/buscar'} prefetch={false} className="campaign-button">
            {tabletHref ? 'Ver tablet' : 'Explorar productos'} <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
        <div className="campaign-studio" aria-hidden="true">
          <span className="campaign-plinth" />
          {tabletHref
            ? <img className="campaign-tablet" src="/campaigns/tablet.webp" width="800" height="600" alt="" fetchPriority="high" />
            : <img className="campaign-fragrance" src="/campaigns/mandarin.webp" width="335" height="470" alt="" fetchPriority="high" />}
        </div>
      </div>
      {features.filter(({ slug }) => categories.some(c => c.slug === slug)).map(({ slug, label, title, photo }) => (
        <Link key={slug} className={`campaign-feature campaign-${slug}`} href={`/buscar?category=${slug}`} prefetch={false}>
          <div className="campaign-copy">
            <span className="campaign-label">{label}</span>
            <h2>{title}</h2>
            <span className="campaign-more">Explorar {slug} <ArrowRight size={17} aria-hidden="true" /></span>
          </div>
          <span className="campaign-still" aria-hidden="true">
            <span className="campaign-shelf" />
            <img src={`/campaigns/${photo}.webp`} alt="" width={photo === 'am8' ? 217 : 335} height="470" />
          </span>
        </Link>
      ))}
    </section>
  );
}
