import type {Cell,DropOption} from '../core/types.ts';
/** 日本語: UIは辺の向きも受け取るが、現在の下向き重力ルールは変えない。
 * English: The view accepts any edge orientation without inventing new gravity rules. */
export interface EmitterEdge extends Cell {side:'top'|'right'|'bottom'|'left'}
export function edgeEmitterStyle(edge:EmitterEdge):string {
 const x=edge.col+(edge.side==='right'?1:edge.side==='left'?0:.5),y=edge.row+(edge.side==='bottom'?1:edge.side==='top'?0:.5);
 return `left:calc(${x} * (var(--cell) + 2px) - 1px);top:calc(${y} * (var(--cell) + 2px) - 1px);--edge-angle:${({top:0,right:90,bottom:180,left:270})[edge.side]}deg`;
}
export function edgeEmitterLabel(option:DropOption):string{return `${option.edge.row+1}行${option.edge.col+1}列の辺から投入${option.available?'':'・塞がっています'}`;}
export function dropForCell(options:readonly DropOption[],cell:Cell):DropOption|undefined{return options.find(o=>o.available&&o.spawn.col===cell.col&&cell.row>=o.spawn.row&&cell.row<=o.segmentEndRow);}
