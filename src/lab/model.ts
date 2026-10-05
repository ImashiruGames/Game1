/** 日本語: 実験は通常版から分離。装備は自由枠を1つ使い、1案だけ。
 * English: Experiments are isolated from release; exactly one proposal reserves one flexible slot. */
export const proposalIds = ['A061','A062','A001','A004','A025','A026','A028','A030','A031','A035','A039','A041','A043','A049','A051','A057','B001','B009','B010','B011','B019','D001','D017','D024','D030'] as const;
export type ProposalId = typeof proposalIds[number];
export interface ExperimentRuntime { readonly rngState: number; readonly normalActions: number; readonly meditationReadyAt: number }
export interface ExperimentEvent {
  readonly type: 'experiment'; readonly skill: ProposalId; readonly phase: string; readonly eligible: boolean; readonly triggered: boolean;
  readonly detail: string; readonly amount: number; readonly actual?: number; readonly originId?: string;
}
export interface Proposal { readonly id: ProposalId; readonly name: string; readonly description: string; readonly kind: 'passive'|'action'; readonly implemented: boolean }
const data: readonly [ProposalId,string,string,Proposal['kind']][] = [
['A061','縁の下の力持ち','盤面いちばん下の自箱数（最大3）を、各投入の最初のリンクに加算','passive'],
['A062','鉄壁','盤面のどこかに自分の2×2があれば、敵のリンク1打ごとに2軽減','passive'],
['A001','ぴたり三連','ちょうど3リンクの攻撃に＋3','passive'],['A004','一点照準','いちばん長いリンク1本に＋5。同長なら縦→横→斜めの順','passive'],
['A025','最低保証','リンクの攻撃量を最低5にする','passive'],['A026','追い込み','攻撃直前の敵HPが最大の1/4以下ならリンク＋4','passive'],
['A028','対等の刃','自分のHP割合が敵より低い時、リンク＋3','passive'],['A030','フルパワー','HP満タンなら、その投入の最初のリンクに＋5','passive'],
['A031','血の前借り','通常投入でリンクがあればHP2を払い、各リンク＋3。HP2以下でも支払い、倒れる','passive'],
['A035','単線集中','リンクが1本だけの投入は攻撃1.5倍（切捨て）','passive'],['A039','衝撃の天井','敵のリンク1打で失うHPを最大6に制限','passive'],
['A041','割合受け','敵リンクの予定量の1/4（切捨て）を軽減','passive'],['A043','身軽な守り','空き自由枠ごとに敵リンクを1軽減。自分の装備枠を除くため通常は最大1','passive'],
['A049','吸収の刃','実際に減らした敵HPの1/4を回復。1投入で合計3まで','passive'],['A051','相互の手当','自分の回復予定量＋4、その後双方生存なら敵も2回復','passive'],
['A057','会心の抽選','リンクのある投入ごと25%抽選。当たりなら最初のリンク2倍','passive'],
['B001','精密接収','敵箱1個を自分の箱にする。通常行動1回を使う','action'],['B009','精密解体','箱1個を取り除く。通常行動1回を使う','action'],
['B010','塊の解体','選んだ箱から縦横につながる同所有者の塊を取り除く','action'],['B011','切断線','始点→終点の直線区間を消す。地形で止まる。通常行動1回','action'],
['B019','位置交換','箱2個を交換してから自然落下。通常行動1回','action'],['D001','瞑想','通常行動でHP6回復。その後3回の通常手番完了まで再使用不可','action'],
['D017','終幕の灯','通常手番の終了後、双方生存なら敵に2ダメージ','passive'],['D024','棘返し','敵のリンクで実HPを失った時、敵に2ダメージ。敵手番1回まで','passive'],
['D030','治癒の反証','敵の実回復量の半分（切捨て）を直接ダメージで返す','passive'],
];
export const implementedIds: readonly ProposalId[] = ['D030','D024','D017','D001','B019','B011','B010','B009','B001','A057','A051','A049','A043','A041','A039','A035','A031','A030','A028','A026','A025','A004','A001','A061','A062'];
export const proposals: readonly Proposal[] = data.map(([id,name,description,kind])=>({id,name,description,kind,implemented:implementedIds.includes(id)}));
export const proposalOf = (id: ProposalId) => proposals.find(p=>p.id===id)!;
