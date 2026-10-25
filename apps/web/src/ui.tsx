import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

export const publicEvidence=import.meta.env.VITE_PUBLIC_EVIDENCE==='1';
const Language=createContext<{lang:string,t:(en:string,tr:string)=>string,setLang:(s:string)=>void}>({lang:'en',t:(e)=>e,setLang:()=>{}});
export function LanguageProvider({children}:{children:ReactNode}){
  const [lang,set]=useState(localStorage.getItem('ortalama-language')??'en');
  const setLang=(v:string)=>{set(v);localStorage.setItem('ortalama-language',v);};
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  return <Language.Provider value={{lang,t:(e,tr)=>lang==='tr'?tr:e,setLang}}>{children}</Language.Provider>;
}
export const useLanguage=()=>useContext(Language);
export async function request(path:string,body?:any,token?:string){
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body,(_,v)=>typeof v==='bigint'?String(v):v)});
  const text=await response.text();let data:any;
  try{data=JSON.parse(text);}catch{throw new Error(`Service response ${response.status}`);}
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:`Request rejected (${response.status})`);
  return data;
}
export const useConfig=()=>useQuery({queryKey:['config'],queryFn:()=>request('/operator/config'),staleTime:60_000,retry:1,refetchInterval:query=>query.state.data?.seedStatus==='SEEDING'?10_000:false});
export const useRounds=()=>useQuery({queryKey:['rounds'],queryFn:()=>request('/api/rounds'),refetchInterval:publicEvidence?false:3000,retry:1});
export const useRound=(id:string)=>useQuery({queryKey:['round',id],queryFn:()=>request(`/api/rounds/${id}`),enabled:/^[1-9][0-9]*$/.test(id),refetchInterval:publicEvidence?false:1800,retry:1});
export const short=(s:string)=>s?`${s.slice(0,10)}…${s.slice(-6)}`:'';
export function ppm(value:any,digits=6){const n=BigInt(value??0);return `${n/1_000_000n}.${(n%1_000_000n).toString().padStart(6,'0').slice(0,digits)}`;}
export function State({state}:{state:number}){const {t}=useLanguage();const en=['Draft','Open','Sharing','Closing','Closed','Aborted'],tr=['Taslak','Açık','Paylaşım','Kapanış','Kapalı','İptal'];return <span className={`state state-${state}`}>{t(en[state]??'Unknown',tr[state]??'Bilinmiyor')}</span>;}
export function PageTitle({title,children}:{title:string,children?:ReactNode}){return <header className="page-title"><h1>{title}</h1>{children&&<p>{children}</p>}</header>;}
export function Notice({children,error=false}:{children:ReactNode,error?:boolean}){return <div className={`notice ${error?'error':''}`} role={error?'alert':'status'}>{children}</div>;}
export function Loading(){const {t}=useLanguage();return <p className="loading" role="status">{t('Reading the running system…','Çalışan sistem okunuyor…')}</p>;}
export function Hash({value,label}:{value:string,label?:string}){return <details className="hash"><summary>{label??short(value)}</summary><code>{value}</code></details>;}
export function Receipt({value}:{value:any}){const {t}=useLanguage();return <div className="receipt"><span>{value.status==='reverted'?t('Reverted transaction','Reddedilen işlem'):t('Mined transaction','Zincire yazılan işlem')}</span><Hash value={value.hash}/>{value.error&&<strong>{value.error}</strong>}</div>;}
export function Cohort({snapshot,plants=[]}:{snapshot?:any,plants?:any[]}){
  const {t}=useLanguage(),committed=new Map<string,any>((snapshot?.plants??[]).map((p:any)=>[p.installationId,p]));
  const members=plants.length?plants:(snapshot?.plants??[]).map((p:any,i:number)=>({...p,label:`${t('Installation','Tesis')} ${i+1}`}));
  return <div className={`cohort ${Number(snapshot?.round.state)===4?'cohort-closed':''}`} aria-label={t('Sealed cohort commitments','Mühürlü grup taahhütleri')}>
    {members.map((p:any,i:number)=>{const c=committed.get(p.installationId),point=c?.statement.CE;const seed=point?BigInt(point.x):0n;const dots=Array.from({length:8},(_,n)=>({x:23+Number((seed>>BigInt(n*7))&63n)*.8,y:22+Number((seed>>BigInt(n*7+3))&31n)*.7}));return <figure key={p.installationId} className={`envelope ${c?'sealed':'unsealed'}`} style={{'--fold':`${(i%4)-1.5}`} as any}>
      <svg viewBox="0 0 100 76" role="img" aria-label={`${p.label}: ${c?t('sealed commitment','mühürlü taahhüt'):t('awaiting commitment','taahhüt bekleniyor')}`}><path d="M5 9H95V67H5Z M5 9L50 42L95 9 M5 67L37 35 M95 67L63 35"/>{c&&<g className="constellation">{dots.map((d,n)=><circle key={n} cx={d.x} cy={d.y} r={n===0?2.4:1.3}/>)}</g>}</svg>
      <figcaption><span>{p.label.replace('SIMULATED ','')}</span><small>{c?short(p.installationId):t('Awaiting seal','Mühür bekleniyor')}</small></figcaption>
    </figure>;})}
  </div>;
}
export function Result({snapshot}:{snapshot:any}){const {t}=useLanguage(),r=snapshot.round;return <section className="result" aria-label={t('Published aggregate','Yayımlanan toplam')}>
  <p>{t('Published intensity','Yayımlanan yoğunluk')}</p><a className="measurement" href={`/verify/${snapshot.roundId}`}>{ppm(r.intensity)}</a><p>kg CO₂ / kg {t('product','ürün')}</p>
  <dl><div><dt>{t('Committed installations','Taahhüt veren tesis')}</dt><dd><a href={`/round/${snapshot.roundId}#chain-state`}>{String(r.n)}</a></dd></div><div><dt>{t('Declared-denominator coverage','Beyan edilen toplamın kapsamı')}</dt><dd><a href={`/round/${snapshot.roundId}#chain-state`}>{ppm(BigInt(r.coveragePpm)*100n,2)}%</a></dd></div></dl>
  <p className="small">{t('Indexed chain result. Recompute it independently before relying on it.','Dizinden alınan zincir sonucu. Kullanmadan önce bağımsız olarak yeniden hesaplayın.')}</p><a className="button" href={`/verify/${snapshot.roundId}`}>{t('Verify in this browser','Bu tarayıcıda doğrula')}</a>
</section>;}
export function QR({path}:{path:string}){const {t}=useLanguage(),[url,set]=useState('');const full=new URL(path,location.origin).href;useEffect(()=>{let active=true;import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(full,{width:220,margin:2,color:{dark:'#243330',light:'#ffffff'}})).then(value=>{if(active)set(value);});return()=>{active=false;};},[full]);return <figure className="qr">{url&&<img src={url} width="220" height="220" alt={t('QR code for this verification link','Bu doğrulama bağlantısının QR kodu')}/>}<figcaption><a href={path}>{t('Open independent verification','Bağımsız doğrulamayı aç')}</a><small>{publicEvidence?t('Scan this public link to recompute the Monad testnet evidence.','Monad test ağı kanıtını yeniden hesaplamak için bu herkese açık bağlantıyı tarayın.'):t('Local links need access to this machine. Public testnet hosting is pending.','Yerel bağlantılar bu bilgisayara erişim gerektirir. Herkese açık test ağı yayını bekleniyor.')}</small></figcaption></figure>;}
export function runWorker(worker:Worker,input:any,onProgress:(m:string)=>void):Promise<any>{return new Promise((resolve,reject)=>{worker.onmessage=(event)=>{if(event.data.type==='progress')onProgress(event.data.message);else{worker.terminate();event.data.type==='result'?resolve(event.data.value):reject(new Error(event.data.message));}};worker.onerror=(e)=>{worker.terminate();reject(new Error(e.message));};worker.postMessage(input);});}
