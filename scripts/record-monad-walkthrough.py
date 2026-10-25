"""Record actual public-export UI. No request interception or fabricated results."""
import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

base='http://127.0.0.1:49310'
out=Path('.runtime/monad_20261024/walkthrough');out.mkdir(parents=True,exist_ok=True)
badge=json.loads(Path('docs/SIMULATED_MONAD_ROUND_RESULTS.json').read_text())['badge']['id']
plan=[
 ('problem',25,'/','Actual Monad contracts / localhost website / SIMULATED inputs',
  'Ortalama keeps plant inputs private and makes a weighted emissions average checkable. The EU default for Turkish grey clinker is one point five five one, including the twenty twenty six mark-up. The industry reports zero point eight eight from member declarations. Their boundaries need reconciliation. This demonstration uses actual Monad testnet contracts, with synthetic inputs and identities.'),
 ('mechanism',25,'/methodology','Signed commitments / encrypted threshold shares / exact frozen cohort',
  'Plants seal emissions and production in hiding commitments and prove bounded openings. They split the openings into encrypted shares for three trustees. Closing reconstructs only the group aggregate and checks every contribution in the frozen manifest. A ledger proves this arithmetic. It cannot establish physical report truth, accreditation, complete sector coverage or regulatory acceptance.'),
 ('agent',40,'/methodology#ai','Recorded AI evaluation / synthetic PDFs / results and repairs disclosed',
  'Before sealing, the local report agent proposes fields and citations from Turkish reports. Deterministic code reads source tokens, checks units and tests cement physics. A named review controls acceptance, and a physics override requires written justification. The actual evaluation used twenty synthetic PDFs. It got one hundred eighty nine of two hundred numeric fields right, but only seventy nine original citations. All eight planted impossible reports were blocked without an override. Repairs are disclosed separately. These results do not establish accuracy on real reports, and scripted test approvals are not human review.'),
 ('close',20,None,'Earlier actual Monad close / recorded locally / no replacement result',
  'This is the earlier recording of the actual testnet round closing. Five plants contributed, with three separately keyed trustee processes on one host. The published intensity is zero point eight four eight six three six kilograms of carbon dioxide per kilogram of product.'),
 ('verify',40,'/verify/2','Actual browser RPC reads / arithmetic + ECDSA + ML-DSA checks',
  'This browser independently fetches the selected chain, checks deployed code hashes and pins a block. It recomputes the ordered manifest, commitment sums, trustee share sums, interpolation and aggregate openings. It also checks every allowlisted ECDSA and M L D S A co-signature. A tampered signature cache was rejected in the negative browser test. The result is the average of this participating cohort. Coverage against the synthetic declared denominator is only twenty six point six seven percent. The representative policy flag is false.'),
 ('attacks',25,'/attack','Earlier mined attacks / live receipt recheck / no new transaction',
  'All six required attacks actually mined as reverted. This button now fetches those receipts again from Monad. Omitting a member failed the aggregate check; a separate successful transaction recorded the trustee fault. A non-allowlisted verifier, duplicate installation, undersized cohort, invalid badge proof and previous-round replay were also rejected. Receipt status alone does not prove its error reason.'),
 ('badge',25,'/badge/'+badge,'Actual issued badge / registry + receipt + deployment checked',
  'A qualifying plant issued a real, non-transferable attestation. It proves an at or below relation to the participating cohort average, without publishing the plant intensity. This page checks the deployed registry and successful attestation event directly. The above-average witness failed its inequality constraint. Each issued threshold badge still reveals one comparison bit.'),
 ('dossier',30,'/dossier/2','Matching public JSON/PDF / hosting + physical phone remain owner steps',
  'The public evidence exports as matching JSON and PDF, anchored to a pinned block and checksum. Independent reproduction checked twenty nine successful transaction records for round two. Private reports, openings, individual shares and signing keys are excluded. Two colluding trustees can reconstruct plants; repeated cohorts can leak differences. This is engineering evidence with same-host simulated custody. The owner will publish the prepared site and test a physical phone. No official acceptance, institutional partnership or emissions reduction is claimed.'),
]
records=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 for name,seconds,route,caption,narration in plan:
  record={'name':name,'seconds':seconds,'caption':caption,'narration':narration,'route':route}
  if route is None:
   record['raw']='.runtime/monad_20261024/recording/SIMULATED_monad_actual_close.webm';record['sourceStart']=88
  else:
   context=browser.new_context(viewport={'width':1280,'height':800},record_video_dir=str(out),record_video_size={'width':1280,'height':800})
   page=context.new_page();started=time.monotonic()
   page.goto(base+route,wait_until='networkidle',timeout=180000)
   if name=='verify':expect(page.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible(timeout=180000)
   if name=='badge':expect(page.get_by_role('heading',name='On-chain attestation record verified',exact=True)).to_be_visible(timeout=120000)
   if name=='attacks':
    page.get_by_role('button',name='Check all six receipts from Monad',exact=True).click()
    expect(page.get_by_text('All six receipts were independently fetched and show reverted transactions to these deployed contracts.',exact=True)).to_be_visible(timeout=180000)
   if name=='dossier':expect(page.get_by_role('link',name='Download verified dossier JSON',exact=True)).to_be_visible()
   remaining=max(seconds+2-(time.monotonic()-started),3)
   if name=='problem':
    page.wait_for_timeout(remaining*500);page.locator('.story-row').scroll_into_view_if_needed();page.wait_for_timeout(remaining*500)
   else:page.wait_for_timeout(remaining*1000)
   video=page.video;context.close();target=out/f'SIMULATED_{name}.webm';video.save_as(str(target));record['raw']=str(target)
  records.append(record)
  print('Recorded actual walkthrough section: '+name,flush=True)
 browser.close()
Path('docs/media/SIMULATED_monad_walkthrough_plan.json').write_text(json.dumps({'simulation':True,'sections':records,'seconds':230,'scope':'Edited actual Monad UI capture on localhost, earlier real close recording, computer-generated narration; no physical phone or public website measurement'},indent=2)+'\n')
