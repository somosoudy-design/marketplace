import type { ExhibitionPhoto } from './catalog-exhibition-policy';

// Only photographs with verified product correspondence AND redistribution permission belong here.
// Official references without confirmed rights must stay in .local/, outside Metro's import graph.
// Currently empty: no authentic photograph has been obtained/cleared. Do not substitute illustrations.
export const exhibitionPhotos: readonly ExhibitionPhoto[] = [];
