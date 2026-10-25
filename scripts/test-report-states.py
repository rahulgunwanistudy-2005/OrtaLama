"""Read-only browser checks of real saved report editor states."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
expect.set_options(timeout=120000)
parser=argparse.ArgumentParser();parser.add_argument('--runtime',required=True);parser.add_argument('--url',required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args();jobs=[json.loads(p.read_text()) for p in (Path(args.runtime)/'plant-jobs').glob('SIMULATED_job_*_secret.json')]
cases={'sealed-closed-round':next(j for j in jobs if j.get('commit')),
       'blocked-source-editor':next(j for j in jobs if j['analysis']['blocked'] and not j.get('sealed'))}
axe=Path('node_modules/axe-core/axe.min.js').read_text();checks=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=args.chrome)
 for width in [1440,390]:
  for name,job in cases.items():
   context=browser.new_context(viewport={'width':width,'height':900});page=context.new_page()
   page.on('pageerror',lambda e:errors.append(str(e)))
   config=page.request.get(args.url+'/operator/config').json()
   key='SIMULATED_REPORT_JOB_'+config['deployment']['instanceId']
   page.add_init_script('sessionStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps({'id':job['id'],'token':job['token']}))+')')
   page.goto(args.url+'/plant',wait_until='networkidle',timeout=120000)
   expect(page.get_by_role('heading',name='Cited source values',exact=True)).to_be_visible()
   if name=='sealed-closed-round':
    expect(page.get_by_label('Open round',exact=True)).to_have_value(job['review']['core']['roundId'])
   else:page.get_by_text('Review source lines and correct extraction',exact=True).click()
   for language in ['en','tr']:
    if language=='tr':page.get_by_role('button',name='TR — Switch to Turkish',exact=True).click()
    page.add_script_tag(content=axe)
    violations=page.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));}""")
    checks.append({'case':name,'width':width,'language':language,'violations':violations,'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
   context.close()
 browser.close()
result={'simulation':True,'status':'PASS' if not errors and all(not c['violations'] and not c['horizontalOverflow'] for c in checks) else 'FAIL','checks':checks,'pageErrors':errors,'closedRoundSelectionPreserved':True,'scope':'Actual saved jobs from real model/browser workflow; authenticated job restoration, blocked correction controls and sealed report state; no new signature or transaction'}
Path('docs/SIMULATED_REPORT_STATE_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
assert result['status']=='PASS'
