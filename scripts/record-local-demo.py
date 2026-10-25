"""Record actual local UI events. No mocked network or replacement result text."""
import argparse
import json
from pathlib import Path
import time
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
parser.add_argument('--round',required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args()
output=Path('docs/media');output.mkdir(exist_ok=True)
raw=Path('.runtime/SIMULATED_recording');raw.mkdir(exist_ok=True)
times={}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=args.chrome)
    for stage in ['close','attack']:
        context=browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(raw),record_video_size={'width':1280,'height':800})
        page=context.new_page();started=time.monotonic()
        if stage=='close':
            page.goto(args.url+'/live?round='+args.round);page.wait_for_load_state('networkidle')
            expect(page.get_by_text('0.900000',exact=True)).to_be_visible(timeout=1200000)
        else:
            page.goto(args.url+'/attack');page.wait_for_load_state('networkidle')
            card=page.locator('.attack-item').nth(1)
            card.scroll_into_view_if_needed()
            times['attackClickSeconds']=round(time.monotonic()-started,3)
            card.get_by_role('button',name='Run attack',exact=True).click()
            expect(card.get_by_text('Mined revert and exact error checked',exact=True)).to_be_visible(timeout=360000)
            expect(card.locator('.receipt strong',has_text='UnknownVerifier')).to_be_visible()
        page.wait_for_timeout(2200)
        times[stage+'Seconds']=round(time.monotonic()-started,3)
        page.screenshot(path=str(output/f'SIMULATED_{stage}.png'),full_page=True)
        video=page.video
        context.close()
        video.save_as(str(raw/f'SIMULATED_{stage}.webm'))
        print('SIMULATED actual recording complete: '+stage,flush=True)
    browser.close()
times.update(simulation=True,roundId=args.round,chain='Local Anvil 31337',note='Actual UI and mined transactions; no public deployment or physical phone. Long idle wait removed for the GIF; attack sequence may be time-compressed.')
(output/'SIMULATED_recording.json').write_text(json.dumps(times,indent=2)+'\n')
