import {readFile,writeFile,mkdir} from 'node:fs/promises';
const a=JSON.parse(await readFile('contracts/out/OrtalamaRound.sol/OrtalamaRound.json','utf8')).abi;
const b=JSON.parse(await readFile('contracts/out/BadgeRegistry.sol/BadgeRegistry.json','utf8')).abi;
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const decimal={type:'string',pattern:'^(0|[1-9][0-9]{0,77})$'};
const hex=n=>({type:'string',pattern:`^0x[0-9a-fA-F]{${n*2}}$`});
function abiSchema(p){
 const array=/^(.*)\[([0-9]*)\]$/.exec(p.type);
 if(array)return {type:'array',items:abiSchema({...p,type:array[1]}),...(array[2]?{minItems:Number(array[2]),maxItems:Number(array[2])}:{maxItems:256})};
 if(p.type==='tuple')return object(Object.fromEntries(p.components.map(c=>[c.name,abiSchema(c)])));
 if(p.type==='address')return hex(20);
 if(p.type==='bool')return {type:'boolean'};
 if(/^bytes\d+$/.test(p.type))return hex(Number(p.type.slice(5)));
 if(p.type==='bytes')return {type:'string',pattern:'^0x([0-9a-fA-F]{2})*$'};
 if(/^uint/.test(p.type)){const bits=Number(p.type.slice(4)||256);return bits<=48?{type:'integer',minimum:0,maximum:2**bits-1}:decimal;}
 throw new Error(`Unsupported dossier ABI type: ${p.type}`);
}
const getter=name=>a.find(x=>x.type==='function'&&x.name===name).outputs[0];
const plant=abiSchema(getter('getPlant'));plant.properties.installationId=hex(32);plant.required.push('installationId');
const sum=abiSchema(getter('getSum'));sum.properties.index={type:'integer',minimum:1,maximum:3};sum.required.push('index');
const snapshot=object({simulation:{const:true},chainId:{enum:[31337,10143]},address:hex(20),roundId:decimal,round:abiSchema(getter('getRound')),plants:{type:'array',minItems:5,maxItems:256,items:plant},sums:{type:'array',minItems:3,maxItems:3,items:sum},block:decimal,blockHash:hex(32)});
const attestation=object({installationId:hex(32),simulation:{const:true},signer:hex(20),publicKey:{type:'string',pattern:'^[0-9a-f]+$',maxLength:6000},ecdsa:hex(65),pqSignature:{type:'string',pattern:'^[0-9a-f]+$',maxLength:10000},pqSignatureHash:hex(32),pqLink:hex(65),verifierProof:{type:'array',maxItems:32,items:hex(32)}});
const events=[...a,...b].filter(x=>x.type==='event').map(event=>object({name:{const:event.name},transactionHash:hex(32),blockNumber:decimal,blockHash:hex(32),logIndex:{type:'integer',minimum:0},address:hex(20),args:object(Object.fromEntries(event.inputs.map(p=>[p.name,abiSchema(p)])))}));
const source=object({id:{type:'string',pattern:'^S[0-9]{2}$'},title:{type:'string',maxLength:300},url:{type:'string',pattern:'^https://',maxLength:1200},accessed_on:{type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'},evidence_class:{type:'string',pattern:'^[A-Z_]+$'},scope:{type:'string',maxLength:2000},retrieved:{type:'boolean'}});
const deployment=object({
 simulation:{const:true},chainId:{enum:[31337,10143]},round:hex(20),badge:hex(20),validity:hex(20),below:hex(20),blockNumber:decimal,
 runtimeCodeHashes:object(Object.fromEntries(['round','badge','validity','below'].map(k=>[k,hex(32)])))
});
const arithmetic=object({
 verified:{const:true},simulation:{const:true},roundId:decimal,manifestHash:hex(32),SE:decimal,SP:decimal,intensity:decimal,
 coveragePpm:decimal,representativePolicyFlag:{type:'boolean'},steps:{type:'array',minItems:5,maxItems:5,items:{type:'string'}}
});
const coSignatures=object({verified:{const:true},ecdsaAndMLDSA65Statements:{type:'integer',minimum:5,maximum:256},keyIdentity:{const:'Round allowlist root'},onChainMLDSAVerification:{const:false}});
const provenance=object({identityAssurance:{const:'SIMULATED_NOT_ACCREDITED'},reportTruth:{const:'NOT_ESTABLISHED'},denominatorAssurance:{const:'SIMULATED_DECLARATION'},privateReportsIncluded:{const:false},privateOpeningsIncluded:{const:false},officialAcceptance:{const:false}});
const payload=object({
 snapshot,attestations:{type:'array',minItems:5,maxItems:256,items:attestation},
 events:{type:'array',maxItems:10000,items:{oneOf:events}},deployment,blockTimestamp:decimal,
 sourceSHA256:{type:'object',minProperties:9,maxProperties:64,additionalProperties:{type:'string',pattern:'^[0-9a-f]{64}$'}},
 sourceRecords:{type:'array',maxItems:100,items:source},provenance,arithmetic,coSignatures,
 limitations:{type:'array',minItems:12,maxItems:12,items:{type:'string'}}
});
const schema={
 $schema:'http://json-schema.org/draft-07/schema#',$id:'urn:ortalama:dossier:v2:simulated',title:'SIMULATED Ortalama public evidence dossier',
 ...object({kind:{const:'SIMULATED_ORTALAMA_EVIDENCE'},version:{const:2},simulation:{const:true},payloadSHA256:hex(32),payload})
};
await mkdir('schemas',{recursive:true});await writeFile('schemas/dossier.schema.json',JSON.stringify(schema,null,2)+'\n');
console.log('Strict public-only dossier schema generated from the actual contract ABIs.');
