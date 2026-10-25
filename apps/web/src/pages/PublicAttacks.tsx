import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {createPublicClient,http} from 'viem';
import {useConfig,useLanguage,request,PageTitle,Notice,Loading,Receipt} from '../ui';

export default function PublicAttacks(){
 const {t}=useLanguage(),config=useConfig(),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const q=useQuery({queryKey:['public-attack-evidence'],enabled:!!config.data,queryFn:async()=>{
  const record=await request('/data/SIMULATED_MONAD_ROUND_RESULTS.json');
  if(record.status!=='PASS'||record.chainId!==10143||record.deployment.toLowerCase()!==config.data.deployment.round.toLowerCase()||record.attacks.length!==6||record.attacks.some((a:any)=>a.status!=='reverted'))throw new Error('Test evidence does not match the selected deployment');
  return record;
 }});
 const verify=async()=>{
  setBusy(true);setError('');setChecked(false);
  try{
   const client=createPublicClient({transport:http(new URL(config.data.rpc,location.origin).href,{retryCount:0})});
   if(await client.getChainId()!==10143)throw new Error('Wrong RPC chain');
   for(const attack of q.data.attacks){
    const receipt=await client.getTransactionReceipt({hash:attack.hash});
    const tx=await client.getTransaction({hash:attack.hash});
    if(receipt.status!=='reverted'||![config.data.deployment.round.toLowerCase(),config.data.deployment.badge.toLowerCase()].includes(tx.to?.toLowerCase()))throw new Error('Unexpected transaction receipt or destination');
   }
   setChecked(true);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 };
 return <><PageTitle title={t('Six attacks. Mined rejections.','Altı saldırı. Zincire yazılmış retler.')}>{t('Actual Monad testnet transactions from the recorded protocol tests. Check their receipts against the selected RPC.','Kayıtlı protokol testlerinden gerçek Monad test ağı işlemleri. Makbuzlarını seçili RPC üzerinden kontrol edin.')}</PageTitle>
 {q.isLoading?<Loading/>:q.error?<Notice error>{t('The test record is not available for this deployment yet.','Bu dağıtım için test kaydı henüz mevcut değil.')}</Notice>:q.data&&<>
 <button onClick={verify} disabled={busy}>{busy?t('Reading receipts…','Makbuzlar okunuyor…'):t('Check all six receipts from Monad','Altı makbuzu Monad üzerinden kontrol et')}</button>
 {checked&&<Notice>{t('All six receipts were independently fetched and show reverted transactions to these deployed contracts.','Altı makbuz da bağımsız olarak alındı ve bu sözleşmelere gönderilen reddedilmiş işlemleri gösteriyor.')}</Notice>}
 {q.data.attacks.map((attack:any)=><section key={attack.id}><h2>{attack.id}. {attack.label}</h2><Receipt value={attack}/><a href={`https://testnet.monadexplorer.com/tx/${attack.hash}`} target="_blank" rel="noreferrer">{t('Open transaction on explorer','İşlemi gezginde aç')}</a>{attack.faultReceipt&&<><p>{t('The fault was recorded in a separate successful transaction.','Hata ayrı ve başarılı bir işlemde kaydedildi.')}</p><Receipt value={attack.faultReceipt}/></>}</section>)}
 <p className="small">{t('Error names are the test runner’s recorded preflight and post-receipt checks. A receipt alone establishes a revert, not its reason. These are synthetic actors and inputs.','Hata adları test çalıştırıcısının kaydettiği işlem öncesi ve makbuz sonrası kontrollerdir. Makbuz tek başına reddi gösterir; nedenini göstermez. Aktörler ve girdiler sentetiktir.')}</p></>}
 {error&&<Notice error>{error}</Notice>}</>;
}
