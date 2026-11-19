export const legalDocuments = {
  privacy: { title: 'Política de privacidad', url: 'https://mayami.app/privacidad' },
  terms: { title: 'Términos y condiciones', url: 'https://mayami.app/terminos' },
  deletion: { title: 'Eliminar cuenta y datos', url: 'https://mayami.app/eliminar-cuenta' },
} as const;
export type LegalDocument = keyof typeof legalDocuments;

/** An accepted URL dispatch is not a claim that the remote document loaded. */
export async function openLegalDocument(document: LegalDocument, open: (url: string) => Promise<unknown>): Promise<string | null> {
  try {
    const result = await open(legalDocuments[document].url);
    if (result === false) throw new Error('URL dispatch refused');
    return null;
  } catch {
    return `No pudimos abrir ${legalDocuments[document].title.toLowerCase()}. Puedes abrir esta dirección en tu navegador: ${legalDocuments[document].url}`;
  }
}
