import { InformationPage, information } from '@/components/information-page';
export const metadata = { title: information('privacidad').title };
export default function Page() { return <InformationPage slug="privacidad" />; }
