import { useEffect, useRef, useState } from "react";
import { db } from "../lib/db";
const fmt = (ms)=> new Date(ms).toLocaleString();
const toTags = (s)=> s.split(",").map(t=>t.trim()).filter(Boolean);

export default function DiaryApp(){
  const [entries,setEntries]=useState([]), [q,setQ]=useState(""), [tagQ,setTagQ]=useState(""),
        [title,setTitle]=useState(""), [body,setBody]=useState(""), [tags,setTags]=useState(""),
        [selectedId,setSelectedId]=useState(null); const fileRef=useRef(null);

  const refresh=async()=> setEntries(await db.entries.orderBy("createdAt").reverse().toArray());
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{const h=setTimeout(async()=>{ if(!title && !body) return; if(selectedId){ await db.entries.update(selectedId,{title,body,tags:toTags(tags),updatedAt:Date.now()}); refresh();}},500); return()=>clearTimeout(h);},[title,body,tags,selectedId]);

  async function createNew(){ const id=await db.entries.add({createdAt:Date.now(),updatedAt:Date.now(),title:title||"Untitled",body:body||"",tags:toTags(tags)}); setSelectedId(id); refresh(); }
  function selectEntry(e){ setSelectedId(e.id); setTitle(e.title); setBody(e.body); setTags((e.tags||[]).join(", ")); }
  async function save(){ if(!selectedId) return createNew(); await db.entries.update(selectedId,{title,body,tags:toTags(tags),updatedAt:Date.now()}); refresh(); }
  async function del(id){ await db.entries.delete(id); if(selectedId===id){ setSelectedId(null); setTitle(""); setBody(""); setTags(""); } refresh(); }
  const filtered=()=>entries.filter(e=>{ const QQ=q.toLowerCase(), TT=tagQ.toLowerCase(); const mq=!QQ || e.title.toLowerCase().includes(QQ) || e.body.toLowerCase().includes(QQ); const mt=!TT || (e.tags||[]).some(t=>t.toLowerCase().includes(TT)); return mq&&mt; });
  async function exportJSON(){ const dump=await db.entries.toArray(); const blob=new Blob([JSON.stringify({version:1,exportedAt:Date.now(),entries:dump},null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="diary-backup.json"; a.click(); URL.revokeObjectURL(url); }
  async function importJSON(file){ const data=JSON.parse(await file.text()); if(!data.entries) return alert("Invalid file."); await db.transaction("rw",db.entries,async()=>{ for(const e of data.entries){ if(e.id){ const ex=await db.entries.get(e.id); ex? await db.entries.update(e.id,e): await db.entries.add(e);} else { await db.entries.add(e);} } }); refresh(); }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <aside className="card p-4 h-max sticky top-4">
        <input className="input mb-3" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
        <input className="input mb-3" placeholder="Filter by tag…" value={tagQ} onChange={e=>setTagQ(e.target.value)} />
        <button className="btn-primary w-full" onClick={createNew}>New Entry</button>
        <hr className="my-4 border-neutral-800" />
        <div className="max-h-[50vh] overflow-auto pr-1 space-y-2">
          {filtered().map(e=> (
            <button key={e.id} onClick={()=>selectEntry(e)} className={`w-full text-left p-3 rounded-xl border transition ${selectedId===e.id?"border-brand-600 bg-neutral-900":"border-neutral-800 hover:bg-neutral-900"}`}>
              <div className="font-semibold">{e.title||"Untitled"}</div>
              <div className="text-muted text-sm">{fmt(e.updatedAt)}</div>
              {e.tags?.length ? <div className="mt-1 text-xs text-neutral-400">#{e.tags.join(" #")}</div> : null}
            </button>
          ))}
          {!filtered().length && <div className="text-muted text-sm">No entries yet.</div>}
        </div>
      </aside>

      <section className="card p-4 animate-fadeInUp">
        <input className="input text-xl font-semibold mb-3" placeholder="Title…" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea className="input min-h-[40vh] mb-3" placeholder="Write your thoughts…" value={body} onChange={e=>setBody(e.target.value)} />
        <input className="input mb-3" placeholder="tags, comma,separated" value={tags} onChange={e=>setTags(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={save}>Save</button>
          {selectedId && <button className="btn-ghost" onClick={()=>del(selectedId)}>Delete</button>}
          <button className="btn-ghost" onClick={exportJSON}>Export</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={e=>e.target.files[0]&&importJSON(e.target.files[0])} />
          <button className="btn-ghost" onClick={()=>fileRef.current?.click()}>Import</button>
        </div>
        <p className="text-xs text-neutral-500 mt-2">Autosaves every ~0.5s when editing an existing note.</p>
      </section>
    </div>
  );
}
