"""Decimal deterministic checks. These establish consistency, never report truth."""
from decimal import Decimal as D
import hashlib
import json
from pathlib import Path
import re
import pdfplumber
from pdfplumber.utils.exceptions import PdfminerException
from pdfminer.psexceptions import PSException
from .schema import Extraction, FIELDS

CONSTANTS = json.loads(Path('data/real/physics.json').read_text())


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def read_report(path):
    path = Path(path)
    if path.stat().st_size > 10_000_000:
        raise ValueError('ReportTooLarge')
    pages = []
    try:
        with pdfplumber.open(path) as pdf:
            if len(pdf.pages) > 100:
                raise ValueError('TooManyPages')
            for page in pdf.pages:
                pages.append((page.extract_text() or '').splitlines())
    except (PSException,PdfminerException) as error:
        raise ValueError('Upload a readable, unencrypted text PDF.') from error
    if not pages or not any(lines for lines in pages):
        raise ValueError('Upload a text PDF; empty or scanned documents are not supported.')
    text = '\n'.join(f'[page {p + 1} line {i + 1}] {line}' for p, lines in enumerate(pages) for i, line in enumerate(lines))
    return {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'pages': pages, 'text': text, 'simulation': all('SIMULATED' in '\n'.join(lines) for lines in pages)}


def assert_supported_report_round(report, round_data):
    """The cement fixture adapter must never attest a different product/year."""
    manifest=json.loads(Path('data/simulated/reports/SIMULATED_report_manifest.json').read_text())
    known={row['sha256'] for row in manifest['reports'] if row['simulation'] and Path(row['file']).name.startswith('SIMULATED_TR_')}
    years=[]
    for page in report['pages']:
        for line in page:
            match=re.fullmatch(r'SIMULATED tesis [0-9]{2} \| Rapor dönemi: ([0-9]{4})',line)
            if match:years.append(int(match.group(1)))
    if not report['simulation'] or report['sha256'] not in known or len(years)!=1:
        raise ValueError('ReportContextAdapterRequiredBeforeSealing')
    cfg=round_data['config']
    if int(round_data['state'])!=1:
        raise ValueError('RoundNotOpenForReportReview')
    country=bytes.fromhex(cfg['country'][2:]).decode('ascii')
    product=bytes.fromhex(cfg['productCN'][2:]).decode('ascii')
    if country!='TR' or product!='25231000' or int(cfg['period'])!=years[0]:
        raise ValueError('ReportProductCountryOrPeriodMismatch')


def ground(report, extraction):
    proposed = Extraction.model_validate(extraction).fields.model_dump()
    values, citations = {}, {}
    for name, citation in proposed.items():
        page, line = citation['page'], citation['line']
        try:
            source_line = report['pages'][page - 1][line - 1]
        except IndexError:
            source_line = ''
        label, unit = FIELDS[name]
        # Only source text is converted to a number. The model's number is checked
        # for exact copying, and is never itself the source of a commitment input.
        pattern = re.escape(label) + r': (-?(?:0|[1-9][0-9]*)(?:,[0-9]{1,9})?) ' + re.escape(unit)
        match = re.fullmatch(pattern, source_line)
        verbatim = bool(match and match.group(1) == citation['rawValue'])
        if not verbatim:
            # A bounded, disclosed alignment can recover model citation/format
            # errors only when one labelled source field has the identical value.
            # It never substitutes a different source value for the model's guess.
            if not re.fullmatch(r'-?(?:0|[1-9][0-9]*)(?:[.,][0-9]{1,9})?', citation['rawValue']):
                raise ValueError('NonCanonicalModelToken:' + name)
            suggested = D(citation['rawValue'].replace(',', '.'))
            candidates = []
            for p, lines in enumerate(report['pages']):
                for n, text in enumerate(lines):
                    candidate = re.fullmatch(pattern, text)
                    if candidate and D(candidate.group(1).replace(',', '.')) == suggested:
                        candidates.append((p + 1, n + 1, text, candidate))
            if len(candidates) != 1:
                raise ValueError('CitationOrUnitMismatch:' + name)
            page, line, source_line, match = candidates[0]
        raw = match.group(1)
        values[name] = D(raw.replace(',', '.'))
        citations[name] = {'page': page, 'line': line, 'rawValue': raw, 'modelProposal': citation, 'alignment': 'VERBATIM' if verbatim else 'NUMERIC_FORMAT_OR_UNIQUE_LINE_REPAIR_REQUIRES_REVIEW', 'quote': source_line, 'unit': unit, 'value': str(values[name])}
    return values, citations


