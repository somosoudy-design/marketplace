import Link from 'next/link';
import policies from '@/data/policies.json';

export type InformationSlug = 'terminos' | 'privacidad' | 'devoluciones' | 'contacto';
export function information(slug: InformationSlug) {
  const page = policies.pages.find(page => page.slug === slug);
  if (!page) throw new Error('Information page unavailable');
  return page;
}
export function InformationPage({ slug }: { slug: InformationSlug }) {
  const page = information(slug);
  return (
    <article className="wrap information-page">
      <Link prefetch={false} className="text-link" href="/">Volver a Mayami</Link>
      <header className="information-heading">
        <span className="eyebrow">MAYAMI</span>
        <h1>{page.title}</h1>
        <p>{page.lead}</p>
        <small className="muted">Actualizado el {policies.updatedAt}</small>
      </header>
      {page.sections.map(section => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {'bullets' in section && section.bullets && <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul>}
          {'links' in section && section.links?.map(link => (
            <Link prefetch={false} className="text-link" key={link.href} href={link.href}>{link.href.startsWith('mailto:') ? link.href.slice(7) : link.label}</Link>
          ))}
        </section>
      ))}
    </article>
  );
}
