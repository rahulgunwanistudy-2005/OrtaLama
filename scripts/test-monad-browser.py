"""Actual RPC-backed browser checks. Tampering is isolated to negative cases."""
import argparse,json,time
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:49300')
parser.add_argument('--round',default='2')
args=parser.parse_args()
results=[];errors=[];started=time.monotonic()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for name,width,height in [('desktop',1280,900),('mobile-emulation',390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<500,has_touch=width<500)
        page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        config=page.request.get(args.url+'/operator/config').json()
        assert config['deployment']['chainId']==10143
        def private_fields(value):
            if isinstance(value,dict):
                for key,item in value.items():
                    assert key not in ['signingKey','secretKey','storageKey','controlToken','opening','envelopes']
                    private_fields(item)
            elif isinstance(value,list):
                for item in value:private_fields(item)
        private_fields(config)
        page.goto(args.url+'/verify/'+args.round,wait_until='networkidle')
        expect(page.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
        expect(page.locator('.verification-steps li strong')).to_have_text(['Passed']*5)
        expect(page.locator('.verified-value strong')).to_have_text('0.848636')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=f'docs/media/SIMULATED_monad_verify_{name}.png',full_page=True)
        results.append({'case':name,'actualRPCArithmeticAndSignatures':True,'checks':5,'horizontalOverflow':False})
        context.close()
    context=browser.new_context(viewport={'width':1280,'height':900})
    page=context.new_page()
    def corrupt(route):
        response=route.fetch();body=response.json()
        body['attestations'][0]['pqSignature']='00'*3309
        route.fulfill(response=response,json=body)
    page.route('**/api/rounds/'+args.round+'/evidence',corrupt)
    page.goto(args.url+'/verify/'+args.round,wait_until='networkidle')
    expect(page.locator('.notice.error')).to_contain_text('Verification failed',timeout=180000)
    assert page.get_by_role('heading',name='Verified in this browser',exact=True).count()==0
    results.append({'case':'tampered-public-PQ-sidecar','rejected':True,'scope':'Only this negative browser context intercepted its cache response; positive cases used unmodified services/RPC'})
    context.close();browser.close()
assert not errors,errors
record={'simulation':True,'status':'PASS','chainId':10143,'roundId':args.round,'checkedAt':datetime.now(timezone.utc).isoformat(),'results':results,'pageErrors':errors,'elapsedSeconds':round(time.monotonic()-started,2),'physicalPhoneTest':False,'publicHostingTest':False,'scope':'Real Monad RPC and deployed code hashes; actual current round arithmetic and co-signatures in separate desktop/mobile browser contexts; isolated cache tamper must fail'}
Path('docs/SIMULATED_MONAD_BROWSER_RESULTS.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
