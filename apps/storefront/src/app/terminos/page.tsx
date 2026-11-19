import { InformationPage, information } from '@/components/information-page';
export const metadata = { title: information('terminos').title };
export default function Page() { return <InformationPage slug="terminos" />; }
