"""WCAG checks and direct-chain verification on the built local app."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
parser.add_argument('--round',default='1')
parser.add_argument('--badge')
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args()
axe=Path('node_modules/axe-core/axe.min.js').read_text()
output=Path('.runtime/SIMULATED_browser_audit');output.mkdir(exist_ok=True)
results=[];errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=args.chrome)
    for width in [1440,390]:
        context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        routes=['/','/live','/plant','/verifier','/trustee/1','/trustee/2','/trustee/3','/attack','/calculator','/methodology',f'/round/{args.round}',f'/dossier/{args.round}',f'/verify/{args.round}']
        if args.badge:routes.append(f'/badge/{args.badge}')
        for route in routes:
            page.goto(args.url+route);page.wait_for_load_state('networkidle')
            if route.startswith('/verify/'):
                expect(page.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
                page.screenshot(path=str(output/f'SIMULATED_verify_{width}.png'),full_page=True)
            for language in ['en','tr']:
                if language=='tr':page.get_by_role('button',name='TR — Switch to Turkish',exact=True).click()
                page.add_script_tag(content=axe)
                report=page.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));}""")
                overflow=page.locator('html').evaluate('(e)=>e.scrollWidth>innerWidth')
                results.append({'route':route,'width':width,'language':language,'violations':report,'horizontalOverflow':overflow})
                print(json.dumps(results[-1]),flush=True)
                if language=='tr':page.get_by_role('button',name='EN — İngilizceye geç',exact=True).click()
        context.close()
    browser.close()
result={'simulation':True,'status':'LOCAL_PASS' if not errors and all(not r['violations'] and not r['horizontalOverflow'] for r in results) else 'FAIL','pageErrors':errors,'checks':results}
Path('docs/SIMULATED_ACCESSIBILITY_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['status']=='LOCAL_PASS', 'Accessibility or browser errors; see the gate evidence'
