import ProductEditor from './ProductEditor';

// The hosted panel is a static export: "nuevo" gets its own page and one page serves every other product, whose
// id comes from the address (useRouteId). Running with a Next server, any id still renders on demand.
export function generateStaticParams() {
  return [{ id: 'nuevo' }, { id: '_' }];
}

export default function Page() {
  return <ProductEditor />;
}
