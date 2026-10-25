import React,{Suspense,lazy,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LanguageProvider,useLanguage,Loading,Notice,publicEvidence} from './ui';
import {BrandMark,NavIcon,ArrowIcon} from './visuals';
import './style.css';
import Home from './pages/Home';
const PublicAttacks=lazy(()=>import('./pages/PublicAttacks'));
const Live=lazy(()=>import('./pages/Live'));
const Plant=lazy(()=>import('./pages/Plant'));
import Verify from './pages/Verify';
const Evidence=lazy(()=>import('./pages/Evidence'));
const Roles=lazy(()=>import('./pages/Roles'));
const queryClient=new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
function App(){const {lang,t,setLang}=useLanguage(),[menu,setMenu]=useState(false);const path=location.pathname,part=path.split('/')[1],id=path.split('/')[2]??'';
 const links=publicEvidence?[["/",t('The problem','Sorun')],["/verify",t('Verify testnet rounds','Test ağı turlarını doğrula')],["/calculator",t('Default calculator','Varsayılan değer hesabı')],["/methodology",t('Methodology & sources','Yöntem ve kaynaklar')],["/attack",t('Attack evidence','Saldırı kanıtı')]]:[['/',t('The problem','Sorun')],['/live',t('Live round','Canlı tur')],['/plant',t('Plant agent','Tesis asistanı')],['/verifier',t('Verifier desk','Doğrulayıcı masası')],['/trustee/1',t('Trustee nodes','Emanetçi düğümleri')],['/attack',t('Attack console','Saldırı konsolu')],['/calculator',t('Default calculator','Varsayılan değer hesabı')],['/methodology',t('Methodology & sources','Yöntem ve kaynaklar')]];
 const activeIndex=publicEvidence?(['verify','round','badge','dossier'].includes(part!)?1:links.findIndex(([url])=>url===path)):part==='trustee'?4:part==='verify'?3:['round','badge','dossier'].includes(part!)?1:links.findIndex(([url])=>url===path);
 const currentLabel=links[activeIndex]?.[1]??t('Public record','Kamusal kayıt');
 let page=publicEvidence&&part==='attack'?<PublicAttacks/>:part===''?<Home/>:part==='live'?<Live/>:part==='plant'?<Plant/>:part==='verify'?<Verify id={id}/>:['round','badge','dossier','calculator','methodology'].includes(part!)?<Evidence kind={part!} id={id}/>:<Roles kind={part!} id={id}/>;
 if(publicEvidence&&!['','verify','round','badge','dossier','calculator','methodology','attack'].includes(part??''))page=<Notice>{t('Participant controls run in the private operator workspace. This public site reads Monad testnet evidence.','Katılımcı kontrolleri özel operatör çalışma alanında çalışır. Bu herkese açık site Monad test ağı kanıtını okur.')} <a href="/verify">{t('Verify a round','Bir turu doğrula')}</a></Notice>;
 return <><a className="skip" href="#main">{t('Skip to content','İçeriğe geç')}</a>
 <header className="topbar"><a className="brand" href="/"><BrandMark/><span className="brand-wordmark">OrtaLama<span>{t('Public emissions register','Kamusal emisyon kaydı')}</span></span></a>
 <div className="header-context"><span className="status-dot"/>{t('Sealed inputs. Public evidence.','Mühürlü girdiler. Kamusal kanıt.')}</div>
 <div className="top-actions"><span className="simulation"><span/>{publicEvidence?'MONAD TESTNET · SIMULATED':'SIMULATED'}</span><button className="language" onClick={()=>setLang(lang==='en'?'tr':'en')} aria-label={t('TR — Switch to Turkish','EN — İngilizceye geç')}>{lang==='en'?'TR':'EN'}</button><a className="header-cta" href={publicEvidence?'/verify':'/live'}>{publicEvidence?t('Verify testnet','Test ağını doğrula'):t('Open workspace','Çalışma alanını aç')}<ArrowIcon diagonal/></a><button className="menu" aria-expanded={menu} aria-controls="navigation" onClick={()=>setMenu(!menu)}>{menu?t('Close','Kapat'):t('Menu','Menü')}<span aria-hidden="true">{menu?'×':'☰'}</span></button></div></header>
 <div className="app-layout"><aside className={menu?'nav-open':''} id="navigation"><div className="nav-heading">{t('Workspace','Çalışma alanı')}</div><nav aria-label={t('Main navigation','Ana gezinme')}>{links.map(([url,label],index)=><a key={url} href={url} aria-current={path===url||(part==='trustee'&&index===4)?'page':undefined}><NavIcon index={url==='/'?0:url==='/live'?1:url==='/plant'?2:['/verifier','/verify'].includes(url!)?3:url?.startsWith('/trustee')?4:url==='/attack'?5:url==='/calculator'?6:7}/><span>{label}</span>{activeIndex===index&&<span className="nav-active-dot" aria-hidden="true"/>}</a>)}</nav>
 <div className="nav-bottom"><div className="nav-emblem" aria-hidden="true"><BrandMark/><span>CO₂</span></div><p className="nav-note">{t('Real cryptography. Synthetic reports, actors and keys.','Gerçek kriptografi. Sentetik raporlar, aktörler ve anahtarlar.')}</p><a className="nav-limits" href="/methodology#limits">{t('Limits of this prototype','Prototipin sınırları')}<ArrowIcon diagonal/></a></div></aside>
 <main id="main" tabIndex={-1} className={part===''?'home-page':'workspace-page'}><div className="context-bar"><span>{t('Register','Kayıt')}<span className="context-divider">/</span><strong>{currentLabel}</strong></span><span className="context-meta">{t('Confidential aggregation protocol','Gizli toplama protokolü')}</span></div><div className="page-content"><Suspense fallback={<Loading/>}>{page}</Suspense></div><footer><a className="footer-brand" href="/"><BrandMark/>OrtaLama</a><p>{t('Evidence of arithmetic, not a claim of regulatory acceptance.','Aritmetik kanıtı; düzenleyici kabul iddiası değildir.')}</p><a href="/methodology#sources">{t('Source register','Kaynak kaydı')}<ArrowIcon diagonal/></a></footer></main></div></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><LanguageProvider><App/></LanguageProvider></QueryClientProvider>);
