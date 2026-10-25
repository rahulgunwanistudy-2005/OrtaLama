"""Deterministic, public-only PDF summary of a verified JSON dossier."""
from datetime import datetime,timezone
from html import escape
from io import BytesIO
import json
from pathlib import Path
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether

pdfmetrics.registerFont(TTFont('DossierBody','assets/fonts/NotoSans-Regular.ttf'))
INK=colors.HexColor('#243330');GREEN=colors.HexColor('#526d60');EMBER=colors.HexColor('#a43b1d');LINE=colors.HexColor('#b6c0ba')
STYLES={
 'title':ParagraphStyle('title',fontName='DossierBody',fontSize=27,leading=33,textColor=INK,spaceAfter=12),
 'h':ParagraphStyle('h',fontName='DossierBody',fontSize=14,leading=19,textColor=INK,spaceBefore=13,spaceAfter=7),
 'body':ParagraphStyle('body',fontName='DossierBody',fontSize=9,leading=14,textColor=INK,spaceAfter=7,splitLongWords=True),
 'small':ParagraphStyle('small',fontName='DossierBody',fontSize=7.5,leading=11,textColor=INK,spaceAfter=5,splitLongWords=True),
 'mono':ParagraphStyle('mono',fontName='Courier',fontSize=7,leading=10,textColor=INK,spaceAfter=5,splitLongWords=True),
 'metric':ParagraphStyle('metric',fontName='DossierBody',fontSize=25,leading=31,textColor=INK,spaceAfter=7),
 'txLabel':ParagraphStyle('txLabel',fontName='DossierBody',fontSize=7,leading=9,textColor=INK,spaceAfter=2,splitLongWords=True),
 'txHash':ParagraphStyle('txHash',fontName='Courier',fontSize=6.5,leading=8.5,textColor=INK,spaceAfter=4,splitLongWords=True),
}
def paragraph(text,style='body'):
    return Paragraph(escape(str(text)).replace('\n','<br/>'),STYLES[style])

