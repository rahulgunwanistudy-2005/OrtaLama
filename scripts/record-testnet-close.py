"""Capture the actual public testnet cohort closing; no mocked data or overlays."""
import argparse,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--round',default='2');args=parser.parse_args()
raw=Path('.runtime/monad_20261024/recording');raw.mkdir(exist_ok=True)
out=Path('docs/media');out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    context=browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(raw),record_video_size={'width':1280,'height':800})
    page=context.new_page();start=time.monotonic();states=[]
    for _ in range(120):
        page.goto('http://127.0.0.1:49300/round/'+args.round,wait_until='networkidle')
        page.locator('.state').wait_for(timeout=60000)
        state=page.locator('.state').inner_text()
        states.append({'seconds':round(time.monotonic()-start,3),'state':state})
        if state=='Closed':
            page.wait_for_timeout(3500)
            page.screenshot(path=str(out/f'SIMULATED_monad_closed_round_{args.round}.png'),full_page=True)
            break
        page.wait_for_timeout(12000)
    else:raise RuntimeError('No actual closed round observed within capture window')
    video=page.video;context.close();video.save_as(str(raw/'SIMULATED_monad_actual_close.webm'));browser.close()
record={'simulation':True,'chainId':10143,'roundId':int(args.round),'states':states,'rawSeconds':round(time.monotonic()-start,3),'url':'http://127.0.0.1:49300/round/'+args.round,'scope':'Real Monad testnet contracts and actual localhost public-evidence UI. Periodic page reloads fetch the running indexer. No physical-phone or public-hosting claim.'}
(out/'SIMULATED_monad_close_recording.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
