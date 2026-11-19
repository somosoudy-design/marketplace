import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Card, Divider, ListRow } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { legalDocuments, openLegalDocument, type LegalDocument } from '@/lib/legal-links';

export function LegalLinks({ compact = false }: { compact?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const documents: LegalDocument[] = compact ? ['terms', 'privacy'] : ['privacy', 'terms', 'deletion'];
  const open = async (document: LegalDocument) => setError(await openLegalDocument(document, url => Linking.openURL(url)));
  const failure = error ? <View style={{ padding: compact ? 0 : 16 }}><Text testID="legal-link-error" variant="bodySmall" color="danger" accessibilityRole="alert" selectable>{error}</Text></View> : null;
  if (compact) return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
      {documents.map(document => <ScalePressable key={document} testID={`legal-${document}`} accessibilityRole="link" accessibilityLabel={legalDocuments[document].title} onPress={() => void open(document)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text variant="caption" color="brand" style={{ textDecorationLine: 'underline' }}>{legalDocuments[document].title}</Text>
      </ScalePressable>)}
    </View>
    {failure}
  </View>;
  return <Card padded={false} testID="legal-documents">
    {documents.map((document, index) => <View key={document}>
      {index > 0 ? <Divider inset={68} /> : null}
      <ListRow testID={`legal-${document}`} icon={document === 'privacy' ? 'shield-check' : document === 'terms' ? 'file-text' : 'trash'} title={legalDocuments[document].title} onPress={() => void open(document)} />
    </View>)}
    {failure}
  </Card>;
}
