"""Actual report editor → local model → signed review → five-plant close."""
import argparse,ast,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
expect.set_options(timeout=180000)

parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args();started=time.monotonic();errors=[]
manifest=json.loads(Path('data/simulated/reports/SIMULATED_report_manifest.json').read_text())
schema=ast.parse(Path('services/plant_agent/schema.py').read_text())
fields=next(ast.literal_eval(n.value) for n in schema.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FIELDS' for t in n.targets))
output=Path('.runtime/SIMULATED_report_browser_gate');output.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=args.chrome)
 contexts=[]
 def new_page():
  context=browser.new_context(viewport={'width':1440,'height':1000});contexts.append(context)
  page=context.new_page();page.set_default_timeout(180000);page.set_default_navigation_timeout(180000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  # This audit is automation, not human approval. Only the approval-kind field
  # changes; actual requests/results/model/proofs/transactions are never mocked.
  def mark_test_review(route):
   body=route.request.post_data_json;body['approvalKind']='AUTOMATED_TEST_SIGNATURE'
   route.continue_(post_data=json.dumps(body))
  page.route('**/agent-api/jobs/*/review',mark_test_review)
  page.goto(args.url+'/plant',wait_until='networkidle')
  return page
 try:
  setup=new_page();config=setup.request.get(args.url+'/operator/config').json()
  assert config['deployment']['chainId']==31337
  setup.get_by_label('Or upload a clearly SIMULATED text PDF',exact=True).set_input_files({'name':'broken.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.7\nnot a PDF'})
  expect(setup.locator('.notice.error')).to_contain_text('readable, unencrypted text PDF')
  setup.get_by_label('Generated Turkish PDF',exact=True).select_option('16')
  setup.get_by_role('button',name='Extract and check report',exact=True).click()
  expect(setup.get_by_text('Blocked pending correction or justified review',exact=True)).to_be_visible()
  setup.get_by_role('button',name='Open a round with the report dataset’s declared denominator',exact=True).click()
  round_select=setup.get_by_label('Open round',exact=True)
  expect(round_select).not_to_have_value('');round_id=round_select.input_value()
  setup.get_by_label('Officer name',exact=True).fill('SIMULATED automated browser audit; no human review')
  sign=setup.get_by_role('button',name='Sign review and request verifier co-signature',exact=True)
  if sign.is_enabled():
   sign.click();expect(setup.locator('.notice.error')).to_contain_text('EveryFailureRequiresWrittenOverride')
  assert setup.get_by_role('button',name='Commit sealed report values',exact=True).count()==0
  print('Impossible report and malformed PDF rejected in actual UI',flush=True)
  pages=[];keep_checked=False;refresh_checked=False
  for i in range(5):
   page=new_page();pages.append(page)
   if i==0:
    path=manifest['reports'][i]['file']
    page.get_by_label('Or upload a clearly SIMULATED text PDF',exact=True).set_input_files(path)
    response_path='/reports/analyse'
   else:
    page.get_by_label('Generated Turkish PDF',exact=True).select_option(str(i+1))
    page.get_by_role('button',name='Extract and check report',exact=True).click()
    response_path=f'/samples/{i+1}/analyse'
   expect(page.get_by_role('heading',name='Cited source values',exact=True)).to_be_visible()
   # Read only this browser's private source packet, never export its capability.
   key='SIMULATED_REPORT_JOB_'+config['deployment']['instanceId']
   cap=json.loads(page.evaluate('(k)=>sessionStorage.getItem(k)',key))
   job=page.request.get(args.url+'/agent-api/jobs/'+cap['id'],headers={'authorization':'Bearer '+cap['token']}).json()
   page.get_by_text('Review source lines and correct extraction',exact=True).click()
   for name,(label,unit) in fields.items():
    locations=[f'{p+1}:{n+1}' for p,lines in enumerate(job['sourcePages']) for n,line in enumerate(lines) if line.startswith(label+': ') and line.endswith(' '+unit)]
    assert len(locations)==1
    page.locator('.source-correction').get_by_label(name,exact=True).select_option(locations[0])
   # Exercise the previously broken "Keep current proposal" option on a field
   # whose model token and original citation exactly match the source.
   for name,proposal in job['proposal']['fields'].items():
    source=job['sourcePages'][proposal['page']-1][proposal['line']-1] if proposal['page']<=len(job['sourcePages']) and proposal['line']<=len(job['sourcePages'][proposal['page']-1]) else ''
    label,unit=fields[name]
    if not keep_checked and source==f'{label}: {proposal["rawValue"]} {unit}':
     page.locator('.source-correction').get_by_label(name,exact=True).select_option('');keep_checked=True;break
   page.get_by_label('Correction reason (at least 20 characters)',exact=True).fill('SIMULATED automated audit: source lines explicitly reviewed; no human assurance claimed.')
   page.get_by_role('button',name='Check reviewed source corrections',exact=True).click()
   expect(page.get_by_text('Corrections checked against the source. A new officer signature is required.',exact=True)).to_be_visible()
   for checkbox in page.locator('.rules input[type=checkbox]').all():checkbox.check()
   page.get_by_label('Officer name',exact=True).fill('SIMULATED automated browser audit; no human review')
   page.get_by_label('Installation actor (SIMULATED)',exact=True).select_option(str(i))
   page.get_by_label('Open round',exact=True).select_option(round_id)
   page.get_by_role('button',name='Sign review and request verifier co-signature',exact=True).click()
   expect(page.get_by_text('Officer-signed review and real verifier co-signatures prepared.',exact=True)).to_be_visible()
   page.get_by_role('button',name='Commit sealed report values',exact=True).click()
   expect(page.get_by_role('button',name='Deliver encrypted shares when Sharing is open',exact=True)).to_be_visible()
   if i==0:
    page.reload(wait_until='networkidle')
    expect(page.get_by_role('button',name='Deliver encrypted shares when Sharing is open',exact=True)).to_be_visible();refresh_checked=True
   assert page.locator('.notice.error').count()==0,page.locator('.notice.error').all_text_contents()
   print(f'Report UI plant {i+1}/5: actual model, source corrections, signed review and mined commitment',flush=True)
  presenter=browser.new_page();presenter.set_default_timeout(180000)
  presenter.goto(args.url+'/round/'+round_id,wait_until='networkidle')
  presenter.get_by_role('button',name='Open Sharing',exact=True).click()
  expect(presenter.get_by_role('button',name='Close and publish',exact=True)).to_be_visible()
  for page in pages:
   page.get_by_role('button',name='Deliver encrypted shares when Sharing is open',exact=True).click()
   expect(page.get_by_text('All three encrypted deliveries acknowledged',exact=True)).to_be_visible()
  presenter.get_by_role('button',name='Close and publish',exact=True).click()
  expect(presenter.get_by_text('Closed',exact=True)).to_be_visible()
  presenter.goto(args.url+'/verify/'+round_id,wait_until='networkidle')
  expect(presenter.get_by_role('heading',name='Verified in this browser',exact=True)).to_be_visible()
  E=sum(int(x['rawValues']['E']) for x in manifest['reports'][:5]);P=sum(int(x['rawValues']['P']) for x in manifest['reports'][:5]);ppm=E*1000000//P
  expect(presenter.locator('.verified-value strong')).to_have_text(f'{ppm//1000000}.{ppm%1000000:06}')
  assert keep_checked and refresh_checked and not errors
  presenter.screenshot(path=str(output/'SIMULATED_report_round_verified.png'),full_page=True)
  result={'simulation':True,'status':'PASS','roundId':round_id,'reportBrowserContexts':5,'realLocalModelCalls':6,'realPDFUpload':True,'malformedPDFRejected':True,'impossibleReportBlockedBeforeCommit':True,'explicitSourceCorrections':True,'keepCurrentProposalPreserved':True,'reportJobRecoveredAfterRefresh':True,'automatedReviewMetadataOnlyInterception':True,'humanApprovalPerformed':False,'aggregate':{'E':str(E),'P':str(P),'intensityPpm':str(ppm)},'encryptedDeliveriesAcknowledged':15,'independentBrowserVerified':True,'pageErrors':errors,'elapsedSeconds':round(time.monotonic()-started,2),'scope':'Real local PDF/model/editor/review/proof/commit/share/close workflow; only review approval-kind is explicitly marked automated; no model, crypto, RPC or result mocks'}
  Path('docs/SIMULATED_REPORT_BROWSER_RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
 finally:browser.close()
