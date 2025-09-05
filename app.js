// Design Playground core — drag, resize, props, layers, export/import
(() => {
  const $ = (q, p=document) => p.querySelector(q);
  const $$ = (q, p=document) => Array.from(p.querySelectorAll(q));
  const stage = $("#stage");
  const palette = $("#palette");
  const layersUl = $("#layers");
  const propsForm = $("#props");
  const gridInput = $("#gridSize");
  const zoomInput = $("#zoom");
  const snapToggle = $("#snapToggle");
  const help = $("#help");
  const fileOpen = $("#fileOpen");

  let grid = parseInt(gridInput.value,10) || 8;
  let zoom = (parseInt(zoomInput.value,10)||100) / 100;
  document.documentElement.style.setProperty("--grid", grid + "px");
  document.documentElement.style.setProperty("--zoom", zoom);

  // State
  let nodes = []; // array of {id,type,x,y,w,h,z,styles, text/src/href}
  let activeId = null;
  const uid = () => "n" + Math.random().toString(36).slice(2,7);

  // Palette render
  function renderPalette(){
    palette.innerHTML = "";
    window.COMPONENTS.forEach(c=>{
      const el = document.createElement("div");
      el.className = "item";
      el.draggable = true;
      el.textContent = c.label;
      const badge = document.createElement("div"); badge.className="badge"; badge.textContent = c.type;
      el.appendChild(badge);
      el.addEventListener("dragstart", e=>{
        e.dataTransfer.setData("application/x-comp", JSON.stringify(c));
      });
      palette.appendChild(el);
    });
  }

  // Stage drag target
  stage.addEventListener("dragover", e=> { e.preventDefault(); });
  stage.addEventListener("drop", e=>{
    e.preventDefault();
    const data = e.dataTransfer.getData("application/x-comp");
    if(!data) return;
    const c = JSON.parse(data);
    const rect = stage.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left)/zoom - c.w/2) / grid) * grid;
    const y = Math.round(((e.clientY - rect.top)/zoom - c.h/2) / grid) * grid;
    createNode(c, x, y);
  });

  // Create node
  function createNode(c, x=20, y=20){
    const id = uid();
    const node = {
      id, type:c.type, x, y, w:c.w, h:c.h, z: (nodes.length ? Math.max(...nodes.map(n=>n.z||1)) + 1 : 1),
      styles: c.styles || {}, text:c.text||"", src:c.src||"", href:c.href||""
    };
    nodes.push(node);
    mountNode(node);
    select(id);
    saveLocal();
  }

  // Mount DOM element
  function mountNode(n){
    let el = document.createElement("div");
    el.className = "node";
    el.dataset.id = n.id;
    el.style.left = n.x+"px"; el.style.top = n.y+"px"; el.style.width = n.w+"px"; el.style.height = n.h+"px"; el.style.zIndex = n.z;
    applyStyles(el, n);

    const content = document.createElement("div");
    content.className = "content";
    if(n.type==="image"){
      el.classList.add("image");
      const img = document.createElement("img"); img.src = n.src || "https://picsum.photos/600/400"; content.appendChild(img);
    } else if (n.type==="button"){
      el.classList.add("button"); content.textContent = n.text || "Button";
    } else if (n.type==="link"){
      el.classList.add("link"); const a = document.createElement("a"); a.href = n.href||"#"; a.textContent = n.text||"Link"; a.target="_blank"; content.appendChild(a);
    } else if (n.type==="input"){
      const input = document.createElement("input"); input.placeholder="Type…"; input.style.width="100%"; input.style.height="100%";
      input.style.color = n.styles.color || "#eaf4ff"; input.style.background = n.styles.bg || "#0e1729"; input.style.border = n.styles.border||"1px solid #ffffff22"; input.style.borderRadius = (n.styles.radius||10)+"px"; input.style.padding = (n.styles.padding||10)+"px";
      content.appendChild(input);
    } else {
      // heading, paragraph, card, badge, etc.
      content.textContent = n.text || n.type;
      if(n.type==="heading") content.style.fontSize = (n.styles.fontSize || 28) + "px";
    }
    el.appendChild(content);

    // resize handles
    ["h-tl","h-tr","h-bl","h-br"].forEach(k=>{
      const h = document.createElement("div"); h.className = `handle ${k}`; el.appendChild(h);
    });

    // events
    el.addEventListener("pointerdown", onNodePointerDown);
    stage.appendChild(el);
    renderLayers();
  }

  function applyStyles(el, n){
    const s = n.styles || {};
    el.style.background = s.bg || el.style.background;
    el.style.border = s.border || "1px solid #ffffff1a";
    el.style.borderRadius = (s.radius ?? 12) + "px";
    el.style.boxShadow = s.shadow || "";
    el.style.color = s.color || "#eaf4ff";
    el.style.fontFamily = s.font || "Inter, ui-sans-serif, system-ui";
    if(s.fontSize) el.style.fontSize = s.fontSize + "px";
    if(s.fontWeight) el.style.fontWeight = s.fontWeight;
    const content = el.querySelector(".content");
    if(content) content.style.padding = (s.padding ?? 12) + "px";
  }

  // Selection
  function select(id){
    activeId = id;
    $$(".node", stage).forEach(el => el.classList.toggle("selected", el.dataset.id===id));
    renderProps();
    renderLayers();
  }
  function clearSelection(){ activeId=null; $$(".node", stage).forEach(el=>el.classList.remove("selected")); renderProps(); renderLayers(); }

  stage.addEventListener("pointerdown", e=>{
    if(e.target === stage){ clearSelection(); }
  });

  // Drag / Resize
  let dragState=null;
  function onNodePointerDown(e){
    const el = e.currentTarget;
    const id = el.dataset.id;
    select(id);
    const n = nodes.find(n=>n.id===id);
    const rect = el.getBoundingClientRect();
    const isHandle = e.target.classList.contains("handle");
    dragState = {
      id, startX: e.clientX, startY: e.clientY,
      origX: n.x, origY: n.y, origW: n.w, origH: n.h,
      mode: isHandle ? e.target.classList[1] : "move"
    };
    el.setPointerCapture(e.pointerId);
    el.addEventListener("pointermove", onNodePointerMove);
    el.addEventListener("pointerup", onNodePointerUp, { once:true });
  }
  function onNodePointerMove(e){
    if(!dragState) return;
    const n = nodes.find(n=>n.id===dragState.id);
    const dx = (e.clientX - dragState.startX)/zoom;
    const dy = (e.clientY - dragState.startY)/zoom;
    if(dragState.mode==="move"){
      let nx = dragState.origX + dx;
      let ny = dragState.origY + dy;
      if(snapToggle.checked){ nx = Math.round(nx/grid)*grid; ny = Math.round(ny/grid)*grid; }
      n.x = Math.max(0, nx); n.y = Math.max(0, ny);
    } else {
      // resize
      let w = dragState.origW, h = dragState.origH, x = dragState.origX, y = dragState.origY;
      if(dragState.mode==="h-br"){ w += dx; h += dy; }
      if(dragState.mode==="h-tr"){ w += dx; h -= dy; y += dy; }
      if(dragState.mode==="h-bl"){ w -= dx; h += dy; x += dx; }
      if(dragState.mode==="h-tl"){ w -= dx; h -= dy; x += dx; y += dy; }
      if(snapToggle.checked){
        x = Math.round(x/grid)*grid; y = Math.round(y/grid)*grid;
        w = Math.max(grid, Math.round(w/grid)*grid); h = Math.max(grid, Math.round(h/grid)*grid);
      }
      n.x = Math.max(0, x); n.y = Math.max(0, y); n.w = Math.max(20, w); n.h = Math.max(20, h);
    }
    updateNodeDom(n);
  }
  function onNodePointerUp(e){
    e.currentTarget.removeEventListener("pointermove", onNodePointerMove);
    dragState=null; saveLocal(); renderProps(); renderLayers();
  }
  function updateNodeDom(n){
    const el = $(`.node[data-id="${n.id}"]`, stage);
    if(!el) return;
    el.style.left = n.x+"px"; el.style.top = n.y+"px"; el.style.width = n.w+"px"; el.style.height = n.h+"px"; el.style.zIndex = n.z;
  }

  // Props panel
  function renderProps(){
    const n = nodes.find(n=>n.id===activeId);
    $$("input[data-prop]", propsForm).forEach(inp => {
      const key = inp.dataset.prop;
      if(!n){
        inp.value = ""; inp.disabled = ["type","id"].includes(key) ? true : false;
        return;
      }
      inp.disabled = false;
      if(key==="type") inp.value = n.type;
      else if(key==="id") inp.value = n.id;
      else if(["x","y","w","h"].includes(key)) inp.value = n[key]??"";
      else if(key==="text") inp.value = n.text ?? "";
      else if(key==="src") inp.value = n.src ?? "";
      else if(key==="href") inp.value = n.href ?? "";
      else {
        const s = n.styles || {};
        if(key==="padding") inp.value = s.padding ?? 12;
        if(key==="radius") inp.value = s.radius ?? 12;
        if(key==="font") inp.value = s.font ?? "Inter, ui-sans-serif, system-ui";
        if(key==="fontSize") inp.value = s.fontSize ?? (n.type==="heading"?28:16);
        if(key==="fontWeight") inp.value = s.fontWeight ?? 600;
        if(key==="color") inp.value = s.color ?? "#eaf4ff";
        if(key==="bg") inp.value = s.bg ?? (n.type==="button" ? "#21d3ee" : "#101b2f99");
        if(key==="border") inp.value = s.border ?? "1px solid #ffffff1a";
        if(key==="shadow") inp.value = s.shadow ?? "";
      }
    });
  }

  propsForm.addEventListener("input",(e)=>{
    const n = nodes.find(n=>n.id===activeId); if(!n) return;
    const key = e.target.dataset.prop; const val = e.target.value;
    if(["x","y","w","h"].includes(key)){ n[key]=parseInt(val||0,10); updateNodeDom(n);}
    else if(key==="text"){ n.text = val; updateContent(n); }
    else if(key==="src"){ n.src = val; updateContent(n); }
    else if(key==="href"){ n.href = val; updateContent(n); }
    else {
      n.styles = n.styles||{};
      if(key==="padding") n.styles.padding = parseInt(val||0,10);
      if(key==="radius") n.styles.radius = parseInt(val||0,10);
      if(key==="font") n.styles.font = val;
      if(key==="fontSize") n.styles.fontSize = parseInt(val||0,10);
      if(key==="fontWeight") n.styles.fontWeight = parseInt(val||0,10);
      if(key==="color") n.styles.color = val;
      if(key==="bg") n.styles.bg = val;
      if(key==="border") n.styles.border = val;
      if(key==="shadow") n.styles.shadow = val;
      applyStyles($(`.node[data-id="${n.id}"]`), n);
      updateContent(n);
    }
    saveLocal(); renderLayers();
  });

  function updateContent(n){
    const el = $(`.node[data-id="${n.id}"]`); if(!el) return;
    const content = $(".content", el);
    if(n.type==="image"){ const img = $("img", content); img.src = n.src || "https://picsum.photos/600/400"; }
    else if(n.type==="link"){ const a = $("a", content); a.textContent=n.text||"Link"; a.href=n.href||"#"; }
    else if(n.type==="input"){ /* nothing */ }
    else { content.textContent = n.text || n.type; if(n.styles?.fontSize) content.style.fontSize = n.styles.fontSize+"px"; }
  }

  // Layers
  function renderLayers(){
    layersUl.innerHTML = "";
    nodes.slice().sort((a,b)=> (b.z||0)-(a.z||0)).forEach(n=>{
      const li = document.createElement("li");
      li.className = (n.id===activeId?"active":"");
      const name = document.createElement("span"); name.textContent = `${n.type} (${n.id})`;
      const controls = document.createElement("span");
      const sel = document.createElement("button"); sel.textContent="✤"; sel.title="Select"; sel.onclick=()=>select(n.id);
      const up = document.createElement("button"); up.textContent="▲"; up.title="Front"; up.onclick=()=>{ n.z=(n.z||1)+1; updateNodeDom(n); saveLocal(); renderLayers(); };
      const dn = document.createElement("button"); dn.textContent="▼"; dn.title="Back"; dn.onclick=()=>{ n.z=Math.max(1,(n.z||1)-1); updateNodeDom(n); saveLocal(); renderLayers(); };
      const del = document.createElement("button"); del.textContent="✖"; del.title="Delete"; del.onclick=()=>removeNode(n.id);
      [sel,up,dn,del].forEach(b=>{ b.style.marginLeft="6px"; b.style.background="#0d1626"; b.style.color="#e1f0ff"; b.style.border="1px solid #ffffff1a"; b.style.borderRadius="8px"; padding=6; b.style.cursor="pointer"; });
      controls.append(sel, up, dn, del);
      li.append(name, controls);
      layersUl.appendChild(li);
    });
  }

  function removeNode(id){
    nodes = nodes.filter(n=>n.id!==id);
    const el = $(`.node[data-id="${id}"]`); el?.remove();
    if(activeId===id) activeId=null;
    renderLayers(); renderProps(); saveLocal();
  }

  // Toolbar
  $("#newDoc").onclick = ()=>{ if(confirm("Clear the canvas?")){ nodes=[]; stage.innerHTML=""; activeId=null; renderLayers(); renderProps(); saveLocal(); } };
  $("#exportJSON").onclick = ()=> download("layout.json", JSON.stringify({v:1, nodes}, null, 2));
  $("#importJSON").onclick = ()=> fileOpen.click();
  fileOpen.onchange = async (e)=>{ const f = e.target.files[0]; if(!f) return; const text = await f.text(); try{
    const data = JSON.parse(text); if(!data.nodes) throw 0;
    nodes = data.nodes; stage.innerHTML=""; nodes.forEach(mountNode); renderLayers(); renderProps(); saveLocal();
  } catch{ alert("Invalid JSON."); } e.target.value=null; };

  $("#exportPNG").onclick = async ()=>{
    const pngStage = stage.cloneNode(true);
    // remove handles before snapshot
    $$(".handle", pngStage).forEach(h=>h.remove());
    await html2canvas(pngStage, {backgroundColor:null, scale:2}).then(canvas=>{
      canvas.toBlob(b=>{
        const url = URL.createObjectURL(b); const a = document.createElement("a");
        a.href = url; a.download = "design.png"; a.click(); URL.revokeObjectURL(url);
      });
    });
  };

  $("#exportHTML").onclick = ()=>{
    const { html, css } = toHTMLCSS(nodes);
    const blob = new Blob([`<!-- HTML -->\n${html}\n\n/* CSS */\n${css}\n`], {type:"text/plain"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download="design.htmlcss.txt"; a.click(); URL.revokeObjectURL(url);
  };

  $("#helpBtn").onclick = ()=> help.showModal();
  $("#helpClose").onclick = ()=> help.close();

  gridInput.oninput = (e)=>{ grid = Math.max(2, parseInt(e.target.value||8,10)); document.documentElement.style.setProperty("--grid", grid+"px"); };
  zoomInput.oninput = (e)=>{ zoom = (parseInt(e.target.value||100,10))/100; document.documentElement.style.setProperty("--zoom", zoom); };

  $("#bringFwd").onclick = ()=>{ const n = nodes.find(n=>n.id===activeId); if(!n) return; n.z=(n.z||1)+1; updateNodeDom(n); saveLocal(); renderLayers(); };
  $("#sendBack").onclick = ()=>{ const n = nodes.find(n=>n.id===activeId); if(!n) return; n.z=Math.max(1,(n.z||1)-1); updateNodeDom(n); saveLocal(); renderLayers(); };
  $("#duplicate").onclick = ()=>{ const n = nodes.find(n=>n.id===activeId); if(!n) return; const copy = JSON.parse(JSON.stringify(n)); copy.id=uid(); copy.x+=16; copy.y+=16; copy.z=(n.z||1)+1; nodes.push(copy); mountNode(copy); select(copy.id); saveLocal(); };
  $("#remove").onclick = ()=>{ if(activeId) removeNode(activeId); };

  // Keyboard shortcuts
  window.addEventListener("keydown", (e)=>{
    const n = nodes.find(n=>n.id===activeId); const step = e.shiftKey ? 10 : 1;
    if(e.key==="Escape"){ clearSelection(); }
    if(!n) return;
    if(e.key==="Delete" || e.key==="Backspace"){ removeNode(n.id); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="d"){ e.preventDefault(); $("#duplicate").click(); }
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){
      e.preventDefault();
      if(e.key==="ArrowUp") n.y = Math.max(0, n.y - step);
      if(e.key==="ArrowDown") n.y = n.y + step;
      if(e.key==="ArrowLeft") n.x = Math.max(0, n.x - step);
      if(e.key==="ArrowRight") n.x = n.x + step;
      if(snapToggle.checked){ n.x = Math.round(n.x/grid)*grid; n.y = Math.round(n.y/grid)*grid; }
      updateNodeDom(n); renderProps(); saveLocal();
    }
  });

  // Persistence
  function saveLocal(){ localStorage.setItem("design-playground", JSON.stringify({v:1,nodes})); }
  function loadLocal(){ try{ const s = JSON.parse(localStorage.getItem("design-playground")||"{}"); if(s.nodes){ nodes=s.nodes; nodes.forEach(mountNode);} }catch{} }

  function download(name, text){ const url = URL.createObjectURL(new Blob([text], {type:"application/json"})); const a = document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }

  // Export HTML/CSS generator
  function toHTMLCSS(ns){
    const itemCss = [];
    const items = ns.map(n=>{
      const sel = `#${n.id}`;
      const s = n.styles||{};
      itemCss.push(`${sel}{position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;z-index:${n.z||1};`+
        (s.bg?`background:${s.bg};`:"")+(s.border?`border:${s.border};`:"")+`border-radius:${(s.radius??12)}px;`+
        (s.shadow?`box-shadow:${s.shadow};`:"")+`color:${s.color||"#eaf4ff"};font:${(s.fontWeight||600)} ${(s.fontSize||16)}px ${s.font||"Inter, sans-serif"};}`+
        `${sel} .content{padding:${(s.padding??12)}px;}`);
      let inner = "";
      if(n.type==="image"){ inner = `<img src="${n.src||"https://picsum.photos/600/400"}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`; }
      else if(n.type==="link"){ inner = `<a href="${n.href||"#"}" target="_blank">${escapeHtml(n.text||"Link")}</a>`; }
      else if(n.type==="input"){ inner = `<input placeholder="Type…" style="width:100%;height:100%;background:${s.bg||"#0e1729"};color:${s.color||"#eaf4ff"};border:${s.border||"1px solid #ffffff22"};border-radius:${(s.radius||10)}px;padding:${(s.padding||10)}px">`; }
      else { inner = escapeHtml(n.text||n.type); }
      return `<div id="${n.id}" class="node"><div class="content">${inner}</div></div>`;
    }).join("\n");
    const html = `<div class="artboard">\n${items}\n</div>`;
    const css = `.artboard{position:relative;width:1200px;height:800px;background:#0d1422;border-radius:20px}\n`+ itemCss.join("\n");
    return { html, css };
  }
  function escapeHtml(s){ return (s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  // Init
  renderPalette();
  loadLocal();

  // Click to select from stage
  stage.addEventListener("click", e=>{
    const nodeEl = e.target.closest(".node"); if(!nodeEl) return;
    select(nodeEl.dataset.id);
  });
})();
