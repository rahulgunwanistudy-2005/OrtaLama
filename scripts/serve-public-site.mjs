/** Serve the built read-only public site with the documented static-host rewrites. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize,resolve,sep} from 'node:path';
import {gzipSync} from 'node:zlib';

const root=resolve(process.argv[2]??'dist/public-site');
const port=Number(process.env.PORT??49310);
const host=process.env.HOST??(process.env.PORT?'0.0.0.0':'127.0.0.1');
await stat(join(root,'SIMULATED_hosting_manifest.json')).catch(()=>{throw new Error('A built public site is required: run node scripts/build-public-site.mjs');});

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const compressible=new Set(['.html','.js','.css','.json','.svg']);
const aliases={'/operator/config':'/operator/config.json','/api/rounds':'/api/rounds.json','/api/deployment':'/api/deployment.json','/api/health':'/api/health.json'};
const reserved=['/api/','/operator/','/assets/','/data/','/images/','/fonts/'];

const isFile=async(path)=>(await stat(path).catch(()=>null))?.isFile()??false;
const resolvePath=async(pathname)=>{
  if(aliases[pathname])return aliases[pathname];
  if(/^\/api\/rounds\/\d+(?:\/evidence)?$/.test(pathname))return pathname+'.json';
  // Application routes fall back to the SPA; unknown API or asset requests stay 404.
  if(!reserved.some(prefix=>pathname.startsWith(prefix))&&!(await isFile(join(root,pathname))))return '/index.html';
  return pathname;
};

createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'}).end('ok');return;}
  const file=normalize(join(root,await resolvePath(pathname)));
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(!(await isFile(file))){res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');return;}
  const ext=extname(file);
  let body=await readFile(file);
  const headers={'Content-Type':types[ext]??'application/octet-stream','Cache-Control':file.includes(sep+'assets'+sep)?'public, max-age=31536000, immutable':'no-cache'};
  if(compressible.has(ext)&&/\bgzip\b/.test(req.headers['accept-encoding']??'')){body=gzipSync(body);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
  headers['Content-Length']=body.length;
  res.writeHead(200,headers);
  res.end(req.method==='HEAD'?undefined:body);
}).listen(port,host,()=>console.log(`Public verification site: http://${host}:${port}`));
