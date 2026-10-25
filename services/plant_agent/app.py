"""Plant-local report/review API. Job capabilities never belong in public dossiers."""
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import threading
from typing import Literal

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import Field
from services.common import bridge, deployment, read_json
from .engine import read_report, analyse, digest, assert_supported_report_round
from .extract import extract
from .review import prepare_review
from .schema import Strict, Extraction

root = Path(os.getenv('ORTALAMA_RUNTIME', '.runtime')) / 'plant-jobs'
root.mkdir(parents=True, exist_ok=True, mode=0o700)
root.chmod(0o700)
operation_lock = threading.Lock()
app = FastAPI(title='Ortalama plant-local agent', version='2')


def path_for(job_id):
    if not re.fullmatch(r'[0-9a-f]{32}', job_id):
        raise HTTPException(404, 'Unknown job')
    return root / f'SIMULATED_job_{job_id}_secret.json'


def save(job):
    path = path_for(job['id'])
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(job, ensure_ascii=False))
    tmp.chmod(0o600)
    tmp.replace(path)


def job_for(job_id, authorization):
    path = path_for(job_id)
    if not path.exists():
        raise HTTPException(404, 'Unknown job')
    job = read_json(path)
    if not hmac.compare_digest(authorization, 'Bearer ' + job['token']):
        raise HTTPException(404, 'Unknown job')
    if job['deployment'] != deployment()['round']:
        raise HTTPException(409, 'Job belongs to another deployment')
    return job


@app.exception_handler(ValueError)
async def invalid_operation(request, error):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=409, content={'detail': str(error)[:120]})


@app.exception_handler(httpx.HTTPError)
async def dependency_failure(request, error):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={'detail': 'Model, indexer or trustee unavailable; inspect service health before retrying'})


@app.get('/health')
def health():
    try:
        response = httpx.get(os.getenv('ORTALAMA_LLM_URL', 'http://127.0.0.1:11441') + '/api/tags', timeout=5)
        response.raise_for_status()
        model = os.getenv('ORTALAMA_LLM_MODEL', 'qwen2.5:1.5b')
        if model not in {m['name'] for m in response.json()['models']}:
            raise ValueError('ModelNotInstalled')
        return {'status': 'ready', 'simulation': True, 'localModel': model}
    except Exception:
        raise HTTPException(503, 'Local extraction model unavailable')


@app.get('/samples')
def samples():
    manifest = read_json('data/simulated/reports/SIMULATED_report_manifest.json')
    return [{'simulation': True, 'id': i + 1, 'filename': Path(r['file']).name, 'sha256': r['sha256']} for i, r in enumerate(manifest['reports'])]


def process_report(path):
    report = read_report(path)
    if not report['simulation']:
        raise ValueError('DemoAcceptsOnlyExplicitlySimulatedReports')
    proposal, measurement = extract(report)
    try:
        analysis = analyse(report, proposal)
    except ValueError as error:
        analysis = {'simulation': True, 'reportHash': report['sha256'], 'blocked': True, 'calculation': None, 'citations': {}, 'rules': [{'id': 'R00', 'status': 'FAIL', 'reason': 'Model proposal does not match source text. Correct the extraction against its page/line citation before review.', 'sourceIds': ['APPLICATION_POLICY']}], 'groundingError': str(error)}
    job = {'id': secrets.token_hex(16), 'token': secrets.token_hex(32), 'simulation': True, 'deployment': deployment()['round'], 'reportPath': str(path), 'proposal': proposal, 'originalModelProposalHash': digest(proposal), 'correctionHistory': [], 'sourcePages': report['pages'], 'measurement': measurement, 'analysis': analysis}
    save(job)
    return {'simulation': True, 'id': job['id'], 'token': job['token'], 'analysis': analysis, 'measurement': measurement, 'modelProposal': proposal, 'sourcePages': report['pages']}


def recompute(job):
    analysis = analyse(read_report(job['reportPath']), job['proposal'])
    analysis['extractionHistoryHash'] = digest({'originalModelProposalHash': job['originalModelProposalHash'], 'corrections': job['correctionHistory']})
    if job['correctionHistory']:
        analysis['rules'].append({'id': 'R08', 'status': 'REVIEW', 'reason': 'The officer corrected model transcription against the source; the signed metadata binds the correction history.', 'sourceIds': ['APPLICATION_POLICY']})
    return analysis


@app.post('/samples/{sample_id}/analyse')
def analyse_sample(sample_id: int):
    records = read_json('data/simulated/reports/SIMULATED_report_manifest.json')['reports']
    if not 1 <= sample_id <= len(records):
        raise HTTPException(404, 'Unknown simulated report')
    with operation_lock:
        return process_report(records[sample_id - 1]['file'])


@app.post('/reports/analyse')
async def upload_report(request: Request):
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > 10_000_000:
            raise HTTPException(413, 'PDF exceeds 10 MB')
        chunks.append(chunk)
    content = b''.join(chunks)
    if not content.startswith(b'%PDF-'):
        raise HTTPException(415, 'PDF required')
    path = root / f'SIMULATED_uploaded_{secrets.token_hex(16)}.pdf'
    path.write_bytes(content); path.chmod(0o600)
    # Move blocking model/PDF work off the request event loop.
    import asyncio
    def work():
        with operation_lock:
            return process_report(path)
    return await asyncio.to_thread(work)


@app.get('/jobs/{job_id}')
def read_job(job_id: str, authorization: str = Header(default='')):
    job = job_for(job_id, authorization)
    return {k: v for k, v in job.items() if k not in ['token', 'reportPath']}


