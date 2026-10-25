"""An officer explicitly accepts the deterministic result and each override."""
import re
import secrets
from .engine import digest


def prepare_review(analysis, officer_name, officer_address, round_id, installation_id, deployment, overrides, acknowledgements, approval_kind='HUMAN_REVIEW'):
    if not analysis['simulation'] or not analysis['calculation']:
        raise ValueError('CorrectReportBeforeReview')
    if not 2 <= len(officer_name.strip()) <= 80 or not re.fullmatch(r'0x[0-9a-fA-F]{40}', officer_address):
        raise ValueError('NamedOfficerRequired')
    if approval_kind not in ['HUMAN_REVIEW', 'AUTOMATED_TEST_SIGNATURE']:
        raise ValueError('UnknownApprovalKind')
    fails = {r['id'] for r in analysis['rules'] if r['status'] == 'FAIL'}
    reviews = {r['id'] for r in analysis['rules'] if r['status'] == 'REVIEW'}
    if 'R01' in fails:
        raise ValueError('CircuitBoundsCannotBeOverridden')
    if set(overrides) != fails or any(not isinstance(v, str) or not 20 <= len(v.strip()) <= 2000 for v in overrides.values()):
        raise ValueError('EveryFailureRequiresWrittenOverride')
    if set(acknowledgements) != reviews:
        raise ValueError('EveryReviewFlagRequiresAcknowledgement')
    core = {'simulation': True, 'approvalKind': approval_kind, 'officerName': officer_name.strip(), 'officerAddress': officer_address.lower(), 'chainId': deployment['chainId'], 'contractAddress': deployment['round'].lower(), 'roundId': str(round_id), 'installationId': installation_id, 'reportHash': '0x' + analysis['reportHash'], 'analysisHash': digest(analysis), 'constantsHash': analysis['constantsHash'], 'E': analysis['calculation']['E'], 'P': analysis['calculation']['P'], 'overrides': overrides, 'acknowledgements': sorted(acknowledgements), 'reviewNonce': secrets.token_hex(32)}
    return {'core': core, 'reviewDigest': '0x' + digest(core)}
