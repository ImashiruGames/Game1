import sys,pathlib,subprocess,json
id,condition,effect,detail,test=sys.argv[1:]
p=pathlib.Path('src/lab/mechanics.ts');s=p.read_text();anchor="  else return {amount,events:[]};"
s=s.replace(anchor,f"  else if(id==='{id}'&&state.actor==='player'){{condition={condition};next={effect};detail='{detail}';}}\n"+anchor);p.write_text(s)
p=pathlib.Path('src/lab/model.ts');s=p.read_text();s=s.replace("export const implementedIds: readonly ProposalId[] = [",f"export const implementedIds: readonly ProposalId[] = ['{id}',");p.write_text(s)
with open('tests/lab-modifiers.test.ts','a') as f:f.write(test+'\n')
r=subprocess.run(['node','--experimental-strip-types','--test','tests/lab-modifiers.test.ts','tests/lab.test.ts'],capture_output=True,text=True)
print(r.stdout[-800:]);print(r.stderr);assert r.returncode==0,id+' failed'
with open('public/skill-experiments/implementation-log.jsonl','a') as f:f.write(json.dumps({'skill':id,'status':'implemented_then_tested','suite':'lab-modifiers + lab parity','pass':True})+'\n')
