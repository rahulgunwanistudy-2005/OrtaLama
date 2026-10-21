import { writeFile } from 'node:fs/promises';
import { createCrypto } from '../packages/crypto-ts/src/index.js';
const c = await createCrypto();
const record = { protocol: 'ORTALAMA_PEDERSEN_H_v1', q: c.q, l: c.l, G: c.G, ...c.derivation };
const json = JSON.stringify(record, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n';
await writeFile('packages/crypto-ts/H.json', json);
console.log(json);
