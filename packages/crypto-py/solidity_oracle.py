"""Foundry FFI test oracle on SIMULATED public vectors; never production secrets."""
import json
from pathlib import Path
from reference import commit

vectors = json.loads(Path('data/simulated/SIMULATED_cross_language_vectors.json').read_text())
assert vectors['simulation'] is True and len(vectors['vectors']) == 224
coordinates = []
for row in vectors['vectors']:
    coordinates.extend(commit(int(row['value']), int(row['blinding'])))
# Static uint256[448] ABI serialization; all arithmetic is the independent oracle.
print('0x' + ''.join(value.to_bytes(32, 'big').hex() for value in coordinates))
