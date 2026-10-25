import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const at=(p:string)=>path.resolve(import.meta.dirname,'../..',p);
const proxies:Record<string,any>={
  '/rpc':{target:process.env.ORTALAMA_RPC??'http://127.0.0.1:8547',changeOrigin:true,rewrite:()=>'/'} ,
  '/api':{target:process.env.ORTALAMA_INDEXER??'http://127.0.0.1:8700',rewrite:(p:string)=>p.replace(/^\/api/,'')},
  '/operator':{target:process.env.ORTALAMA_OPERATOR??'http://127.0.0.1:8710',rewrite:(p:string)=>p.replace(/^\/operator/,'')},
  '/agent-api':{target:process.env.ORTALAMA_AGENT??'http://127.0.0.1:8720',rewrite:(p:string)=>p.replace(/^\/agent-api/,'')},
};
for(let i=1;i<=3;i++)proxies[`/trustee-api/${i}`]={target:`http://127.0.0.1:${Number(process.env.ORTALAMA_TRUSTEE_BASE_PORT??8700)+i}`,rewrite:(p:string)=>p.replace(new RegExp(`^/trustee-api/${i}`),'')};
export default defineConfig({plugins:[react()],resolve:{alias:[{find:/^circomlibjs$/,replacement:at('apps/web/src/circom-primitives.ts')}]},server:{host:'127.0.0.1',proxy:proxies,fs:{allow:[at('apps/web'),at('packages'),at('node_modules')],deny:['**/.runtime/**','**/.tools/**','**/.git/**','**/.env*','**/*secret*']}},preview:{host:'127.0.0.1',proxy:proxies},worker:{format:'es'},build:{target:'es2022',chunkSizeWarningLimit:1500}});
