"""Actual browser Groth16 generation/verification on SIMULATED fixtures."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    options = {"headless": True}
    if Path('/Applications/Google Chrome.app').exists():
        options['channel'] = 'chrome'
    browser = p.chromium.launch(**options)
    try:
        page = browser.new_page()
        page.set_default_timeout(180_000)
        page.goto('http://127.0.0.1:8791')
        page.wait_for_load_state('networkidle')
        assert page.get_by_role('heading', name='SIMULATED proof benchmark').count() == 1
        page.add_script_tag(url='/node_modules/snarkjs/build/snarkjs.min.js')
        results = page.evaluate('''async () => {
          globalThis.curve_bn128 = await snarkjs.curves.getCurveFromName('bn128', { singleThread: true });
          const fixtures = await (await fetch('/circuits/ceremony/SIMULATED_benchmark_inputs.json')).json();
          if (!fixtures.simulation) throw new Error('Unlabelled test inputs');
          const results = [];
          for (const name of ['below_threshold', 'commitment_validity']) {
            const vk = await (await fetch(`/circuits/ceremony/${name}_verification_key.json`)).json();
            const start = performance.now();
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(fixtures[name], `/circuits/build/${name}_js/${name}.wasm`, `/circuits/ceremony/${name}_final.zkey`, undefined, undefined, { singleThread: true });
            const provingMs = performance.now() - start;
            if (!await snarkjs.groth16.verify(vk, publicSignals, proof)) throw new Error('Browser proof invalid');
            const replay = [...publicSignals]; replay[6] = (BigInt(replay[6]) + 1n).toString();
            if (await snarkjs.groth16.verify(vk, replay, proof)) throw new Error('Browser accepted altered public input');
            results.push({name, browserProvingMs: Number(provingMs.toFixed(2)), verified: true, mutationRejected: true});
          }
          return results;
        }''')
        report = {"simulation": True, "browser": browser.version, "measurements": results}
        Path('docs/SIMULATED_BROWSER_PROOF_RESULTS.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report))
    finally:
        browser.close()
