import { createCharacterBattleConfig } from '../core/index.ts';
import type { BattleConfig, EnemyId } from '../core/index.ts';
import { resolvePlayerPortrait } from './portraits.ts';
import { element } from './dom.ts';

/** 日本語: 検証設定と非同期適用の世代管理は戦闘描画から分離する。
 * English: Lab form configuration and stale-apply protection are independent of battle rendering. */
export class BattleSettings {
  private root: HTMLElement;
  private fixtures: readonly BattleConfig[];
  private generation = 0;
  constructor(root: HTMLElement, fixtures: readonly BattleConfig[]) {
    this.root = root; this.fixtures = fixtures;
    const select = element<HTMLSelectElement>(root, '#fixture-select');
    for (const fixture of fixtures) {
      const option = document.createElement('option');
      option.value = fixture.id;
      option.textContent = fixture.title;
      select.append(option);
    }
    select.addEventListener('change', () => this.describeFixture());
    this.describeFixture();
  }
  beforeOpen(): boolean { this.generation += 1; return true; }
  bindApply(selected: (config: BattleConfig, continuous: boolean) => void | Promise<void>): void {
    element(this.root, '#apply-config').addEventListener('click', async () => {
      const generation = ++this.generation;
      const error = element(this.root, '#config-error');
      try {
        const seedInput = element<HTMLInputElement>(this.root, '#seed-input');
        const seed = Number(seedInput.value);
        if (!seedInput.value.trim() || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('シードは0〜4294967295の整数で入力してください');
        const fixture = this.selectedFixture();
        error.hidden = true;
        const character = resolvePlayerPortrait(element<HTMLSelectElement>(this.root, '#portrait-select').value);
        const enemyId = element<HTMLSelectElement>(this.root, '#enemy-select').value as EnemyId;
        const named = createCharacterBattleConfig(character, enemyId, { ...fixture, seed });
        // 日本語: 検証盤面だけは開始HPの仕込みを保つ。通常プレイは敵定義のHPを使う。
        // English: Test fixtures retain their starting HP setup; normal play uses the enemy profile.
        const configured = fixture.id === 'standard' ? named : { ...named, combatants: { ...named.combatants,
          enemy: { ...named.combatants.enemy, initialHp: Math.min(fixture.combatants.enemy.initialHp, named.combatants.enemy.maxHp) } } };
        await selected(configured, element<HTMLInputElement>(this.root, '#continuous-run').checked);
        // 日本語: 前の適用処理で、開き直した設定画面を閉じない。
        // English: An old apply completion cannot dismiss a newer settings session.
        const dialog = element<HTMLDialogElement>(this.root, '#settings-dialog');
        if (generation === this.generation && dialog.open) dialog.close();
      } catch (problem) {
        if (generation !== this.generation) return;
        error.textContent = problem instanceof Error ? problem.message : String(problem);
        error.hidden = false;
      }
    });
  }
  private selectedFixture(): BattleConfig {
    const id = element<HTMLSelectElement>(this.root, '#fixture-select').value;
    return this.fixtures.find(fixture => fixture.id === id) ?? this.fixtures[0]!;
  }

  private describeFixture(): void { element(this.root, '#fixture-description').textContent = this.selectedFixture().description; }

}
