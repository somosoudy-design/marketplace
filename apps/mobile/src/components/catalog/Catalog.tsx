import type { Availability, SearchSort } from '@kora/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useCategories, useSearch } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { MAX_CONTENT, ProductCard, useGridColumns } from './ProductGrid';

export interface CatalogFilters {
  query: string;
  category: string | null;
  store: string | null;
  collection: string | null;
  availability: Availability[];
  sort: SearchSort;
  minPrice: number | null;
  maxPrice: number | null;
}

export const emptyFilters: CatalogFilters = { query: '', category: null, store: null, collection: null, availability: [], sort: 'relevance', minPrice: null, maxPrice: null };

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'popular', label: 'Más populares' },
  { value: 'newest', label: 'Novedades' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'price_desc', label: 'Mayor precio' },
];
const AVAIL: { value: Availability; label: string }[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'on_order', label: 'Por encargo' },
  { value: 'in_transit', label: 'En camino' },
  { value: 'reservable', label: 'Reservable' },
];
const PRICES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Cualquier precio', min: null, max: null },
  { label: 'Hasta 15 USD', min: null, max: 15 },
  { label: '15 a 50 USD', min: 15, max: 50 },
  { label: '50 a 100 USD', min: 50, max: 100 },
  { label: 'Más de 100 USD', min: 100, max: null },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

interface Props {
  initial?: Partial<CatalogFilters>;
  /** Locks filters that define the screen (e.g. a store page); they are not shown as removable chips. */
  locked?: (keyof CatalogFilters)[];
  showSearch?: boolean;
  autoFocusKey?: string;
  header?: React.ReactElement | null;
  topInset?: number;
  testID?: string;
}

/**
 * Catalog with search, filters and infinite scroll. The screen stays mounted under pushed product pages,
 * so scroll position, query and filters are intact when the buyer comes back.
 */
