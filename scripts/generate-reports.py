"""Reproducible Turkish SIMULATED PDFs; independent expected values stay in a manifest."""
from decimal import Decimal as D, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from services.plant_agent.schema import FIELDS

root = Path('data/simulated/reports')
root.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Report', 'assets/fonts/NotoSans-Regular.ttf'))
records = []
for i in range(20):
    P = D(420000000 + 35000000 * (i % 12))
    specific = D(3200 + 100 * (i % 12))
    energy = P / 1000 * specific / 1000000
    petcoke = (energy * D(60 + i % 5 * 5) / 100).quantize(D('.000001'))
    coal = (energy * D('.15')).quantize(D('.000001'))
    gas = energy - petcoke - coal
    cao, mgo, ckd = D('65'), D('1.5'), D('2')
    process = P * (cao / 100 * D('44.01') / D('56.08') + mgo / 100 * D('44.01') / D('40.30')) * (1 + ckd / 100)
    fossil = petcoke * 97500 + coal * 94600 + gas * 56100  # S23 Table 2.3, NCV
    E = (process + fossil).quantize(D('1'), rounding=ROUND_HALF_UP)
    values = dict(E=E, P=P, cao=cao, mgo=mgo, ckd=ckd, petcoke=petcoke, coal=coal, gas=gas, thermal=energy, previous=(E / P * D('1.02')).quantize(D('.000001')))
    units = {k: unit for k, (_, unit) in FIELDS.items()}
    planted = None
    if i == 12:
        values['E'] *= 1000; planted = 'emissions_unit_slip'
    elif i == 13:
        values['P'] = D(0); planted = 'zero_production'
    elif i == 14:
        values['cao'] = D(165); planted = 'impossible_oxide_fraction'
    elif i == 15:
        values['E'] = D(1); planted = 'below_calcination_and_fuel_mass_balance'
    elif i == 16:
        values['thermal'] *= 1000; planted = 'thermal_unit_slip'
    elif i == 17:
        values['petcoke'] = -petcoke; planted = 'negative_fuel'
    elif i == 18:
        values['E'], values['P'] = values['P'], values['E']; planted = 'swapped_totals'
    elif i == 19:
        values['gas'] *= 1000; planted = 'fuel_energy_unit_slip'
    name = f'SIMULATED_TR_plant_{i + 1:02d}.pdf'
    path = root / name
    c = canvas.Canvas(str(path), pagesize=A4, invariant=1)
    c.setTitle(name)
    c.setAuthor('Ortalama SIMULATED test generator')
    c.setSubject(json.dumps({'simulation': True, 'realPlantReport': False}))
    w, h = A4
    c.setFillColorRGB(.94, .94, .94)
    c.saveState(); c.translate(w / 2, h / 2); c.rotate(40); c.setFont('Report', 58); c.drawCentredString(0, 0, 'SIMULATED'); c.restoreState()
    c.setFillColorRGB(.12, .15, .17); c.setFont('Report', 11)
    c.drawString(45, h - 48, 'Ortalama / SIMULATED test belgesi')
    c.setFont('Report', 19); c.drawString(45, h - 84, 'Yıllık emisyon ve üretim raporu')
    c.setFont('Report', 10)
    lines = [f'SIMULATED tesis {i + 1:02d} | Rapor dönemi: 2025',
             'Ürün: gri klinker. Sınır: doğrudan fosil ve proses CO2.',
             'Varsayım: karbonat kökenli oksitler; karbon yakalama ve biyokütle yok.',
             'Bu bir eğitim/test belgesidir. Gerçek tesis veya doğrulama beyanı değildir.']
    y = h - 116
    for line in lines:
        c.drawString(45, y, line); y -= 19
    y -= 20
    raw = {}
    for key, (label, _) in FIELDS.items():
        value = format(values[key], 'f').replace('.', ',')
        raw[key] = value
        c.setStrokeColorRGB(.8, .82, .83); c.line(45, y - 10, w - 45, y - 10)
        c.drawString(45, y, f'{label}: {value} {units[key]}'); y -= 34
    c.setFont('Report', 9)
    c.drawString(45, 105, 'Hesap girdileri sentetiktir. İnsan onayı henüz verilmemiştir.')
    c.drawString(45, 86, 'Yakıt miktarları net ısıl değer bazında enerji miktarı (TJ) olarak bildirilir.')
    c.drawString(45, 47, f'SIMULATED | Test kaydı {i + 1:02d} | Sayfa 1 / 1')
    c.save()
    records.append({'simulation': True, 'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'rawValues': raw, 'units': units, 'plantedError': planted, 'expectedBlocked': planted is not None})
out = {'simulation': True, 'sourceIds': ['S23','S24','S26','S27','S28','S29'], 'reports': records, 'limitations': ['Synthetic one-page report layouts; not a representative real-report benchmark', 'Fuel quantities are stated as energy quantities on an NCV basis, not measured fuel masses', 'Simplified direct-emissions boundary, not CBAM monitoring conformance']}
(root / 'SIMULATED_report_manifest.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
valid = records[:12]
print(json.dumps({'simulation': True, 'reports': len(records), 'plantedErrors': 8, 'validCohortIntensity': str(sum(D(r['rawValues']['E'].replace(',', '.')) for r in valid) / sum(D(r['rawValues']['P'].replace(',', '.')) for r in valid))}))
