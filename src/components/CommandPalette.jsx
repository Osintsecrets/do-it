import { useEffect, useRef, useState } from "react";
const actions = [
  { k:"g h", label:"Go Home", href:"./" },
  { k:"g d", label:"Open Diary", href:"./diary" },
  { k:"g t", label:"Open Tools", href:"./tools" },
  { k:"g s", label:"Open Settings", href:"./settings" },
  { k:"g a", label:"Open About", href:"./about" }
];
export default function CommandPalette(){
  const [open,setOpen]=useState(false); const [q,setQ]=useState("");
  const box = useRef(null);
  useEffect(()=>{ const onKey=(e)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); setOpen(v=>!v);} }; window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey);},[]);
  useEffect(()=>{ if(open) box.current?.focus(); },[open]);
  const list = actions.filter(a=>a.label.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <button className="sr-only" onClick={()=>setOpen(true)}>Open command palette</button>
    {open && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4">
      <div className="card w-full max-w-lg p-3">
        <input ref={box} className="input mb-2" placeholder="Type a command…" value={q} onChange={e=>setQ(e.target.value)} />
        <ul className="max-h-[50vh] overflow-auto">
          {list.map(a=>(
            <li key={a.k}><a className="block px-3 py-2 hover:bg-white/10 rounded-xl" href={a.href} onClick={()=>setOpen(false)}>{a.label} <span className="kbd ml-2">{a.k}</span></a></li>
          ))}
          {!list.length && <li className="px-3 py-2 text-sm text-neutral-300">No results</li>}
        </ul>
        <div className="text-right mt-2"><button className="btn-ghost" onClick={()=>setOpen(false)}>Close</button></div>
      </div>
    </div>}
  </>);
}
