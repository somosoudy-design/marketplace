import type { Availability, SearchSort } from '@kora/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { type useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ScalePressable } from '@/components/ui/Pressable';
import { Icon } from '@/components/ui/Icon';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, StaleNotice, waitingForNetwork } from '@/components/ui/States';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useCategories, useSearch } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { MAX_CONTENT, ProductCard, useGridColumns } from './ProductGrid';
import { ExhibitionNotice } from './ExhibitionNotice';

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

// React Native Web does not activate radio/checkbox Pressables with Space. Native keeps onPress.
function choiceKeyboard(activate: () => void): object {
  return Platform.OS === 'web' ? { onKeyDown: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
    if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); activate(); }
  } } : {};
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
  /** Restricts the category chips (a store only shows the categories it sells in). */
  categorySlugs?: string[];
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
  searchPlaceholder?: string;
  /** Search keeps its compact tools reachable; store/collection headers retain their own scroll. */
  pinnedControls?: boolean;
}

/**
 * Catalog with search, filters and infinite scroll. The screen stays mounted under pushed product pages,
 * so scroll position, query and filters are intact when the buyer comes back.
 */
export function Catalog({ initial, locked = [], showSearch = true, autoFocusKey, header, topInset = 0, testID, categorySlugs, onScroll, searchPlaceholder = 'Buscar productos', pinnedControls = false }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const grid = useGridColumns();
  const [f, setF] = useState<CatalogFilters>({ ...emptyFilters, ...initial });
  const [sheet, setSheet] = useState<null | 'sort' | 'filters'>(null);
  const [draft, setDraft] = useState<CatalogFilters>(f);
  const input = useRef<TextInput>(null);
  const [searchFocused, setSearchFocused] = useState(false);
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
  const topCategories = (categories.data ?? []).filter((c) => !c.parent_id && (!categorySlugs || categorySlugs.includes(c.slug)));
  const priceLabel = PRICES.find((p) => p.min === f.minPrice && p.max === f.maxPrice)?.label ?? 'Precio';
  const activeCount = f.availability.length + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.sort !== 'relevance' ? 1 : 0)
    + (f.category && !locked.includes('category') && !f.collection ? 1 : 0);
  const canReset = activeCount > 0 || (!!f.query.trim() && !locked.includes('query'));
  // Keep the store/collection and any locked screen context. Reset only filters the buyer can change.
  const resetFilters = (clearQuery = false) => setF((x) => ({
    ...x,
    query: clearQuery && !locked.includes('query') ? '' : x.query,
    category: locked.includes('category') || x.collection ? x.category : null,
    availability: locked.includes('availability') ? x.availability : [],
    sort: locked.includes('sort') ? x.sort : 'relevance',
    minPrice: locked.includes('minPrice') ? x.minPrice : null,
    maxPrice: locked.includes('maxPrice') ? x.maxPrice : null,
  }));

  const secondaryCount = f.availability.length + (f.minPrice != null || f.maxPrice != null ? 1 : 0);
  const sortLabel = SORTS.find((s) => s.value === f.sort)?.label ?? 'Relevancia';
  const selectionLabel = [f.sort !== 'relevance' ? sortLabel : null, f.minPrice != null || f.maxPrice != null ? priceLabel : null, ...AVAIL.filter((a) => f.availability.includes(a.value)).map((a) => a.label)].filter(Boolean).join(' · ');
  const openSheet = (next: 'sort' | 'filters') => {
    Keyboard.dismiss();
    if (next === 'filters') setDraft(f);
    setSheet(next);
  };

  const controls = (
    <View testID="catalog-controls" style={{ backgroundColor: t.colors.background, paddingHorizontal: 16, paddingBottom: 4, gap: 4 }}>
      <ExhibitionNotice />
      {showSearch ? (
        <View style={{ minHeight: 48, borderRadius: 10, backgroundColor: t.colors.surface, borderWidth: 2, borderColor: searchFocused ? t.colors.brand : t.colors.border, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2, gap: 8 }}>
          <Icon name="search" size={20} color={t.colors.textMuted} />
          <TextInput
            ref={input}
            testID="catalog-search"
            value={f.query}
            onChangeText={(q) => setF((x) => ({ ...x, query: q }))}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={searchPlaceholder}
            placeholderTextColor={t.colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar productos, marcas o tiendas"
            style={[t.typography.body, { flex: 1, minWidth: 0, color: t.colors.text, paddingVertical: 11 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          />
          {f.query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => setF((x) => ({ ...x, query: '' }))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={18} color={t.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" color="textSecondary" numberOfLines={1} testID="catalog-count" accessibilityLiveRegion="polite" aria-busy={search.isFetching} style={{ flexShrink: 1 }}>
            {pinnedControls && f.category ? `${topCategories.find((c) => c.slug === f.category)?.name ?? f.category} · ` : ''}{search.isLoading ? 'Buscando…' : items.length === 0 ? 'Sin resultados' : `${items.length}${search.hasNextPage ? '+' : ''} ${items.length === 1 && !search.hasNextPage ? 'producto' : 'productos'}`}
          </Text>
          <View style={{ width: 12, height: 12 }}>{search.isFetching && !search.isLoading ? <ActivityIndicator size={12} color={t.colors.brand} accessibilityLabel="Actualizando resultados" /> : null}</View>
        </View>
        <ScalePressable testID="catalog-filter" accessibilityRole="button" accessibilityLabel={`Filtrar${secondaryCount ? `, ${secondaryCount} activos` : ''}`} accessibilityState={{ expanded: sheet === 'filters' }} onPress={() => openSheet('filters')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 }} scaleTo={0.98}>
          <Icon name="filter" size={18} color={secondaryCount ? t.colors.brand : t.colors.textSecondary} />
          <Text variant="label" color={secondaryCount ? 'brand' : 'text'}>Filtrar{secondaryCount ? ` (${secondaryCount})` : ''}</Text>
        </ScalePressable>
        <View style={{ width: 1, height: 16, backgroundColor: t.colors.border }} />
        <ScalePressable testID="chip-sort" accessibilityRole="button" accessibilityLabel={`Ordenar: ${sortLabel}`} accessibilityState={{ expanded: sheet === 'sort' }} onPress={() => openSheet('sort')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 }} scaleTo={0.98}>
          <Icon name="arrow-up-down" size={18} color={f.sort !== 'relevance' ? t.colors.brand : t.colors.textSecondary} />
          <Text variant="label" color={f.sort !== 'relevance' ? 'brand' : 'text'}>Ordenar</Text>
        </ScalePressable>
      </View>
    </View>
  );

  const listHeader = (
    <View style={{ paddingBottom: 12 }}>
      {header}
      {!pinnedControls ? controls : null}
      {!locked.includes('category') && !f.collection && topCategories.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }} style={{ flexGrow: 0 }}>
          <CategoryTab label="Todo" selected={!f.category} onPress={() => { haptics.select(); setF((x) => ({ ...x, category: null })); }} />
          {topCategories.map((c) => (
            <CategoryTab key={c.id} testID={`chip-category-${c.slug}`} label={c.name} selected={f.category === c.slug} onPress={() => { haptics.select(); setF((x) => ({ ...x, category: x.category === c.slug ? null : c.slug })); }} />
          ))}
        </ScrollView>
      ) : null}
      {activeCount ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }} accessibilityLiveRegion="polite">{selectionLabel || topCategories.find((c) => c.slug === f.category)?.name}</Text>
        <ScalePressable testID="catalog-reset-filters" accessibilityRole="button" accessibilityLabel="Limpiar filtros" onPress={() => resetFilters()} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text variant="label" color="brand">Limpiar</Text>
        </ScalePressable>
      </View> : null}
      {search.isError && search.data ? <View style={{ marginHorizontal: 16 }}><StaleNotice q={search} /></View> : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }} {...(Platform.OS === 'web' ? { role: 'main', 'aria-label': 'Catálogo de productos' } as object : {})}>
      {pinnedControls ? <View style={{ paddingTop: topInset, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>{controls}</View> : null}
      <Animated.FlatList
        testID={testID ?? 'catalog-list'}
        onScroll={onScroll}
        scrollEventThrottle={16}
        key={grid.columns}
        data={items}
        numColumns={grid.columns}
        keyExtractor={(p) => p.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: t.colors.background }}
        contentContainerStyle={{ paddingTop: pinnedControls ? 0 : topInset, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
        columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap, paddingHorizontal: 16 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => <ProductCard product={item} width={grid.cardWidth} priority={index < 4 ? 'high' : 'normal'} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        ListEmptyComponent={
          search.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grid.gap, paddingHorizontal: 16 }}>
              {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}
            </View>
          ) : waitingForNetwork(search) ? (
            <OfflineState />
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => search.refetch()} />
          ) : (
            <EmptyState icon="search" title="No encontramos productos" body={canReset ? 'Prueba con otra palabra o vuelve a ver los productos de esta sección.' : 'Todavía no hay productos para mostrar en esta sección.'} action={canReset ? 'Restablecer búsqueda' : undefined} onAction={() => resetFilters(true)} />
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
        onSelect={(k) => { haptics.select(); setF((x) => ({ ...x, sort: locked.includes('sort') ? x.sort : k as SearchSort })); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <Sheet visible={sheet === 'filters'} title="Filtrar productos" onClose={() => setSheet(null)} testID="catalog-filters" footer={<Button testID="catalog-apply-filters" title="Aplicar filtros" full onPress={() => {
        haptics.select();
        setF((x) => ({ ...x, availability: locked.includes('availability') ? x.availability : draft.availability, minPrice: locked.includes('minPrice') ? x.minPrice : draft.minPrice, maxPrice: locked.includes('maxPrice') ? x.maxPrice : draft.maxPrice }));
        setSheet(null);
      }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="subtitle">Disponibilidad</Text>
          <ScalePressable accessibilityRole="button" accessibilityLabel="Restablecer precio y disponibilidad" onPress={() => setDraft((x) => ({ ...x, availability: [], minPrice: null, maxPrice: null }))} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text variant="label" color="brand">Restablecer</Text>
          </ScalePressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AVAIL.map((a) => {
            const select = () => { if (locked.includes('availability')) return; haptics.select(); setDraft((x) => ({ ...x, availability: x.availability.includes(a.value) ? x.availability.filter((v) => v !== a.value) : [...x.availability, a.value] })); };
            return <ScalePressable key={a.value} testID={`chip-availability-${a.value}`} accessibilityRole="checkbox" aria-checked={draft.availability.includes(a.value)} accessibilityState={{ checked: draft.availability.includes(a.value), disabled: locked.includes('availability') }} disabled={locked.includes('availability')} onPress={select} {...choiceKeyboard(select)} style={{ minHeight: 48, flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: draft.availability.includes(a.value) ? t.colors.brandSoft : t.colors.surfaceSunken }}>
            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: draft.availability.includes(a.value) ? t.colors.brand : t.colors.textMuted, backgroundColor: draft.availability.includes(a.value) ? t.colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{draft.availability.includes(a.value) ? <Icon name="check" size={12} color={t.colors.onBrand} /> : null}</View>
            <Text variant="bodySmall" color={draft.availability.includes(a.value) ? 'brand' : 'text'} style={{ flexShrink: 1 }}>{a.label}</Text>
          </ScalePressable>; })}
        </View>
        <Text variant="subtitle" style={{ marginTop: 20, marginBottom: 8 }}>Precio en USD</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Precio">
          {PRICES.map((p) => {
            const selected = p.min === draft.minPrice && p.max === draft.maxPrice;
            const select = () => { if (locked.includes('minPrice') || locked.includes('maxPrice')) return; haptics.select(); setDraft((x) => ({ ...x, minPrice: p.min, maxPrice: p.max })); };
            return <ScalePressable key={p.label} accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected, disabled: locked.includes('minPrice') || locked.includes('maxPrice') }} disabled={locked.includes('minPrice') || locked.includes('maxPrice')} onPress={select} {...choiceKeyboard(select)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: selected ? t.colors.brandSoft : 'transparent' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: selected ? t.colors.brand : t.colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>{selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.brand }} /> : null}</View>
              <Text variant="bodySmall" color={selected ? 'brand' : 'text'}>{p.label}</Text>
            </ScalePressable>;
          })}
        </View>
      </Sheet>
    </View>
  );
}

