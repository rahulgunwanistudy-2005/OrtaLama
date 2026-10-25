"""Click all six console actions and check fresh mined revert receipts."""
import argparse
import json
from pathlib import Path
import time
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser();parser.add_argument('--url',required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args();results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=args.chrome)
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page.goto(args.url+'/attack');page.wait_for_load_state('networkidle')
    for i,error in enumerate(['AggregateMismatch','UnknownVerifier','AlreadyCommitted','CohortTooSmall','InvalidProof','WrongRound']):
        card=page.locator('.attack-item').nth(i)
        with page.expect_response(lambda response:'/operator/attacks/' in response.url and response.request.method=='POST') as response:
            card.get_by_role('button',name='Run attack',exact=True).click()
        job=response.value.json()
        expect(card.get_by_text('Mined revert and exact error checked',exact=True)).to_be_visible(timeout=660000)
        expect(card.get_by_text('Reverted transaction',exact=True)).to_be_visible()
        expect(card.locator('.receipt strong',has_text=error)).to_be_visible()
        final=page.request.get(args.url+f"/operator/attacks/jobs/{job['id']}").json()
        receipt=final['result'];assert receipt['status']=='reverted' and receipt['error']==error
        assert receipt['hash'] not in [r['receipt']['hash'] for r in results]
        results.append({'attack':i+1,'expectedError':error,'receipt':receipt})
        print(f'SIMULATED UI attack {i+1}: {error}, mined {receipt["hash"]}',flush=True)
    Path('.runtime/SIMULATED_browser_gate').mkdir(exist_ok=True)
    page.screenshot(path='.runtime/SIMULATED_browser_gate/SIMULATED_attack_console.png',full_page=True)
    browser.close()
Path('docs/SIMULATED_UI_ATTACK_RESULTS.json').write_text(json.dumps({'simulation':True,'status':'LOCAL_PASS','attacks':results},indent=2)+'\n')
