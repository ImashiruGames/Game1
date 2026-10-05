import { element } from './dom.ts';
import { axisLabel, ownerTheme } from './theme.ts';
import { skillCatalog, skillName } from '../core/skillCatalog.ts';
import type { BattleEvent } from '../core/types.ts';

/** Ordered event text has no responsibility for rules, timing, or battle input. */
export class BattleLog {
  private root: HTMLElement;
  private logCount = 0;
  constructor(root: HTMLElement) { this.root = root; }
  reset(): void { this.logCount = 0; element(this.root, '#battle-log').replaceChildren(); }
  event(event: BattleEvent, turn: number): void {
    const who = 'actor' in event ? ownerTheme[event.actor].label : '';
    const kind = 'actor' in event ? event.actor : 'system';
    switch (event.type) {
      case 'instant-skill': this.add(skillName(event.skillId, event.rank), '通常の1手を消費。使い切った自由枠が空きます', 'player'); break;
      case 'gauge': break;
      case 'transformation': this.add('変化発動', `ゲージ${event.cost}消費・残り${event.after}`, 'player'); break;
      case 'transformation-ended': this.add('変化終了', '追加投入の継続手番が終了', 'player'); break;
      case 'turn-start': this.add(event.skipped ? '追加投入をスキップ' : '赤の変化 · 無料投入', `通常の1手は残ります。追加投入あと${event.remainingStarts}回`, 'player'); break;
      case 'drop': this.add(`T${String(turn).padStart(2, '0')} ${who} · 投入`, `${event.landing.col + 1}列・${event.landing.row + 1}行に着地`, kind); break;
      case 'attack': this.add(`${axisLabel[event.axis]} ${event.linkCount}リンク · ${event.damage} ダメージ`, `${event.skillId ? skillCatalog[event.skillId].name : who + 'の基本攻撃'}${event.overkill > 0 ? ` / オーバーキル +${event.overkill}` : ''}`, kind); break;
      case 'board-skill': this.add(event.skillId === 'pain-shared' ? '痛みはお互いに' : 'ほむらの火種', '通常投入に代わる1手を使用', 'player'); break;
      case 'row-cleared': this.add(`${event.row + 1}行目を消去`, `自箱${event.playerCount} / 敵箱${event.enemyCount} / 中立${event.neutralCount}`, 'player'); break;
      case 'damage': this.add(`${ownerTheme[event.target].label}に${event.damage}ダメージ`, event.source === 'pain-shared' ? '列消去の相互ダメージ（同時）' : event.source === 'blue-transformation' ? '青の変化：回復予定量をダメージに追加' : event.source === 'ember' ? 'ほむらの火種のHP消費' : skillCatalog[event.source].name, 'player'); break;
      case 'boxes-converted': this.add(`敵箱${event.boxIds.length}個を自箱に変換`, '所有者のみ変更。受動リンクは発動しません', 'player'); break;
      case 'heal': this.add(`${event.source === 'health' ? 'ヘルス' : event.source === 'healing-potion' ? '回復ポーション' : '敵の回復'} · HP+${event.amount}`, `HP ${event.hpBefore} → ${event.hpAfter}${event.amount < event.requestedAmount ? '（上限）' : ''}`, event.actor); break;
      case 'link-growth': this.add(`3リンク火力 +${event.amount}（成長+${event.after}）`, 'このステージ中のみ有効', 'player'); break;
      case 'skip': this.add('あなた · 手番スキップ', '投入不可・盤面スキルなし。敵の手番へ', kind); break;
      case 'blocked': this.add('敵 · 通常投入不可', '抽選せず、代替攻撃を実行', kind); break;
      case 'instant-kill': this.add('敵 · 即死相当の攻撃', 'あなたのHPを0にする / 1回のみ', kind); break;
      case 'battle-end': this.add(event.result.winner === 'player' ? '勝利が確定' : '敗北が確定', 'この戦闘の決着。終了した敵の手番は実行しません', kind); break;
    }
  }

  add(title: string, detail: string, kind: string): void {
    const log = element(this.root, '#battle-log');
    const item = document.createElement('li');
    item.className = `log-item ${kind}`;
    const heading = document.createElement('b');
    heading.textContent = title;
    const caption = document.createElement('span');
    caption.textContent = detail;
    item.append(heading, caption);
    log.prepend(item);
    while (log.childElementCount > 60) log.lastElementChild?.remove();
    this.logCount += 1;
    element(this.root, '#log-counter').textContent = `${String(this.logCount).padStart(2, '0')} EVENTS`;
  }
}
