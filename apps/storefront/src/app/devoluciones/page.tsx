import { InformationPage, information } from '@/components/information-page';
export const metadata = { title: information('devoluciones').title };
export default function Page() { return <InformationPage slug="devoluciones" />; }
