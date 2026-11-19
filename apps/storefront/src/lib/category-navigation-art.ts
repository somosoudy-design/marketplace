// Navigation-only matte. A different product/image keeps its original presentation.
const technologyPhoto = '5afbabbf-0678-40ee-a5d8-540f53efe114/b1b4a794-c740-47e9-ae57-1c1e3089b80d/da3eea0c-d7cc-4afb-bb73-2ad29bfb3184.jpg';
export function categoryNavigationMask(slug: string, path: string | null): string | undefined {
  return slug === 'tecnologia' && path === technologyPhoto
    ? '/category-art/tecnologia-mask-046d5825ab82a348.png'
    : undefined;
}
