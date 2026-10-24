/** The app's mark (tools/demo-assets/generate-brand.mjs): a "K" of a stem and two leaves on violet, as on the phone icon. */
export function BrandMark({ size = 36, radius = 12 }: { size?: number; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-hidden="true" style={{ borderRadius: radius, flex: 'none' }}>
      <rect width="1024" height="1024" fill="#6D42E8" />
      <g transform="translate(512 512) scale(0.8) translate(-512 -512)">
        <rect x="330" y="270" width="104" height="484" rx="52" fill="#FFFFFF" />
        <path d="M474 512 Q680 498 724 282 Q524 300 474 512 Z" fill="#FF746B" />
        <path d="M474 512 Q524 724 724 742 Q680 526 474 512 Z" fill="#FFFFFF" />
      </g>
    </svg>
  );
}
