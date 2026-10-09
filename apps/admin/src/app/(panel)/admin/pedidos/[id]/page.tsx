import OrderDetail from './OrderDetail';

// The hosted panel is a static export: one page serves every order and the id comes from the address
// (useRouteId). Running with a Next server, any id still renders on demand.
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <OrderDetail />;
}
