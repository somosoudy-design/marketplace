import type { CatalogMetadata, ProductCondition } from '@kora/api';
export type CatalogDraft={condition:ProductCondition|null;media:Record<string,string[]>;touched:string[]};
/** Keep actual edits, while accepting current data for fields the seller never changed. */
export function preserveCatalogDraft(previous:CatalogMetadata,next:CatalogMetadata,draft:CatalogDraft):CatalogDraft{
  const media=Object.fromEntries(next.variants.map(v=>[v.variant_id,v.images.map(i=>i.id)]));
  const touched:string[]=[];
  for(const [id,ids] of Object.entries(draft.media)){
    const before=previous.variants.find(v=>v.variant_id===id);
    const original=before?.images.map(i=>i.id)??[];
    const changed=!before||ids.length!==original.length||ids.some((value,index)=>value!==original[index])||(!before.media_classified&&draft.touched.includes(id));
    if(changed){media[id]=[...ids];if(draft.touched.includes(id))touched.push(id);}
  }
  return{condition:draft.condition!==previous.condition?draft.condition:next.condition,media,touched};
}
