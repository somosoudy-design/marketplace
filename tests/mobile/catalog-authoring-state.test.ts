import {expect,it}from'vitest';
import type{CatalogMetadata}from'@kora/api';
import{preserveCatalogDraft,type CatalogDraft}from'../../apps/mobile/src/lib/catalog-authoring-state';
const photo=(id:string)=>({id,path:id,alt:null,width:null,height:null,sort:0});
const metadata=(condition:'new'|'refurbished'|null,images:string[]):CatalogMetadata=>({product_id:'p',condition,updated_at:'v',colors:[],variants:images.map((id,i)=>({variant_id:String(i),title:String(i),options:{},price_usd:10,stock:2,active:true,updated_at:'v',color:null,media_classified:true,media_state:'mapped',images:[photo(id)]}))});
it('preserves the edited condition while accepting new photos of an untouched variant',()=>{
 const before=metadata(null,['a','b']),next=metadata('refurbished',['a','external-b']);const draft:CatalogDraft={condition:'new',media:{0:['a'],1:['b']},touched:[]};
 expect(preserveCatalogDraft(before,next,draft)).toEqual({condition:'new',media:{0:['a'],1:['external-b']},touched:[]});
});
it('keeps only genuinely edited orphan selections and accepts a changed untouched condition',()=>{
 const before=metadata(null,['a','b']),next=metadata('refurbished',[]);const draft:CatalogDraft={condition:null,media:{0:['edited-a'],1:['b']},touched:['0']};
 expect(preserveCatalogDraft(before,next,draft)).toEqual({condition:'refurbished',media:{0:['edited-a']},touched:['0']});
});
it('retains an explicit empty classification until saved without changing the input arrays',()=>{
 const before=metadata(null,['a']);before.variants[0]!.images=[];before.variants[0]!.media_classified=false;const next=metadata(null,['external']);const draft:CatalogDraft={condition:null,media:{0:[]},touched:['0']};
 const merged=preserveCatalogDraft(before,next,draft);expect(merged.media).toEqual({0:[]});merged.media['0']!.push('new');expect(draft.media['0']).toEqual([]);
});
