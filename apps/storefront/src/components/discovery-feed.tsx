'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CatalogMetadata, ProductCard } from '@kora/api';
import { discoveryGroups } from '@/lib/discovery';
import { ProductGrid } from './product-card';
import { ProductBanner, selectBannerProduct } from './product-banner';
type Batch = {windowIds:string[];products:ProductCard[];metadata:Record<string,CatalogMetadata>;next:number;hasMore:boolean};
function prepareSections(batches: Batch[], exclude: string[]) {
  const seen = new Set(exclude);
  const sections = [];
  let previousCategory: string | null | undefined;
  for (const [index, batch] of batches.entries()) {
    const products = batch.products.filter(product => {
      if (seen.has(product.id) || !batch.metadata[product.id]) return false;
      seen.add(product.id);
      return true;
    });
    const banner = index % 2 === 1 ? selectBannerProduct(products, batch.metadata, previousCategory) : undefined;
    if (banner) previousCategory = banner.product.category_slug;
    const groups = discoveryGroups(products.filter(product => product.id !== banner?.product.id));
    sections.push({ batch, banner, groups });
  }
  return sections;
}

export function DiscoveryFeed({initial,seed,exclude=[]}:{initial:Batch;seed:string;exclude?:string[]}) {
  const [batches,setBatches] = useState<Batch[]>([initial]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(false);
  const [announced,setAnnounced] = useState('');
  const busy = useRef(false), sentinel = useRef<HTMLDivElement>(null), alive=useRef(true);
  const last = batches[batches.length-1]!;
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  const load = useCallback(async()=>{
    if(busy.current || !last.hasMore) return;
    busy.current=true;setLoading(true);setError(false);
    try {
      const query=new URLSearchParams({seed,offset:String(last.next)});
      if(last.next%60!==0)query.set('ids',last.windowIds.join(','));
      const response=await fetch(`/api/discovery?${query}`,{cache:'no-store'});
      if(!response.ok) throw new Error('load');
      const data:Batch=await response.json();
      if(!Array.isArray(data.windowIds)||!Array.isArray(data.products)||!data.metadata||data.next!==last.next+12||typeof data.hasMore!=='boolean') throw new Error('response');
      if(alive.current){setBatches(previous=>[...previous,data]);setAnnounced(data.hasMore?'Hay más productos para descubrir.':'Llegaste al final de esta selección.');}
    } catch { if(alive.current)setError(true); }
    finally {busy.current=false;if(alive.current)setLoading(false);}
  },[last,seed]);
  useEffect(()=>{
    if(error || !last.hasMore || !sentinel.current || !('IntersectionObserver' in window)) return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)) void load();},{rootMargin:'300px'});
    observer.observe(sentinel.current);return ()=>observer.disconnect();
  },[load,error,last.hasMore]);
  const sections = prepareSections(batches, exclude);
  return <div className="discovery-feed" role="region" aria-label="Sigue descubriendo productos">
    {sections.map(({ batch, banner, groups }, index) => {
      return <div className="discovery-batch" key={index}>
        {banner&&<div className="discovery-spotlight" data-discovery-id={banner.product.id}><ProductBanner chosen={banner} /></div>}
        {groups.map(group=><section className="catalog-section discovery-group" key={group.slug || 'mixed'}>
          <div className="section-heading"><div><span className="eyebrow">{index===0?'EXPLORA MAYAMI':'SIGUE DESCUBRIENDO'}</span><h2>{group.title}</h2></div>{group.slug&&<Link prefetch={false} href={`/buscar?category=${encodeURIComponent(group.slug)}`}>Ver categoría →</Link>}</div>
          <ProductGrid products={group.products} metadata={batch.metadata} eager={false}/>
        </section>)}
      </div>;
    })}
    <noscript><p><a href="/buscar">Explorar todos los productos</a></p></noscript>
    <div ref={sentinel} className="discovery-more">
      {last.hasMore?<><button className="button" disabled={loading} onClick={()=>void load()}>{loading?'Cargando productos…':error?'Reintentar':'Descubrir más'}</button>{error&&<p role="alert">No pudimos cargar el siguiente grupo. Tus productos siguen aquí.</p>}</>:<p>Has visto esta selección. <Link prefetch={false} href="/buscar">Explora todo el catálogo</Link> o vuelve al inicio para descubrir otro orden.</p>}
    </div><span className="sr-only" role="status" aria-live="polite">{announced}</span>
  </div>;
}