def validate(values):
    v = values
    rules = []

    def rule(id, status, reason, sources, details=None):
        rules.append({'id': id, 'status': status, 'reason': reason, 'sourceIds': sources, 'details': details})

    bounds = v['P'] > 0 and v['E'] >= 0 and v['P'] < 2**48 and v['E'] < 2**48 and v['P'] == v['P'].to_integral_value() and v['E'] == v['E'].to_integral_value()
    rule('R01', 'PASS' if bounds else 'FAIL', 'E/P must be canonical integer kg values within circuit limits, with positive production.', ['CRYPTO_SPEC'])
    oxides = 0 <= v['cao'] <= 100 and 0 <= v['mgo'] <= 100 and v['cao'] + v['mgo'] <= 100 and v['ckd'] >= 0
    rule('R02', 'PASS' if oxides else 'FAIL', 'Mass fractions and the stated CKD correction must be nonnegative and internally possible; unsupported boundaries require review.', ['S24','S26'])
    fuel_ok = all(v[k] >= 0 for k in ['petcoke','coal','gas']) and v['thermal'] > 0
    rule('R03', 'PASS' if fuel_ok else 'FAIL', 'Fuel energy quantities must be nonnegative and total kiln energy positive.', ['S23'])
    if not (bounds and oxides and fuel_ok):
        return {'rules': rules, 'blocked': True, 'calculation': {'E': str(int(v['E'])), 'P': str(int(v['P'])), 'intensity': str(v['E'] / v['P'])} if bounds else None, 'constantsHash': digest(CONSTANTS)}
    energy_sum = sum(v[k] for k in ['petcoke','coal','gas'])
    tolerance = D(CONSTANTS['reviewPolicy']['massBalanceRelativeTolerance'])
    energy_ok = abs(energy_sum - v['thermal']) <= tolerance * v['thermal']
    rule('R04', 'PASS' if energy_ok else 'FAIL', 'Reported total kiln thermal energy must reconcile with the individual NCV fuel quantities within the explicit 2% application review tolerance.', ['S23','APPLICATION_POLICY'], {'fuelSumTJ': str(energy_sum), 'reportedTJ': str(v['thermal'])})
    weights = CONSTANTS['roundedMolecularWeights']
    calcination = v['P'] * (v['cao'] / 100 * D(weights['CO2']) / D(weights['CaO']) + v['mgo'] / 100 * D(weights['CO2']) / D(weights['MgO'])) * (1 + v['ckd'] / 100)
    factors = CONSTANTS['fuelCO2KgPerTJNCV']
    fuel = {key: sum(v[name] * D(factors[name][key]) for name in factors) for key in ['default','lower','upper']}
    lower = (calcination + fuel['lower']) * (1 - tolerance)
    upper = (calcination + fuel['upper']) * (1 + tolerance)
    mass_ok = lower <= v['E'] <= upper
    rule('R05', 'PASS' if mass_ok else 'FAIL', 'Direct CO2 must fall within the declared carbonate plus fossil-fuel mass-balance interval. This simplified boundary assumes no CCS, biomass or non-carbonate oxides.', ['S23','S24','S26','S27','S28','S29','APPLICATION_POLICY'], {'processKg': str(calcination), 'fuelKg': str(fuel['default']), 'lowerKg': str(lower), 'upperKg': str(upper), 'reportedKg': str(v['E'])})
    specific = v['thermal'] * 1_000_000_000 / v['P']
    bat = CONSTANTS['batReferenceMJPerTonneClinker']
    in_bat = D(bat['lower']) <= specific <= D(bat['upper'])
    rule('R06', 'PASS' if in_bat else 'REVIEW', 'Scoped BAT energy reference only. A value outside 2900-3300 MJ/t is not proof of physical impossibility or noncompliance.', ['S25'], {'MJPerTonneClinker': str(specific), 'referenceScope': bat['scope']})
    ratio = v['E'] / v['P']
    change = abs(ratio - v['previous']) / v['previous'] if v['previous'] > 0 else None
    stable = change is not None and change <= D(CONSTANTS['reviewPolicy']['yearOnYearRelativeFlag'])
    rule('R07', 'PASS' if stable else 'REVIEW', 'Year-on-year movement above the explicit 15% application review threshold requires explanation; it is not a legal threshold.', ['APPLICATION_POLICY'], {'relativeChange': str(change) if change is not None else None})
    return {'rules': rules, 'blocked': any(r['status'] == 'FAIL' for r in rules), 'calculation': {'E': str(int(v['E'])), 'P': str(int(v['P'])), 'intensity': str(ratio), 'derivedPlausibilityInterval': [str(lower / v['P']), str(upper / v['P'])]}, 'constantsHash': digest(CONSTANTS), 'limitations': ['Consistency within a declared simplified boundary does not establish truthful or complete measurement', 'BAT range is advisory; review tolerances are application policy, not official methodology']}


def analyse(report, extraction):
    values, citations = ground(report, extraction)
    result = validate(values)
    repairs = [name for name, cite in citations.items() if cite['alignment'] != 'VERBATIM']
    if repairs:
        result['rules'].insert(0, {'id': 'R00', 'status': 'REVIEW', 'reason': 'Model citation/format errors were aligned to unique labelled source fields with identical numeric values. The officer must review the repairs.', 'sourceIds': ['APPLICATION_POLICY'], 'details': {'fields': repairs}})
    return {'simulation': report['simulation'], 'reportHash': report['sha256'], 'extraction': extraction, 'citations': citations, **result}
