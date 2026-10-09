/** Static capabilities on skill definitions, never on saved skill instances.
 * Tags are composable and independent of names, rank and activation family.
 * HP healing and gauge gain are different capabilities; absent tags imply neither.
 */
export type SkillEffectTag='hp-heal'|'gauge-gain'|'damage';
export interface SkillEffectMetadata {readonly effectTags?:readonly SkillEffectTag[]}
export function definitionHasEffect(definition:SkillEffectMetadata|undefined,tag:SkillEffectTag):boolean{return definition?.effectTags?.includes(tag)??false;}
