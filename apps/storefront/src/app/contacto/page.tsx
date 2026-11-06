import { InformationPage, information } from '@/components/information-page';
export const metadata = { title: information('contacto').title };
export default function Page() { return <InformationPage slug="contacto" />; }
