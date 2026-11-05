import { brand } from '@/lib/brand';

/** Neutral product name until the original Work logo is available; not a newly designed mark. */
export function BrandMark() {
  return <span className="block text-[24px] leading-[1.25] font-extrabold tracking-[-0.6px] text-brand">{brand.name}</span>;
}
