"""Check the exact owner-hosted export, with real public RPC and no route mocks."""
import argparse, json, time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:49310')
args=parser.parse_args()
record=json.loads(Path('docs/SIMULATED_MONAD_ROUND_RESULTS.json').read_text())
badge=record['badge']['id']; main=record['mainRoundId']
axe=Path('node_modules/axe-core/axe.min.js').read_text()
checks=[]; errors=[]; started=time.monotonic()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for width in [1440,390]:
        context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
        page=context.new_page(); page.set_default_navigation_timeout(180000)
        page.on('pageerror', lambda e:errors.append(str(e)))
        config=page.request.get(args.url+'/operator/config').json()
        assert config['publicEvidence'] and config['deployment']['chainId']==10143
        assert config['rpc']=='https://testnet-rpc.monad.xyz'
        assert page.request.get(args.url+'/api/missing').status==404
        assert page.request.post(args.url+'/operator/seed',data='{}').status==501
        for route in ['/',f'/round/{main}',f'/verify/{main}',f'/badge/{badge}',f'/dossier/{main}','/attack','/calculator','/methodology','/live']:
            print(f'Checking exported route {route} at width {width}',flush=True)
            page.goto(args.url+route,wait_until='networkidle')
            if route.startswith('/verify/'):
                expect(page.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
            elif route.startswith('/badge/'):
                expect(page.get_by_role('heading',name='On-chain attestation record verified',exact=True)).to_be_visible(timeout=120000)
            elif route=='/attack':
                page.get_by_role('button',name='Check all six receipts from Monad',exact=True).click()
                expect(page.get_by_text('All six receipts were independently fetched and show reverted transactions to these deployed contracts.',exact=True)).to_be_visible(timeout=180000)
            elif route.startswith('/dossier/'):
                expect(page.get_by_role('link',name='Download verified dossier JSON',exact=True)).to_be_visible(timeout=20000)
                for suffix in ['json','pdf']:
                    response=page.request.get(args.url+f'/api/rounds/{main}/dossier.{suffix}')
                    assert response.ok
                    if suffix=='pdf': assert response.body().startswith(b'%PDF-')
                    else: assert response.json()['payload']['snapshot']['roundId']==main
            elif route=='/methodology':
                expect(page.locator('#CRYPTO_SPEC')).to_have_count(1)
                expect(page.locator('#APPLICATION_POLICY')).to_have_count(1)
                assert page.request.get(args.url+'/data/physics.json').ok
            if route in [f'/badge/{badge}','/attack',f'/dossier/{main}']:
                page.screenshot(path=f'docs/media/SIMULATED_monad_bundle_{route.split("/")[1]}_{width}.png',full_page=True)
            for language in ['en','tr']:
                if language=='tr':page.get_by_role('button',name='TR — Switch to Turkish',exact=True).click()
                page.add_script_tag(content=axe)
                violations=page.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));}""")
                overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
                checks.append({'route':route,'width':width,'language':language,'violations':violations,'horizontalOverflow':overflow})
                if language=='tr':page.get_by_role('button',name='EN — İngilizceye geç',exact=True).click()
        context.close()
    browser.close()
result={'simulation':True,'chainId':10143,'status':'PASS' if not errors and all(not c['violations'] and not c['horizontalOverflow'] for c in checks) else 'FAIL','checkedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,'pageErrors':errors,'elapsedSeconds':round(time.monotonic()-started,2),'scope':'Exact exported static bundle, actual RPC verification/badge/six reverted receipts, matching JSON/PDF downloads and EN/TR accessibility; no request mocks','physicalPhoneTest':False,'publicHostingTest':False}
Path('docs/SIMULATED_MONAD_BUNDLE_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
assert result['status']=='PASS'
