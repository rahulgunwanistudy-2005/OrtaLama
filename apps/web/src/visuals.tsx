/** Presentation-only artwork. These marks never represent live chain data. */
export function BrandMark(){return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 8 14 2v23L3 31V8Z" fill="currentColor"/><path d="m18 5 11-3v23l-11 6V5Z" fill="currentColor"/><path d="m7 12 18 8M7 18l18-8" stroke="var(--background, #0b0e10)" strokeWidth="2"/></svg>;}

export function ArrowIcon({diagonal=false}:{diagonal?:boolean}){return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal?'M6 18 18 6M6 6h12v12':'M4 12h16m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;}

export function NavIcon({index}:{index:number}){const paths=[
 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z',
 'M3 12h4l3-7 4 14 3-7h4',
 'M3 21V10l6 3V8l6 3V3h4v18H3Zm5-4h1m4 0h1m4 0h1',
 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Zm-4 9 3 3 5-6',
 'M12 5v5m0 0-7 7m7-7 7 7M9 2h6v4H9V2ZM2 17h6v5H2v-5Zm14 0h6v5h-6v-5Z',
 'm13 2-8 12h6l-1 8 9-13h-7l1-7Z',
 'M5 2h14v20H5V2Zm3 4h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1',
 'M4 3h6c2 0 2 2 2 2s0-2 2-2h6v17h-6c-2 0-2 1-2 1s0-1-2-1H4V3Zm8 2v16'
 ];return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[index]} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
