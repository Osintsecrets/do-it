import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../lib/db";
import Fuse from "fuse.js";
import { marked } from "marked";
import { encryptJSON, decryptJSON } from "../lib/crypto";

const fmt = (ms)=> new Date(ms).toLocaleString();
const toTags = (s)=> s.split(",").map(t=>t.trim()).filter(Boolean);

export default function DiaryApp(){
  const [entries,setEntries]=useState([]), [q,setQ]=useState(""),
        [title,setTitle]=useState(""), [body,setBody]=useState(""),
        [tags,setTags]=useState(""), [selected,setSelected]=useState(null),
        [filter,setFilter]=useState("all"), [pass,setPass]=useState(""), [encOn,setEncOn]=useState(false);
  const fileRef=useRef(null), dropRef=useRef(null);

  const refresh=async()=> setEntries(await db.entries.orderBy("createdAt").reverse().toArray());
  useEffect(()=>{ refresh(); },[]);
  useEffect(()=>{ const h=setTimeout(async()=>{ if(selected){ await db.entries.update(selected.id,{title,body,tags:toTags(tags),updatedAt:Date.now()}); refresh(); } },450); return()=>clearTimeout(h);},[title,body,tags,selected]);

  const fuse = useMemo(()=> new Fuse(entries, { keys:["title","body","tags"], threshold:0.33 }), [entries]);
  const list = useMemo(()=>{
    let base = filter==="all"? entries : entries.filter(e=> filter==="pinned" ? e.pinned : filter==="archived" ? e.archived : filter==="trash" ? e.trashed : true);
    if(q.trim()) base = fuse.search(q).map(r=>r.item);
    return base;
  }, [entries,q,filter,fuse]);

  async function createNew(){ const id=await db.entries.add({createdAt:Date.now(),updatedAt:Date.now(),title:title||"Untitled",body:body||"",tags:toTags(tags),pinned:false,archived:false,trashed:false}); const e=await db.entries.get(id); setSelected(e); refresh(); }
  async function select(e){ setSelected(e); setTitle(e.title); setBody(e.body); setTags((e.tags||[]).join(", ")); }
  async function save(){ if(!selected) return createNew(); await db.entries.update(selected.id,{title,body,tags:toTags(tags),updatedAt:Date.now()}); refresh(); }
  async function toggle(id,field){ const v = await db.entries.get(id); await db.entries.update(id,{[field]:!v[field]}); if(selected?.id===id) setSelected({...v,[field]:!v[field]}); refresh(); }
  async function del(id){ await db.entries.update(id,{trashed:true}); if(selected?.id===id) setSelected(null); refresh(); }
  async function hardDel(id){ await db.entries.delete(id); refresh(); }
  async function restore(id){ await db.entries.update(id,{trashed:false}); refresh(); }

  // Attachments
  async function addFiles(files){
    if(!selected){ await createNew(); }
    const entryId = selected?.id || (await db.entries.orderBy("id").last()).id;
    for(const f of files){ const data = await f.arrayBuffer(); await db.attachments.add({ entryId, name:f.name, type:f.type, size:f.size, createdAt:Date.now(), data:new Blob([data],{type:f.type}) }); }
    refresh();
  }
  useEffect(()=>{ const el=dropRef.current; if(!el) return;
    const stop=e=>{e.preventDefault(); e.stopPropagation();};
    const onDrop=e=>{ stop(e); addFiles(e.dataTransfer.files); };
    ["dragenter","dragover","dragleave","drop"].forEach(ev=> el.addEventListener(ev, stop));
    el.addEventListener("drop", onDrop); return ()=>{ ["dragenter","dragover","dragleave","drop"].forEach(ev=> el.removeEventListener(ev, stop)); el.removeEventListener("drop", onDrop); };
  },[selected]);

  // Export / Import
  async function exportJSON(){
    const dump = await db.entries.toArray();
    const atts = await db.attachments.toArray();
    const blob = new Blob([JSON.stringify({v:2, exportedAt:Date.now(), entries:dump, attachmentsMeta: atts.map(a=>({id:a.id,entryId:a.entryId,name:a.name,type:a.type,size:a.size,createdAt:a.createdAt}))},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="diary.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function exportZIP(){
    const { default: JSZip } = await import("jszip"); const zip = new JSZip();
    const dump = await db.entries.toArray(); zip.file("entries.json", JSON.stringify(dump,null,2));
    const atts = await db.attachments.toArray(); const folder = zip.folder("attachments");
    for(const a of atts){ const buffer = await a.data.arrayBuffer(); folder.file(`${a.id}-${a.name}`, buffer); }
    const blob = await zip.generateAsync({type:"blob"}); const url = URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download="diary.zip"; link.click(); URL.revokeObjectURL(url);
  }
  async function importJSON(file){
    const text = await file.text(); const data = JSON.parse(text);
    if(!data.entries && !data.v) return alert("Invalid file.");
    await db.transaction("rw", db.entries, db.attachments, async ()=>{
      if(data.entries){ for(const e of data.entries){ e.id ? (await db.entries.put(e)) : (await db.entries.add(e)); } }
    });
    refresh();
  }

  // Encryption
  async function encryptSelected(){
    if(!selected) return; if(!pass) return alert("Set a passphrase first in the bar below.");
    const payload = await encryptJSON(pass, { title, body, tags: toTags(tags) });
    await db.entries.update(selected.id, { body: JSON.stringify(payload), title: "(Encrypted)", tags: [], enc: true, updatedAt: Date.now() });
    setBody("(Encrypted)"); setTitle("(Encrypted)"); setTags(""); refresh();
  }
  async function decryptSelected(){
    if(!selected || !selected.enc) return; if(!pass) return alert("Enter passphrase.");
    try{
      const payload = await decryptJSON(pass, JSON.parse(selected.body));
      setTitle(payload.title); setBody(payload.body); setTags((payload.tags||[]).join(", "));
      await db.entries.update(selected.id, { enc:false, title: payload.title, body: payload.body, tags: payload.tags||[] });
      refresh();
    }catch{ alert("Bad passphrase."); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      {/* Sidebar */}
      <aside className="card p-4 h-max sticky top-4">
        <div className="flex gap-2 mb-3">
          <input className="input" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 mb-3">
          {["all","pinned","archived","trash"].map(f=>(
            <button key={f} className={`btn-ghost text-sm ${filter===f?"ring-2 ring-neon-cyan":""}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
        <button className="btn-primary w-full mb-3" onClick={createNew}>New Entry</button>
        <div className="max-h-[50vh] overflow-auto pr-1 space-y-2">
          {list.map(e=>(
            <div key={e.id} className={`p-3 rounded-2xl border ${selected?.id===e.id?"border-white/30 bg-white/10":"border-white/10 hover:bg-white/5"}`}>
              <button className="w-full text-left" onClick={()=>select(e)}>
                <div className="font-semibold">{e.title||"Untitled"}</div>
                <div className="text-neutral-400 text-xs">{fmt(e.updatedAt)}</div>
                {!!e.tags?.length && <div className="mt-1 text-xs text-neutral-300">#{e.tags.join(" #")}</div>}
              </button>
              <div className="flex gap-2 mt-2">
                <button className="btn-ghost text-xs" onClick={()=>toggle(e.id,"pinned")}>{e.pinned?"Unpin":"Pin"}</button>
                <button className="btn-ghost text-xs" onClick={()=>toggle(e.id,"archived")}>{e.archived?"Unarchive":"Archive"}</button>
                {!e.trashed ? <button className="btn-ghost text-xs" onClick={()=>del(e.id)}>Trash</button> : <>
                  <button className="btn-ghost text-xs" onClick={()=>restore(e.id)}>Restore</button>
                  <button className="btn-ghost text-xs" onClick={()=>hardDel(e.id)}>Delete</button>
                </>}
              </div>
            </div>
          ))}
          {!list.length && <div className="text-neutral-400 text-sm">No entries.</div>}
        </div>
      </aside>

      {/* Editor */}
      <section className="card p-4 animate-fadeUp" ref={dropRef}>
        <div className="grid gap-3">
          <input className="input text-xl font-semibold" placeholder="Title…" value={title} onChange={e=>setTitle(e.target.value)} />
          <div className="grid md:grid-cols-2 gap-3">
            <textarea className="input min-h-[40vh]" placeholder="Write in **Markdown**…" value={body} onChange={e=>setBody(e.target.value)} />
            <div className="input min-h-[40vh] overflow-auto prose prose-invert" dangerouslySetInnerHTML={{__html: marked.parse(body || "")}} />
          </div>
          <input className="input" placeholder="tags, comma,separated" value={tags} onChange={e=>setTags(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={save}>Save</button>
            {selected && <>
              <button className="btn-ghost" onClick={()=>toggle(selected.id,"pinned")}>{selected.pinned?"Unpin":"Pin"}</button>
              <button className="btn-ghost" onClick={()=>toggle(selected.id,"archived")}>{selected.archived?"Unarchive":"Archive"}</button>
              <button className="btn-ghost" onClick={()=>del(selected.id)}>Trash</button>
            </>}
            <button className="btn-ghost" onClick={exportJSON}>Export JSON</button>
            <button className="btn-ghost" onClick={exportZIP}>Export ZIP</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={e=>e.target.files[0]&&importJSON(e.target.files[0])} />
            <button className="btn-ghost" onClick={()=>fileRef.current?.click()}>Import JSON</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <input className="input w-auto" placeholder="passphrase (optional)" value={pass} onChange={e=>setPass(e.target.value)} />
            <button className="btn-ghost" onClick={()=>setEncOn(!encOn)}>{encOn?"Encryption: ON":"Encryption: OFF"}</button>
            {selected && !selected.enc && encOn && <button className="btn-ghost" onClick={encryptSelected}>Encrypt note</button>}
            {selected?.enc && <button className="btn-ghost" onClick={decryptSelected}>Decrypt note</button>}
            <span className="text-neutral-400 text-xs">Drag files here to attach</span>
          </div>
        </div>
      </section>
    </div>
  );
}