export function Catalog({ initial, locked = [], showSearch = true, autoFocusKey, header, topInset = 0, testID }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const grid = useGridColumns();
  const [f, setF] = useState<CatalogFilters>({ ...emptyFilters, ...initial });
  const [sheet, setSheet] = useState<null | 'sort' | 'price'>(null);
  const input = useRef<TextInput>(null);
  const categories = useCategories();
  const query = useDebounced(f.query, 280);

  useEffect(() => {
    if (autoFocusKey) setTimeout(() => input.current?.focus(), 250);
  }, [autoFocusKey]);

  const params = useMemo(
    () => ({ query: query.trim() || null, category: f.category, store: f.store, collection: f.collection, availability: f.availability, sort: f.sort, minPrice: f.minPrice, maxPrice: f.maxPrice }),
    [query, f.category, f.store, f.collection, f.availability, f.sort, f.minPrice, f.maxPrice],
  );
  const search = useSearch(params);
  const items = useMemo(() => search.data?.pages.flat() ?? [], [search.data]);
  const topCategories = (categories.data ?? []).filter((c) => !c.parent_id);
  const priceLabel = PRICES.find((p) => p.min === f.minPrice && p.max === f.maxPrice)?.label ?? 'Precio';
  const activeCount = f.availability.length + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.sort !== 'relevance' ? 1 : 0);

  const toggleAvailability = (a: Availability) =>
    setF((x) => ({ ...x, availability: x.availability.includes(a) ? x.availability.filter((v) => v !== a) : [...x.availability, a] }));

  const listHeader = (
    <View style={{ gap: 12, paddingBottom: 14 }}>
      {header}
      {showSearch ? (
        <View style={{ marginHorizontal: 16, height: 50, borderRadius: t.radii.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
          <Icon name="search" size={20} color={t.colors.textMuted} />
          <TextInput
            ref={input}
            testID="catalog-search"
            value={f.query}
            onChangeText={(q) => setF((x) => ({ ...x, query: q }))}
            placeholder="Buscar productos, marcas o tiendas"
            placeholderTextColor={t.colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar"
            style={[t.typography.body, { flex: 1, color: t.colors.text, height: '100%' }]}
          />
          {f.query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => setF((x) => ({ ...x, query: '' }))}>
              <Icon name="x" size={18} color={t.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!locked.includes('category') && !f.collection ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <Chip label="Todo" selected={!f.category} onPress={() => setF((x) => ({ ...x, category: null }))} />
          {topCategories.map((c) => (
            <Chip key={c.id} testID={`chip-category-${c.slug}`} label={c.name} selected={f.category === c.slug} onPress={() => setF((x) => ({ ...x, category: x.category === c.slug ? null : c.slug }))} />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip icon="arrow-up-down" label={SORTS.find((s) => s.value === f.sort)?.label ?? 'Ordenar'} selected={f.sort !== 'relevance'} onPress={() => setSheet('sort')} testID="chip-sort" />
        <Chip icon="banknote" label={priceLabel === 'Cualquier precio' ? 'Precio' : priceLabel} selected={f.minPrice != null || f.maxPrice != null} onPress={() => setSheet('price')} />
        {AVAIL.map((a) => (
          <Chip key={a.value} testID={`chip-availability-${a.value}`} label={a.label} selected={f.availability.includes(a.value)} onPress={() => toggleAvailability(a.value)} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <Text variant="caption" color="textMuted" testID="catalog-count">
          {search.isLoading ? 'Buscando…' : items.length === 0 ? 'Sin resultados' : `${items.length}${search.hasNextPage ? '+' : ''} productos`}
        </Text>
        {activeCount ? (
          <Pressable accessibilityRole="button" onPress={() => setF((x) => ({ ...x, availability: [], sort: 'relevance', minPrice: null, maxPrice: null }))} hitSlop={8}>
            <Text variant="label" color="brand">Limpiar filtros</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        testID={testID ?? 'catalog-list'}
        key={grid.columns}
        data={items}
        numColumns={grid.columns}
        keyExtractor={(p) => p.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: t.colors.background }}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
        columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap, paddingHorizontal: 16 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => <ProductCard product={item} width={grid.cardWidth} priority={index < 4 ? 'high' : 'normal'} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        ListEmptyComponent={
          search.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grid.gap, paddingHorizontal: 16 }}>
              {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}
            </View>
          ) : search.isError ? (
            <ErrorState onRetry={() => search.refetch()} />
          ) : (
            <EmptyState icon="search" title="No encontramos productos" body="Prueba con otra palabra o quita algún filtro." />
          )
        }
        ListFooterComponent={search.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: 24 }} color={t.colors.brand} /> : null}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
      />
      <OptionsSheet
        visible={sheet === 'sort'}
        title="Ordenar por"
        options={SORTS.map((s) => ({ key: s.value, label: s.label, selected: f.sort === s.value }))}
        onSelect={(k) => { setF((x) => ({ ...x, sort: k as SearchSort })); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionsSheet
        visible={sheet === 'price'}
        title="Precio"
        options={PRICES.map((p) => ({ key: p.label, label: p.label, selected: p.min === f.minPrice && p.max === f.maxPrice }))}
        onSelect={(k) => { const p = PRICES.find((x) => x.label === k)!; setF((x) => ({ ...x, minPrice: p.min, maxPrice: p.max })); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

/** Native page sheet on iOS, bottom sheet elsewhere. */
export function OptionsSheet({ visible, title, options, onSelect, onClose }: { visible: boolean; title: string; options: { key: string; label: string; selected?: boolean }[]; onSelect: (key: string) => void; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: t.colors.overlay }} />
      <View style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: t.radii.xl, borderTopRightRadius: t.radii.xl, paddingBottom: insets.bottom + 16, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.borderStrong, marginBottom: 12 }} />
        <Text variant="title" style={{ paddingHorizontal: 20, marginBottom: 8 }}>{title}</Text>
        <ScrollView style={{ maxHeight: 440 }}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            aria-checked={!!o.selected}
            onPress={() => onSelect(o.key)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 52, backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent' })}
          >
            <Text variant="subtitle" style={{ flex: 1 }}>{o.label}</Text>
            {o.selected ? <Icon name="check" size={20} color={t.colors.brand} strokeWidth={2.2} /> : null}
          </Pressable>
        ))}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Button title="Cerrar" variant="secondary" onPress={onClose} full />
        </View>
      </View>
    </Modal>
  );
}