function CategoryTab({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return <ScalePressable testID={testID} accessibilityRole="button" aria-pressed={selected} accessibilityState={{ selected }} onPress={onPress} scaleTo={0.98} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: selected ? t.colors.brand : 'transparent' }}>
    <Text variant="bodySmall" color={selected ? 'brand' : 'textSecondary'} style={{ fontFamily: selected ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' }}>{label}</Text>
  </ScalePressable>;
}

/** The shared sheet keeps sorting/price consistent with reviews, profile and confirmations. */
export function OptionsSheet({ visible, title, options, onSelect, onClose }: { visible: boolean; title: string; options: { key: string; label: string; selected?: boolean }[]; onSelect: (key: string) => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} title={title} onClose={onClose} testID="catalog-options" footer={<Button title="Cerrar" variant="secondary" onPress={onClose} full />}>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ gap: 4 }}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            aria-checked={!!o.selected}
            onPress={() => onSelect(o.key)}
            {...choiceKeyboard(() => onSelect(o.key))}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 14, minHeight: 52, borderRadius: t.radii.md, backgroundColor: pressed ? t.colors.surfaceSunken : o.selected ? t.colors.brandSoft : 'transparent' })}
          >
            <Text variant="subtitle" color={o.selected ? 'brand' : 'text'} style={{ flex: 1 }}>{o.label}</Text>
            {o.selected ? <Icon name="check" size={20} color={t.colors.brand} strokeWidth={2.2} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
