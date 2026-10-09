import { View } from 'react-native';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Banner } from './States';
import { Text } from './Text';

/**
 * Confirmation for actions that can't be undone (cancel an order, delete an address, request account
 * deletion). Same sheet on iOS, Android and web, so no platform skips the question.
 */
export function ConfirmSheet({
  visible, title, body, confirm, cancel = 'Volver', danger = true, loading, error, onConfirm, onClose, testID,
}: {
  visible: boolean; title: string; body?: string; confirm: string; cancel?: string; danger?: boolean; loading?: boolean;
  error?: string | null; onConfirm: () => void; onClose: () => void; testID?: string;
}) {
  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      testID={testID}
      footer={
        <>
          <Button testID={testID ? `${testID}-confirm` : undefined} title={confirm} variant={danger ? 'danger' : 'primary'} full loading={loading} onPress={onConfirm} />
          <Button title={cancel} variant="ghost" full onPress={onClose} />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        {body ? <Text color="textSecondary">{body}</Text> : null}
        {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
      </View>
    </Sheet>
  );
}
