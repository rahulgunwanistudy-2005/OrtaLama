"""Real five-context local browser gate. Never exports participant openings."""
import argparse
import json
from pathlib import Path
import time
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args()
out=Path('.runtime/SIMULATED_browser_gate');out.mkdir(exist_ok=True)
started=time.monotonic()
errors=[]
leaks=[]
def inspect_request(request):
    if request.method!='POST' or not request.post_data or request.url.endswith('/rpc'):
        return
    try:
        body=json.loads(request.post_data)
    except (ValueError,TypeError):
        return
    def walk(value):
        if isinstance(value,dict):
            for key,child in value.items():
                if key in {'E','P','r','s','opening','slopes','shares','secretKey','signingKey'}:
                    leaks.append({'url':request.url.split('?')[0],'field':key})
                walk(child)
        elif isinstance(value,list):
            for child in value:walk(child)
    walk(body)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=args.chrome)
    contexts=[]
    def page(width=1440,height=1000):
        context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
        contexts.append(context)
        value=context.new_page()
        value.set_default_timeout(120000)
        value.on('pageerror',lambda error:errors.append(str(error)))
        value.on('request',inspect_request)
        return value
    presenter=page()
    try:
        presenter.goto(args.url+'/live');presenter.wait_for_load_state('networkidle')
        presenter.get_by_label('Declared sector production').fill('6250')
        presenter.get_by_role('button',name='Open round',exact=True).click()
        presenter.wait_for_url('**/live?round=*',timeout=120000)
        round_id=presenter.url.split('round=')[1]
        expect(presenter.get_by_role('heading',name='Participant links')).to_be_visible(timeout=120000)
        participants=[]
        recovered_broadcast=False;retried_sidecar=False
        for i,E in enumerate([700,800,900,1000,1100]):
            plant=page();participants.append(plant)
            plant.goto(args.url+f'/plant?mode=live&round={round_id}&slot={i}')
            plant.wait_for_load_state('networkidle')
            plant.get_by_label('Secret emissions E',exact=True).fill(str(E))
            plant.get_by_label('Secret production P',exact=True).fill('1000')
            plant.get_by_role('checkbox').check()
            if i==0:
                dropped={'done':False}
                def lose_broadcast_response(route):
                    body=route.request.post_data_json if route.request.method=='POST' else None
                    if isinstance(body,dict) and body.get('method')=='eth_sendRawTransaction' and not dropped['done']:
                        response=route.fetch();assert response.ok
                        dropped['done']=True;route.abort()
                    else:route.continue_()
                plant.route('**/rpc',lose_broadcast_response)
                with plant.expect_event('requestfailed',predicate=lambda request:request.url.endswith('/rpc'),timeout=180000):
                    plant.get_by_role('button',name='Seal and commit privately',exact=True).click()
                assert dropped['done'],'Broadcast was not actually forwarded before the response loss'
                plant.unroute('**/rpc',lose_broadcast_response)
                plant.reload();plant.wait_for_load_state('networkidle')
                recover=plant.get_by_role('button',name='Recover saved commitment',exact=True)
                expect(recover).to_be_enabled(timeout=120000);recover.click()
                recovered_broadcast=True
            elif i==1:
                def lose_sidecar(route):route.abort()
                plant.route('**/api/rounds/*/attestations/*',lose_sidecar)
                plant.get_by_role('button',name='Seal and commit privately',exact=True).click()
                retry=plant.get_by_role('button',name='Retry public co-signature publication',exact=True)
                expect(retry).to_be_enabled(timeout=180000)
                plant.unroute('**/api/rounds/*/attestations/*',lose_sidecar)
                retry.click();expect(retry).to_have_count(0,timeout=120000)
                retried_sidecar=True
            else:plant.get_by_role('button',name='Seal and commit privately',exact=True).click()
            expect(plant.get_by_role('heading',name='Your values are sealed.',exact=True)).to_be_visible(timeout=180000)
            assert not plant.get_by_role('alert').count(),plant.get_by_role('alert').all_text_contents()
            print(f'SIMULATED browser round {round_id}: plant {i+1}/5 committed',flush=True)
        dropped_share={'done':False}
        def lose_share_response(route):
            if not dropped_share['done']:
                response=route.fetch(timeout=180000);assert response.ok
                dropped_share['done']=True;route.abort()
            else:route.continue_()
        participants[2].route('**/trustee-api/1/shares',lose_share_response)
        sharing=presenter.get_by_role('button',name='Open Sharing',exact=True)
        expect(sharing).to_be_enabled(timeout=120000);sharing.click()
        for plant in participants:
            expect(plant.get_by_text('Three real trustee receipts received.',exact=False)).to_be_visible(timeout=240000)
        assert dropped_share['done'],'A real trustee response was not forwarded before intentional loss'
        participants[2].unroute('**/trustee-api/1/shares',lose_share_response)
        close=presenter.get_by_role('button',name='Close and publish average',exact=True)
        expect(close).to_be_enabled(timeout=120000);close.click()
        expect(presenter.get_by_text('0.900000',exact=True)).to_be_visible(timeout=180000)
        presenter.screenshot(path=str(out/'SIMULATED_live_closed.png'),full_page=True)
        verifier=page(390,844)
        verifier.goto(args.url+f'/verify/{round_id}');verifier.wait_for_load_state('networkidle')
        expect(verifier.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
        expect(verifier.get_by_text('0.900000',exact=True)).to_be_visible()
        assert verifier.locator('html').evaluate('(e)=>e.scrollWidth<=innerWidth'),'Mobile horizontal overflow'
        verifier.screenshot(path=str(out/'SIMULATED_mobile_verified.png'),full_page=True)
        clean_badge=participants[0].get_by_role('button',name='Prove at or below the average',exact=True)
        expect(clean_badge).to_be_enabled(timeout=120000);clean_badge.click()
        expect(participants[0].get_by_role('heading',name='Buyer-verifiable attestation')).to_be_visible(timeout=180000)
        badge_link=participants[0].locator('.qr a').get_attribute('href')
        buyer=page(390,844);buyer.goto(args.url+badge_link);buyer.wait_for_load_state('networkidle')
        expect(buyer.get_by_role('heading',name='On-chain attestation record verified',exact=True)).to_be_visible(timeout=120000)
        participants[4].get_by_role('button',name='Prove at or below the average',exact=True).click()
        expect(participants[4].get_by_role('alert')).to_be_visible(timeout=180000)
        assert not participants[4].get_by_role('heading',name='Buyer-verifiable attestation').count()
        assert not leaks,leaks
        assert not errors,errors
        result={'simulation':True,'status':'LOCAL_PASS','roundId':round_id,'badgeId':badge_link.split('/')[-1],'participantBrowserContexts':5,'aggregate':{'E':'4500','P':'5000','intensityPpm':'900000','coveragePpm':'800000'},'independentMobileBrowserVerified':True,'cleanBadgeRecorded':True,'aboveAverageWitnessBlocked':True,'lostBroadcastResponseRecoveredAfterRefresh':recovered_broadcast,'failedPublicSidecarRetried':retried_sidecar,'lostTrusteeReplyRecoveredAutomatically':dropped_share['done'],'privateFieldsOnPublicRequests':leaks,'pageErrors':errors,'elapsedSeconds':round(time.monotonic()-started,2),'ci':'Run remotely by .github/workflows/ci.yml'}
        Path('docs/SIMULATED_BROWSER_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result),flush=True)
    except Exception:
        for i,context in enumerate(contexts):
            for j,current in enumerate(context.pages):
                try:
                    # Screenshots may contain masked private fields; no storage dump.
                    current.screenshot(path=str(out/f'SIMULATED_failure_{i}_{j}.png'),full_page=True)
                    print(f'Browser {i}: '+current.locator('body').inner_text()[-2200:],flush=True)
                except Exception:pass
        raise
    finally:
        browser.close()