def render_dossier(packet):
    if packet.get('kind')!='SIMULATED_ORTALAMA_EVIDENCE' or packet.get('simulation') is not True:
        raise ValueError('Only the explicit SIMULATED format is supported')
    p=packet['payload'];s=p['snapshot'];r=s['round'];out=BytesIO()
    doc=SimpleDocTemplate(out,pagesize=A4,rightMargin=19*mm,leftMargin=19*mm,topMargin=22*mm,bottomMargin=21*mm,title=f"SIMULATED Ortalama dossier round {s['roundId']}",author='Ortalama engineering prototype',subject='SIMULATED public arithmetic and signature evidence; no regulatory acceptance')
    story=[]
    def add(text,style='body'):story.append(paragraph(text,style))
    def heading(text):add(text,'h')
    add('SIMULATED / PUBLIC EVIDENCE','small')
    add(f"A sealed cohort.\nOne public result.\nRound {s['roundId']}",'title')
    add('Real cryptographic checks over synthetic inputs, actors, keys and a declared sector denominator. No accreditation, official acceptance or measured climate impact is asserted.')
    intensity=int(r['intensity']);add(f'{intensity//1_000_000}.{intensity%1_000_000:06d}','metric')
    add('kg CO2 per kg product - programme boundaries must be reconciled before official use. The displayed ratio is rounded down to six decimals. Badges compare exact rational thresholds.','small')
    rows=[['Public field','Value'],['Aggregate emissions / kg CO2',r['SE']],['Aggregate production / kg',r['SP']],['Contributing installations',r['n']],['Declared sector production / kg',r['config']['sectorProduction']],['Declared-denominator coverage / ppm',r['coveragePpm']],['Protocol representative flag',str(r['representative'])]]
    table=Table([[paragraph(c,'small') for c in row] for row in rows],colWidths=[107*mm,65*mm],hAlign='LEFT')
    table.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,0),.8,GREEN),('LINEBELOW',(0,1),(-1,-1),.3,LINE),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),4),('VALIGN',(0,0),(-1,-1),'TOP')]))
    story.append(table)
    heading('Pinned public evidence')
    stamp=datetime.fromtimestamp(int(p['blockTimestamp']),timezone.utc).isoformat()
    add(f"Chain {s['chainId']} / block {s['block']} / block time {stamp}",'small')
    add('Round contract: '+s['address'],'mono')
    add('Block hash: '+s['blockHash'],'mono')
    add('Frozen manifest: '+r['manifestHash'],'mono')
    add('Canonical payload SHA-256: '+packet['payloadSHA256'],'mono')
    add('This PDF is a readable summary. The companion JSON contains the complete commitments, trustee publications, signature sidecars, parameters and events. The checksum detects changes to that payload; it is not a regulator signature.','small')
    story.append(PageBreak())
    heading('Reproduce the checks')
    steps=[
      'Obtain the source build and expected deployment anchor independently. A file supplied beside this dossier is a convenience copy, not an independent trust root.',
      'Validate schemas/dossier.schema.json and recompute the canonical payload checksum and source hashes.',
      'Fetch the selected RPC at the pinned block, check chain ID and all four deployed code hashes, and match the complete snapshot and public events.',
      'Recompute the exact ordered manifest, point sums, every published trustee VSS sum, interpolation, aggregate openings, intensity and declared-denominator coverage.',
      'Check every allowlisted ECDSA/ML-DSA-65 co-signature and successful transaction receipt. ML-DSA is checked off-chain.',
    ]
    for i,text in enumerate(steps,1):add(f'{i}. {text}')
    add('node --import tsx scripts/verify-dossier.ts --dossier SIMULATED_dossier.json --deployment SIMULATED_deployment.json --rpc http://127.0.0.1:PORT','mono')
    add('Offline mode: add --offline and omit --rpc. It verifies arithmetic and signatures without authenticating chain history. Local RPC links require access to the originating machine; no public phone endpoint is implied.','small')
    heading('Frozen contributing installations')
    for i,plant in enumerate(s['plants']):
        add(f"{i+1}. {plant['installationId']}",'mono')
        add(f'Complete public commitment and ciphertext hashes: JSON /payload/snapshot/plants/{i}. No individual opening is included.','small')
    heading('Trustee publication record')
    add(f"Publication mask {r['publicationMask']} / fault mask {r['faultMask']}. Complete public share-sum values are in JSON /payload/snapshot/sums. These are aggregate trustee shares, not per-plant plaintexts.")
    story.append(PageBreak())
    heading('Successful transaction evidence')
    transactions={}
    for event in p['events']:
        transactions.setdefault(event['transactionHash'],{'block':event['blockNumber'],'events':[]})['events'].append(event['name'])
    add(f'{len(transactions)} unique successful transaction records. A reverted attack has no successful event and is documented separately in the attack-console evidence.','small')
    cells=[]
    for tx,record in transactions.items():
        cells.append([paragraph(f"Block {record['block']} / {', '.join(record['events'])}",'txLabel'),paragraph(tx,'txHash')])
    pairs=[cells[i:i+2]+([[]] if len(cells[i:i+2])==1 else []) for i in range(0,len(cells),2)]
    transactions_table=Table(pairs,colWidths=[86*mm,86*mm],hAlign='LEFT')
    transactions_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.25,LINE),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    story.append(transactions_table)
    story.append(PageBreak())
    heading('Provenance and limits')
    add('No private report, opening, individual share plaintext, signing key, trustee storage key or job capability is included. Verifier identities are synthetic and unaccredited. Report truth and official acceptance are not established.')
    for i,limit in enumerate(p['limitations'],1):add(f'{i}. {limit}','small')
    story.append(PageBreak())
    heading('Source register')
    for source in p['sourceRecords']:
        label=f"{source['id']} / {source['title']} / accessed {source['accessed_on']}"
        story.append(Paragraph(f'<a href="{escape(source["url"],quote=True)}">{escape(label)}</a>',STYLES['small']))
    add('Full source scopes and classes are retained in the JSON. References establish context; they do not endorse or certify this prototype.','small')
    def decorate(canvas,document):
        canvas.saveState();canvas.setFont('DossierBody',7);canvas.setFillColor(INK)
        canvas.drawString(19*mm,A4[1]-14*mm,f"Ortalama / SIMULATED public dossier / round {s['roundId']}")
        canvas.setStrokeColor(LINE);canvas.line(19*mm,18*mm,A4[0]-19*mm,18*mm)
        canvas.setFont('DossierBody',7);canvas.setFillColor(EMBER);canvas.drawString(19*mm,13*mm,'SIMULATED - evidence of arithmetic, not regulatory acceptance')
        canvas.setFillColor(INK);canvas.drawRightString(A4[0]-19*mm,13*mm,str(document.page));canvas.restoreState()
    doc.build(story,onFirstPage=decorate,onLaterPages=decorate,canvasmaker=lambda *a,**k:Canvas(*a,**{**k,'invariant':1}))
    return out.getvalue()

if __name__=='__main__':
    packet=json.loads(Path(sys.argv[1]).read_text())
    Path(sys.argv[2]).write_bytes(render_dossier(packet))
