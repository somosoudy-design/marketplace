import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
export function SellerChoice({ label, value, items, disabled, onChange, testID }: { label: string; value: string; items: { value: string; label: string }[]; disabled: boolean; onChange: (value: string) => void; testID: string }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState('');
  return <View style={{ gap: 8 }}><Text variant="label">{label}</Text><Button testID={testID} title={items.find((i) => i.value === value)?.label ?? 'Elegir'} icon="chevron-down" variant="secondary" full disabled={disabled} onPress={() => { setSearch(''); setOpen(true); }} />
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}><View style={{ gap: 12 }}>
      {items.length > 12 ? <TextField label={`Buscar ${label.toLowerCase()}`} value={search} onChangeText={setSearch} /> : null}
      {items.filter((i) => i.label.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map((i) => <Button testID={`${testID}-${i.value}`} key={i.value} title={i.label} accessibilityLabel={`${i.label}${value === i.value ? ', seleccionado' : ''}`} variant={value === i.value ? 'primary' : 'secondary'} full onPress={() => { onChange(i.value); setOpen(false); }} />)}
    </View></Sheet>
  </View>;
}
