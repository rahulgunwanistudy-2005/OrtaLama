"""Actual model evaluation; oracle physics and end-to-end scores are separate."""
from decimal import Decimal as D
import json
from pathlib import Path
import time
import httpx
from services.plant_agent.engine import read_report, analyse, validate
from services.plant_agent.extract import extract
from services.plant_agent.schema import Extraction, FIELDS

manifest = json.loads(Path('data/simulated/reports/SIMULATED_report_manifest.json').read_text())
out = Path('data/simulated/ai_eval')
out.mkdir(exist_ok=True)
results = []
started = time.perf_counter()
for i, record in enumerate(manifest['reports']):
    report = read_report(record['file'])
    assert report['simulation'] and report['sha256'] == record['sha256']
    audit = out / f'SIMULATED_model_report_{i + 1:02d}.json'
    cached = json.loads(audit.read_text()) if audit.exists() else None
    try:
        if cached and cached['reportSHA256'] == report['sha256'] and cached['measurement']['promptVersion'] == 2:
            proposal = Extraction.model_validate_json(cached['rawModelResponse']).model_dump()
            measurement = cached['measurement']
        else:
            proposal, measurement = extract(report, audit_path=audit)
        result = {'simulation': True, 'file': record['file'], 'reportSHA256': report['sha256'], 'measurement': measurement, 'schemaValid': True}
        exact = 0
        citations = 0
        numeric = 0
        for name, citation in proposal['fields'].items():
            exact += citation['rawValue'] == record['rawValues'][name]
            try:
                numeric += D(citation['rawValue'].replace(',', '.')) == D(record['rawValues'][name].replace(',', '.'))
            except Exception:
                pass
            try:
                line = report['pages'][citation['page'] - 1][citation['line'] - 1]
                citations += line == f"{FIELDS[name][0]}: {record['rawValues'][name]} {record['units'][name]}"
            except IndexError:
                pass
        result.update(exactValueFields=exact, exactCitationFields=citations, numericValueFields=numeric)
        try:
            result['analysis'] = analyse(report, proposal)
            result['endToEndBlocked'] = result['analysis']['blocked']
        except ValueError as error:
            result.update(groundingError=str(error), endToEndBlocked=True)
    except Exception as error:
        # No model or transport failure becomes a silently accepted report.
        result = {'simulation': True, 'file': record['file'], 'reportSHA256': report['sha256'], 'schemaValid': False, 'errorClass': type(error).__name__, 'exactValueFields': 0, 'exactCitationFields': 0, 'numericValueFields': 0, 'endToEndBlocked': True}
    values = {k: D(v.replace(',', '.')) for k, v in record['rawValues'].items()}
    result.update(plantedError=record['plantedError'], expectedBlocked=record['expectedBlocked'], oraclePhysics=validate(values))
    results.append(result)
    (out / f'SIMULATED_scored_report_{i + 1:02d}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'simulation': True, 'report': i + 1, 'schemaValid': result['schemaValid'], 'exactValues': result['exactValueFields'], 'exactCitations': result['exactCitationFields'], 'blocked': result['endToEndBlocked'], 'expectedBlocked': result['expectedBlocked']}), flush=True)
bad = [r for r in results if r['expectedBlocked']]
valid = [r for r in results if not r['expectedBlocked']]
summary = {'simulation': True, 'reports': len(results), 'fieldsPerReport': len(FIELDS), 'fieldComparisons': len(results) * len(FIELDS), 'schemaValidReports': sum(r['schemaValid'] for r in results), 'exactValueFields': sum(r['exactValueFields'] for r in results), 'exactCitationFields': sum(r['exactCitationFields'] for r in results), 'impossibleReports': len(bad), 'oraclePhysicsCaught': sum(r['oraclePhysics']['blocked'] for r in bad), 'oracleValidReportsBlocked': sum(r['oraclePhysics']['blocked'] for r in valid), 'endToEndImpossibleBlocked': sum(r['endToEndBlocked'] for r in bad), 'endToEndValidReportsBlocked': sum(r['endToEndBlocked'] for r in valid), 'elapsedSeconds': round(time.perf_counter() - started, 3), 'modelSeconds': round(sum(r.get('measurement', {}).get('seconds', 0) for r in results), 3), 'sourceIds': manifest['sourceIds'], 'limitations': manifest['limitations'] + ['No real reports evaluated', 'Synthetic one-page layouts and shared wording limit generalisation', 'Failures are retained in the denominator; source-grounding rejection is not counted as a physics catch', 'Tokens and time are observations, not energy or CO2e estimates']}
summary['status'] = 'LOCAL_PASS' if summary['schemaValidReports'] == 20 and summary['oraclePhysicsCaught'] == len(bad) and summary['oracleValidReportsBlocked'] == 0 and summary['endToEndImpossibleBlocked'] == len(bad) else 'FAIL'
summary['numericValueFields'] = sum(r.get('numericValueFields',0) for r in results)
summary['fullySourceGroundedReports'] = sum('analysis' in r for r in results)
summary['disclosedAlignmentRepairs'] = sum(sum(c['alignment'] != 'VERBATIM' for c in r.get('analysis',{}).get('citations',{}).values()) for r in results)
try:
    summary['localModelIdentity'] = httpx.get('http://127.0.0.1:11441/api/tags').json()['models']
except Exception:
    summary['localModelIdentity'] = 'UNAVAILABLE'
Path('docs/SIMULATED_AI_EVAL.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary), flush=True)
if summary['status'] != 'LOCAL_PASS':
    raise SystemExit(1)
