import { Redirect, useLocalSearchParams } from 'expo-router';

/** Universal link https://<domain>/tienda/<slug> → store screen. */
export default function StoreLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={{ pathname: '/store/[slug]', params: { slug } }} />;
}