class Correction(Strict):
    extraction: Extraction
    reason: str = Field(min_length=20, max_length=2000)


@app.post('/jobs/{job_id}/correct-extraction')
def correct_extraction(job_id: str, options: Correction, authorization: str = Header(default='')):
    with operation_lock:
        job = job_for(job_id, authorization)
        if job.get('sealed'):
            raise ValueError('AlreadySealed')
        proposal = options.extraction.model_dump()
        analyse(read_report(job['reportPath']), proposal)  # Must ground before changing the job.
        job['correctionHistory'].append({'before': digest(job['proposal']), 'after': digest(proposal), 'reason': options.reason})
        job['proposal'] = proposal
        job.pop('review', None)
        job['analysis'] = recompute(job)
        save(job)
        return {'simulation': True, 'analysis': job['analysis']}


class ReviewRequest(Strict):
    officerName: str = Field(min_length=2, max_length=80)
    officerAddress: str = Field(pattern=r'^0x[0-9a-fA-F]{40}$')
    roundId: str = Field(pattern=r'^[1-9][0-9]{0,19}$')
    installationId: str = Field(pattern=r'^0x[0-9a-f]{64}$')
    overrides: dict[str, str]
    acknowledgements: list[str]
    approvalKind: Literal['HUMAN_REVIEW', 'AUTOMATED_TEST_SIGNATURE'] = 'HUMAN_REVIEW'


@app.post('/jobs/{job_id}/review')
def review(job_id: str, options: ReviewRequest, authorization: str = Header(default='')):
    with operation_lock:
        job = job_for(job_id, authorization)
        if job.get('sealed'):
            raise ValueError('AlreadySealed')
        job['analysis'] = recompute(job)
        if options.approvalKind != 'HUMAN_REVIEW' and os.getenv('ORTALAMA_AUTOMATED_REVIEW_TEST') != '1':
            raise ValueError('AutomatedReviewTestModeDisabled')
        assert_supported_report_round(read_report(job['reportPath']),bridge('snapshot',roundId=options.roundId)['round'])
        packet = prepare_review(job['analysis'], options.officerName, options.officerAddress, options.roundId, options.installationId, deployment(), options.overrides, options.acknowledgements, options.approvalKind)
        scenario = read_json(Path(os.getenv('ORTALAMA_RUNTIME', '.runtime')) / 'SIMULATED_scenario.json')
        actor = next((p['actor'] for p in scenario['plants'] if p['installationId'] == options.installationId), None)
        if not actor or actor.lower() != options.officerAddress.lower():
            raise ValueError('OfficerIsNotThisSimulatedInstallationActor')
        job['review'] = packet
        save(job)
        return packet


class Signature(Strict):
    signature: str = Field(pattern=r'^0x[0-9a-f]{130}$')


@app.post('/jobs/{job_id}/seal')
def seal(job_id: str, options: Signature, authorization: str = Header(default='')):
    with operation_lock:
        job = job_for(job_id, authorization)
        if 'review' not in job or job.get('sealed'):
            raise ValueError('FreshOfficerReviewRequired')
        analysis = recompute(job)
        if digest(analysis) != job['review']['core']['analysisHash']:
            raise ValueError('ReportChangedAfterReview')
        packet = {**job['review'], 'signature': options.signature}
        core = packet['core']
        assert_supported_report_round(read_report(job['reportPath']),bridge('snapshot',roundId=core['roundId'])['round'])
        result = bridge('sealReviewed', roundId=core['roundId'], installationId=core['installationId'], review=packet)
        job.update(review=packet, sealed=result)
        save(job)
        return result


@app.post('/jobs/{job_id}/commit')
def commit(job_id: str, authorization: str = Header(default='')):
    with operation_lock:
        job = job_for(job_id, authorization)
        if not job.get('sealed'):
            raise ValueError('OfficerReviewAndVerifierCosignRequired')
        if not job.get('commit'):
            c = job['review']['core']
            job['commit'] = bridge('commitReviewed', roundId=c['roundId'], installationId=c['installationId'], reviewDigest=job['review']['reviewDigest'])
            save(job)
        c = job['review']['core']
        response = httpx.post(os.getenv('ORTALAMA_INDEXER', 'http://127.0.0.1:8700') + f"/rounds/{c['roundId']}/attestations/{c['installationId']}", json=job['commit']['attestation'], timeout=120)
        response.raise_for_status()
        return {'simulation': True, 'receipt': job['commit']['receipt']}


@app.post('/jobs/{job_id}/share')
def share(job_id: str, authorization: str = Header(default='')):
    with operation_lock:
        job = job_for(job_id, authorization)
        if not job.get('commit'):
            raise ValueError('CommitBeforeSharing')
        c = job['review']['core']
        envelopes = bridge('reviewedEnvelopes', roundId=c['roundId'], installationId=c['installationId'], reviewDigest=job['review']['reviewDigest'])['envelopes']
        receipts = []
        for index, envelope in enumerate(envelopes, 1):
            response = httpx.post(f"http://127.0.0.1:{int(os.getenv('ORTALAMA_TRUSTEE_BASE_PORT', '8700')) + index}/shares", json={'simulation': True, 'roundId': c['roundId'], 'installationId': c['installationId'], 'envelope': envelope}, timeout=120)
            response.raise_for_status()
            receipts.append(response.json()['receipt'])
        return {'simulation': True, 'receipts': receipts}
