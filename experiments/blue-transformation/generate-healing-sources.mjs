// Retired event-union generator: runtime now reads skillCatalog.effectTags directly.
// Kept as a compatibility check; no generated target list is written.
import {skillCatalog,skillHasEffect} from '../../src/next/core/skillCatalog.ts';
console.log(Object.keys(skillCatalog).filter(id=>skillHasEffect(id,'hp-heal')).join(', '));
