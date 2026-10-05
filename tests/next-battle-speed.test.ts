import test from 'node:test';import assert from 'node:assert/strict';
import {battleSpeedView} from '../src/next/ui/battleSpeed.ts';
import {controlIcon} from '../src/next/ui/controlIcons.ts';
import {readFileSync} from 'node:fs';
test('actual low-motion override is disclosed without misreporting the preferred speed',()=>{
 assert.equal(battleSpeedView('medium',false,false).label,'中');assert.equal(battleSpeedView('fast',false,false).label,'速');
 assert.equal(battleSpeedView('medium',false,true).note,'動き低減');assert.match(battleSpeedView('medium',false,true).description,/端末/);
 assert.match(battleSpeedView('medium',true,false).description,/光・揺れ/);assert.equal(battleSpeedView('medium',false,false).note,'');
});
test('small icons are decorative; audio OFF includes a non-colour slash',()=>{
 for(const name of ['bell','music','settings','home'] as const){assert.match(controlIcon(name),/aria-hidden="true"/);assert.match(controlIcon(name),/focusable="false"/);}
 assert.match(controlIcon('bell',true),/icon-off-slash/);assert.doesNotMatch(controlIcon('bell'),/icon-off-slash/);
});
test('speed is outside Details, keyboard-native with both choices; named skills remain',()=>{
 const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../src/next/style.css',import.meta.url),'utf8');
 assert(main.indexOf('id="battle-speed"')<main.indexOf('id="details"'));assert.match(main,/<option value="medium" selected>中/);assert.match(main,/<option value="fast">速/);assert.match(main,/settings-icon-button.*aria-label=/);assert.match(main,/ほむらの火種/);
 assert.match(css,/\.battle-speed select\{[^}]*min-height:44px/);assert.match(css,/grid-template-columns:minmax\(0,1fr\)44px 44px/);
});
