// Compatibility export derived from the canonical catalog; no separate healing list.
import {skillCatalog,skillHasEffect} from '../../src/next/core/skillCatalog.ts';
import type {NormalSkillId} from '../../src/next/core/types.ts';
export const healingEventSources=Object.keys(skillCatalog).filter(id=>skillHasEffect(id as NormalSkillId,'hp-heal')) as NormalSkillId[];
