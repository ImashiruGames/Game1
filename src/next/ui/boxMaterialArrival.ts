import type {Box} from '../core/types.ts';
/** 日本語: DOMの再描画だけで全盤面を再発光させない。新しい箱・タイプ変更だけを検出。
 * English: Presentation-only identities prevent selection/forecast rerenders from replaying all material arrivals. */
export function createBoxMaterialArrival(){let previous=new Map<string,Box['type']>();return {reset(){previous.clear();},observe(boxes:readonly Box[]):ReadonlySet<string>{const added=new Set(boxes.filter(b=>b.type!=='normal'&&previous.get(b.id)!==b.type).map(b=>b.id));previous=new Map(boxes.map(b=>[b.id,b.type]));return added;}};}
