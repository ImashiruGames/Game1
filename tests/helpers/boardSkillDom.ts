import {kineticDom,KineticNode} from './kineticDom.ts';
/** Realistic grid rectangles for deterministic lifecycle tests, not a browser-layout substitute. */
export function boardSkillDom(width=6,height=8,cellSize=36){
 const dom=kineticDom(),drops=new KineticNode(),feedback=new KineticNode();
 for(const cell of [...dom.board.children])cell.remove();
 const gridWidth=width*(cellSize+2)-2,gridHeight=height*(cellSize+2)-2;
 dom.board.rect={left:dom.area.rect.left+(dom.area.rect.width-gridWidth)/2,top:dom.area.rect.top+40,width:gridWidth,height:gridHeight};
 drops.id='drop-buttons';drops.className='drops';drops.rect={...dom.board.rect,top:dom.area.rect.top+4,height:32};
 feedback.id='feedback-layer';dom.area.append(drops,feedback);
 const cells:KineticNode[]=[];
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const cell=new KineticNode();cell.className='cell';cell.dataset={cellRow:String(row),cellCol:String(col)};
  cell.rect={left:dom.board.rect.left+col*(cellSize+2),top:dom.board.rect.top+row*(cellSize+2),width:cellSize,height:cellSize};
  dom.board.append(cell);cells.push(cell);
 }
 return {...dom,drops,feedback,cells,
  cell(row:number,col:number):KineticNode{return cells.find(cell=>cell.dataset.cellRow===String(row)&&cell.dataset.cellCol===String(col))!;},
  rerender():void{for(const original of [...dom.board.children]){const cell=new KineticNode();cell.className=original.className;cell.dataset={...original.dataset};cell.rect={...original.rect};original.remove();dom.board.append(cell);}},
 };
}
