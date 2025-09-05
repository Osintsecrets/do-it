/* globals html2canvas, COMPONENTS */
(() => {
  const $ = sel => document.querySelector(sel);
  const stage   = $('#stage');
  const stageWrap = $('#stageWrap');
  const palette = $('#palette');
  const layers  = $('#layers');
  const props   = $('#props');

  // Toolbar controls
  const gridSizeInput = $('#gridSize');
  const snapToggle    = $('#snapToggle');
  const zoomInput     = $('#zoom');
  const newBtn        = $('#newDoc');
  const importBtn     = $('#importJSON');
  const exportBtn     = $('#exportJSON');
  const exportHTMLBtn = $('#exportHTML');
  const exportPngBtn  = $('#exportPNG');
  const exportOptionsBtn = $('#exportOptions');
  const exportDialog  = $('#exportDialog');
  const exportScale   = $('#exportScale');
  const exportPNGApply= $('#exportPNGApply');
  const exportClose   = $('#exportClose');
  const helpBtn       = $('#helpBtn');
  const helpDlg       = $('#help');
  const helpClose     = $('#helpClose');
  const fileOpenInput = $('#fileOpen');

  const undoBtn = $('#undoBtn');
  const redoBtn = $('#redoBtn');

  const alignLeft = $('#alignLeft'), alignHCenter = $('#alignHCenter'), alignRight = $('#alignRight');
  const alignTop  = $('#alignTop'),  alignVCenter = $('#alignVCenter'), alignBottom = $('#alignBottom');

  const artboardPreset = $('#artboardPreset');
  const stageWInput = $('#stageW');
  const stageHInput = $('#stageH');
  const stageBGInput= $('#stageBG');

  const shareLinkBtn = $('#shareLink');

  // State
  let nodes = [];         // array of node objects
  let selection = [];     // array of selected node ids (first = key)
  let zoom = 1;
  let grid = 8;
  let isMouseDown = false;
  let dragState = null;

  // History for undo/redo
  const history = [];
  let historyIdx = -1;

  // Helpers
  const uid = ()=>'id'+Math.random().toString(36).slice(2,8);
  const snap = v => snapToggle.checked ? Math.round(v / grid) * grid : v;
  const toPx = n => (Number(n)||0)+'px';
  const keyNode = ()=> nodes.find(n=>n.id===selection[0]);

  function pushHistory() {
    // limit history to 100 steps
    history.splice(historyIdx+1);
    history.push(JSON.stringify({nodes, stage: stageStyleSnapshot()}));
    if (history.length>100) history.shift();
    historyIdx = history.length-1;
    localStorage.setItem('design_v1', history[historyIdx]);
  }
  function stageStyleSnapshot(){
    return {
      w: parseInt(stage.style.width||1200),
      h: parseInt(stage.style.height||800),
      bg: stage.style.backgroundColor || ''
    };
  }
  function applyStageStyle(s){
    stage.style.width  = toPx(s.w||1200);
    stage.style.height = toPx(s.h||800);
    if(s.bg) stage.style.backgroundColor = s.bg;
    stageWInput.value = s.w||1200; stageHInput.value = s.h||800;
    if(s.bg) stageBGInput.value = rgbToHex(getComputedStyle(stage).backgroundColor);
  }

  function rgbToHex(rgb){
    if(!rgb) return '#0d1422';
    const m = rgb.match(/\d+/g); if(!m) return '#0d1422';
    const [r,g,b]=m.map(Number);
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  // Build palette
  function renderPalette(){
    palette.innerHTML = '';
    COMPONENTS.forEach(c=>{
      const el = document.createElement('div');
      el.className = 'item';
      el.textContent = c.label + ' ';
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = c.type;
      el.appendChild(b);
      el.draggable = true;
      el.addEventListener('dragstart', ev=>{
        ev.dataTransfer.setData('application/json', JSON.stringify(c));
      });
      palette.appendChild(el);
    });
  }

  // Rendering nodes
  function render(){
    stage.querySelectorAll('.node').forEach(n=>n.remove());
    nodes.forEach(n=>{
      const d = document.createElement('div');
      d.className = 'node ' + (n.type==='button'?'button':'') + (n.type==='image'?' image':'') + (['rectangle','circle'].includes(n.type)?' shape':'') + (n.type==='divider'?' divider':'');
      d.style.left = toPx(n.x);
      d.style.top  = toPx(n.y);
      d.style.width = toPx(n.w);
      d.style.height= toPx(n.h);
      if(n.bg) d.style.background = n.bg;
      if(n.color) d.style.color = n.color;
      if(n.radius!=null) d.style.borderRadius = toPx(n.radius);
      if(n.shadow) d.style.boxShadow = n.shadow;
      if(n.border) d.style.border = n.border;
      d.dataset.id = n.id;

      const content = document.createElement('div');
      content.className = 'content';

      if(n.type==='heading' || n.type==='paragraph' || n.type==='button' || n.type==='badge' || n.type==='card' || n.type==='input' || n.type==='link'){
        const tag = (n.type==='heading'?'h2':'div');
        const t = document.createElement(tag);
        t.textContent = n.text||'';
        if(n.font) t.style.fontFamily = n.font;
        if(n.fontSize) t.style.fontSize = toPx(n.fontSize);
        if(n.fontWeight) t.style.fontWeight = n.fontWeight;
        if(n.type==='link'){
          const a = document.createElement('a');
          a.href = n.href||'#'; a.textContent = n.text||'Link';
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.style.color = n.color||'#8ee7a7';
          content.appendChild(a);
        } else {
          content.appendChild(t);
        }
        if(n.padding!=null) content.style.padding = toPx(n.padding);
      } else if(n.type==='image'){
        const img = document.createElement('img');
        img.alt = n.alt||'';
        img.src = n.src||'';
        img.style.borderRadius = 'inherit';
        content.appendChild(img);
      } else if(n.type==='divider'){
        // no inner content
      } else {
        // shapes / others
        if(n.padding!=null) content.style.padding = toPx(n.padding);
        const t = document.createElement('div');
        t.textContent = n.text||'';
        content.appendChild(t);
      }

      d.appendChild(content);

      // selection state
      if(selection.includes(n.id)) d.classList.add('selected');

      // resize handles
      ['h-tl','h-tr','h-bl','h-br'].forEach(k=>{
        const h = document.createElement('div');
        h.className = 'handle '+k;
        d.appendChild(h);
      });

      // drag/select
      d.addEventListener('pointerdown', onNodePointerDown);
      stage.appendChild(d);
    });
    renderLayers();
    bindHandles();
  }

  function renderLayers(){
    layers.innerHTML = '';
    nodes
      .slice()
      .sort((a,b)=> (a.z||0)-(b.z||0))
      .forEach(n=>{
        const li = document.createElement('li');
        li.dataset.id = n.id;
        const span = document.createElement('span');
        span.textContent = `${n.type} (${n.id})`;
        li.appendChild(span);
        if(selection.includes(n.id)) li.classList.add('active');
        li.addEventListener('click', ()=>{
          selection = [n.id];
          updateProps();
          render();
        });
        layers.appendChild(li);
      });
  }

  function addNodeFromComponent(comp, x, y){
    const n = { id:uid(), type:comp.type, x:snap(x), y:snap(y), w:comp.w||160, h:comp.h||48,
      text:comp.text||'', src:comp.src||'', alt:comp.alt||'', href:comp.href||'',
      bg:comp.bg||'', color:comp.color||'', radius:comp.radius??12, padding:comp.padding??12,
      border:comp.border||'', shadow:comp.shadow||'', font:comp.font||'', fontSize:comp.fontSize||'', fontWeight:comp.fontWeight||'' };
    nodes.push(n);
    selection = [n.id];
    pushHistory();
    render();
    updateProps();
  }

  // Stage events
  stage.addEventListener('dragover', e=> e.preventDefault());
  stage.addEventListener('drop', e=>{
    e.preventDefault();
    const comp = JSON.parse(e.dataTransfer.getData('application/json')||'{}');
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    if(comp.type) addNodeFromComponent(comp, x, y);
  });

  stage.addEventListener('pointerdown', e=>{
    if(e.target===stage){ selection = []; updateProps(); render(); }
  });

  function nodeById(id){ return nodes.find(n=>n.id===id); }

  function onNodePointerDown(e){
    const nodeEl = e.currentTarget;
    const id = nodeEl.dataset.id;

    // Multi-select with Shift
    if(e.shiftKey){
      if(selection.includes(id)) selection = selection.filter(s=>s!==id);
      else selection = [...selection, id];
    } else {
      // single-select (unless already part of selection)
      if(!selection.includes(id)) selection = [id];
    }
    updateProps(); render();

    const rect = stage.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const init = selection.map(sid=>{
      const n = nodeById(sid);
      return { id:sid, x:n.x, y:n.y, w:n.w, h:n.h };
    });
    isMouseDown = true;
    dragState = { startX, startY, init, mode:'move' };

    function onMove(ev){
      if(!isMouseDown) return;
      const dx = (ev.clientX - startX)/zoom;
      const dy = (ev.clientY - startY)/zoom;
      selection.forEach((sid, idx)=>{
        const n = nodeById(sid);
        n.x = snap(init[idx].x + dx);
        n.y = snap(init[idx].y + dy);
      });
      render();
      ev.preventDefault();
    }
    function onUp(){
      isMouseDown = false;
      dragState = null;
      pushHistory();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function bindHandles(){
    stage.querySelectorAll('.node').forEach(nodeEl=>{
      const id = nodeEl.dataset.id;
      nodeEl.querySelectorAll('.handle').forEach(h=>{
        h.addEventListener('pointerdown', e=>{
          e.stopPropagation();
          const rect = stage.getBoundingClientRect();
          const startX = e.clientX, startY = e.clientY;
          const init = selection.map(sid=>{
            const n = nodeById(sid);
            return { id:sid, x:n.x, y:n.y, w:n.w, h:n.h };
          });
          const corner = [...h.classList].find(c=>c.startsWith('h-')).slice(2);
          function onMove(ev){
            const dx = (ev.clientX - startX)/zoom;
            const dy = (ev.clientY - startY)/zoom;
            selection.forEach((sid, idx)=>{
              const n = nodeById(sid);
              let {x,y,w,h} = init[idx];
              if(corner.includes('r')) w = snap(Math.max(10, w + dx));
              if(corner.includes('l')) { x = snap(x + dx); w = snap(Math.max(10, w - dx)); }
              if(corner.includes('b')) h = snap(Math.max(10, h + dy));
              if(corner.includes('t')) { y = snap(y + dy); h = snap(Math.max(10, h - dy)); }
              Object.assign(n, {x,y,w,h});
            });
            render();
          }
          function onUp(){
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            pushHistory();
          }
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        });
      });
    });
  }

  // Props panel binding
  props.addEventListener('input', e=>{
    const el = e.target;
    const prop = el.dataset.prop;
    if(!prop || selection.length===0) return;
    selection.forEach(id=>{
      const n = nodeById(id);
      let val = el.value;
      if(['x','y','w','h','padding','radius','fontSize','fontWeight'].includes(prop)) val = Number(val||0);
      if(prop==='bg' || prop==='color'){
        // color inputs might be hex; keep as is
      }
      n[prop] = val;
    });
    render();
    pushHistory();
  });

  function updateProps(){
    const many = selection.length>1;
    // Only show first selected details in the disabled ID/Type, others are edited collectively
    const first = keyNode();
    props.querySelectorAll('[data-prop]').forEach(inp=>{
      const p = inp.dataset.prop;
      if(!first){ inp.value = ''; return; }
      if(['x','y','w','h','padding','radius','fontSize','fontWeight'].includes(p)) inp.value = Number(first[p]||0);
      else inp.value = first[p] || '';
    });
  }

  // Toolbar actions
  newBtn.addEventListener('click', ()=>{
    if(confirm('Clear current design?')) {
      nodes = []; selection=[]; pushHistory(); render(); updateProps();
    }
  });

  importBtn.addEventListener('click', ()=> fileOpenInput.click());
  fileOpenInput.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    try{
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      if(!Array.isArray(parsed.nodes)) throw new Error('Invalid: no nodes[]');
      nodes = parsed.nodes;
      applyStageStyle(parsed.stage||{});
      selection=[]; render(); updateProps(); pushHistory();
    }catch(err){
      alert('Invalid JSON: '+err.message);
    } finally {
      fileOpenInput.value = '';
    }
  });

  exportBtn.addEventListener('click', ()=>{
    const data = currentJSON();
    download('design.json', JSON.stringify(data, null, 2));
  });

  exportHTMLBtn.addEventListener('click', ()=>{
    const {html, css} = exportHTML();
    const bundle = `<!-- Exported from Design Playground -->
<style>
${css}
</style>
<div class="export-stage">
${html}
</div>`;
    copyToClipboard(bundle);
    alert('HTML+CSS copied to clipboard!');
  });

  exportPngBtn.addEventListener('click', ()=> {
    exportDialog.showModal();
  });
  exportOptionsBtn.addEventListener('click', ()=> exportDialog.showModal());
  exportPNGApply.addEventListener('click', async ()=>{
    await exportPNG(Number(exportScale.value||1));
  });
  exportClose.addEventListener('click', ()=> exportDialog.close());

  helpBtn.addEventListener('click', ()=> helpDlg.showModal());
  helpClose.addEventListener('click', ()=> helpDlg.close());

  undoBtn.addEventListener('click', ()=> undo());
  redoBtn.addEventListener('click', ()=> redo());

  // Align tools (relative to first selected node as key)
  function doAlign(axis, mode){
    if(selection.length<2) return;
    const base = keyNode();
    selection.slice(1).forEach(id=>{
      const n = nodeById(id);
      if(axis==='x'){
        if(mode==='left') n.x = base.x;
        if(mode==='center') n.x = Math.round(base.x + (base.w - n.w)/2);
        if(mode==='right') n.x = base.x + base.w - n.w;
      } else {
        if(mode==='top') n.y = base.y;
        if(mode==='center') n.y = Math.round(base.y + (base.h - n.h)/2);
        if(mode==='bottom') n.y = base.y + base.h - n.h;
      }
    });
    render(); pushHistory();
  }
  alignLeft.addEventListener('click', ()=>doAlign('x','left'));
  alignHCenter.addEventListener('click', ()=>doAlign('x','center'));
  alignRight.addEventListener('click', ()=>doAlign('x','right'));
  alignTop.addEventListener('click', ()=>doAlign('y','top'));
  alignVCenter.addEventListener('click', ()=>doAlign('y','center'));
  alignBottom.addEventListener('click', ()=>doAlign('y','bottom'));

  // Artboard size + background
  function applyStageDims(w,h){
    stage.style.width = toPx(w); stage.style.height = toPx(h);
    stageWInput.value = w; stageHInput.value = h;
  }
  artboardPreset.addEventListener('change', ()=>{
    const v = artboardPreset.value;
    if(v==='custom') return;
    const [w,h]=v.split('x').map(Number);
    applyStageDims(w,h); pushHistory();
  });
  stageWInput.addEventListener('input', ()=>{ applyStageDims(Number(stageWInput.value||1200), Number(stageHInput.value||800)); pushHistory(); });
  stageHInput.addEventListener('input', ()=>{ applyStageDims(Number(stageWInput.value||1200), Number(stageHInput.value||800)); pushHistory(); });
  stageBGInput.addEventListener('input', ()=>{ stage.style.backgroundColor = stageBGInput.value; pushHistory(); });

  // Grid + zoom
  gridSizeInput.addEventListener('input', ()=>{ grid = Math.max(2, Number(gridSizeInput.value||8)); document.documentElement.style.setProperty('--grid', grid+'px'); });
  zoomInput.addEventListener('input', ()=>{ zoom = Number(zoomInput.value)/100; document.documentElement.style.setProperty('--zoom', zoom.toString()); });

  // Z-index helpers
  function bringForward(){ selection.forEach(id=>{ const n=nodeById(id); n.z=(n.z||0)+1; }); render(); pushHistory(); }
  function sendBackward(){ selection.forEach(id=>{ const n=nodeById(id); n.z=(n.z||0)-1; }); render(); pushHistory(); }
  $('#bringFwd').addEventListener('click', bringForward);
  $('#sendBack').addEventListener('click', sendBackward);

  // Duplicate / Remove
  $('#duplicate').addEventListener('click', ()=>{
    const clones=[];
    selection.forEach(id=>{
      const n = nodeById(id);
      const c = JSON.parse(JSON.stringify(n));
      c.id = uid(); c.x = snap(n.x + 16); c.y = snap(n.y + 16);
      nodes.push(c); clones.push(c.id);
    });
    selection = clones;
    render(); pushHistory(); updateProps();
  });
  $('#remove').addEventListener('click', ()=>{
    nodes = nodes.filter(n=>!selection.includes(n.id));
    selection=[]; render(); pushHistory(); updateProps();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', e=>{
    if(e.key==='Escape'){ selection=[]; render(); updateProps(); }
    if((e.key==='Delete'||e.key==='Backspace') && selection.length){ $('#remove').click(); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='d'){ e.preventDefault(); $('#duplicate').click(); }
    if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
    if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='z'){ e.preventDefault(); redo(); }
    // Arrow nudging (Shift for 10px)
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selection.length){
      const delta = e.shiftKey ? 10 : 1;
      selection.forEach(id=>{
        const n = nodeById(id);
        if(e.key==='ArrowLeft')  n.x = snap(n.x - delta);
        if(e.key==='ArrowRight') n.x = snap(n.x + delta);
        if(e.key==='ArrowUp')    n.y = snap(n.y - delta);
        if(e.key==='ArrowDown')  n.y = snap(n.y + delta);
      });
      render(); pushHistory();
    }
  });

  // Undo/Redo
  function loadSnapshot(s){
    try{
      const parsed = JSON.parse(s);
      nodes = parsed.nodes||[];
      applyStageStyle(parsed.stage||{});
      selection=[]; render(); updateProps();
    }catch(err){ console.warn('Bad snapshot', err); }
  }
  function undo(){
    if(historyIdx>0){ historyIdx--; loadSnapshot(history[historyIdx]); localStorage.setItem('design_v1', history[historyIdx]); }
  }
  function redo(){
    if(historyIdx < history.length-1){ historyIdx++; loadSnapshot(history[historyIdx]); localStorage.setItem('design_v1', history[historyIdx]); }
  }

  // Export helpers
  function exportPNG(scale=1){
    const stageClone = stage.cloneNode(true);
    stageClone.querySelectorAll('.handle').forEach(h=>h.remove());
    stageClone.querySelectorAll('.node').forEach(n=>n.classList.remove('selected'));
    stageClone.style.transform = 'scale(1)';
    stageClone.style.transformOrigin = 'top left';

    const tmp = document.createElement('div');
    tmp.style.position='fixed'; tmp.style.left='-99999px'; tmp.appendChild(stageClone);
    document.body.appendChild(tmp);

    return html2canvas(stageClone,{ backgroundColor: getComputedStyle(stage).backgroundColor, scale })
      .then(canvas=>{
        canvas.toBlob(blob=>{
          download('design.png', blob);
          tmp.remove();
          exportDialog.close();
        });
      });
  }

  function exportHTML(){
    // absolute layout export with minimal CSS reset; responsive via container scale utility
    const css = `.export-stage{position:relative;width:${parseInt(stage.style.width||1200)}px;height:${parseInt(stage.style.height||800)}px;background:${getComputedStyle(stage).backgroundColor};border-radius:20px;overflow:hidden}
.export-stage .node{position:absolute;border-radius:12px}
.export-stage .content{padding:12px}
@media(max-width: 768px){ .export-stage{width:100%; height:auto; aspect-ratio:${parseInt(stage.style.width||1200)}/${parseInt(stage.style.height||800)} }}`;
    const html = nodes.map(n=>{
      const style = [
        `left:${n.x}px`,`top:${n.y}px`,`width:${n.w}px`,`height:${n.h}px`,
        n.bg?`background:${n.bg}`:'', n.color?`color:${n.color}`:'', n.radius!=null?`border-radius:${n.radius}px`:'',
        n.shadow?`box-shadow:${n.shadow}`:'', n.border?`border:${n.border}`:''
      ].filter(Boolean).join(';');

      if(n.type==='image'){
        return `<div class="node image" style="${style}"><img src="${n.src||''}" alt="${(n.alt||'').replace(/"/g,'&quot;')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/></div>`;
      }
      if(n.type==='link'){
        return `<div class="node link" style="${style}"><a href="${n.href||'#'}" target="_blank" rel="noopener noreferrer" style="display:block;color:${n.color||'#8ee7a7'};padding:12px">${n.text||'Link'}</a></div>`;
      }
      if(n.type==='divider'){
        return `<div class="node divider" style="${style}"></div>`;
      }
      const textStyles = [
        n.font?`font-family:${n.font}`:'', n.fontSize?`font-size:${n.fontSize}px`:'', n.fontWeight?`font-weight:${n.fontWeight}`:''
      ].filter(Boolean).join(';');
      return `<div class="node ${n.type}" style="${style}"><div class="content" style="${n.padding!=null?`padding:${n.padding}px`:''}"><div style="${textStyles}">${(n.text||'')}</div></div></div>`;
    }).join('\n');

    return { html, css };
  }

  // Download helper
  function download(name, data){
    const a = document.createElement('a');
    if(data instanceof Blob){ a.href = URL.createObjectURL(data); }
    else { a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data); }
    a.download = name; a.click();
    setTimeout(()=>{ if(a.href.startsWith('blob:')) URL.revokeObjectURL(a.href); }, 5000);
  }
  function copyToClipboard(text){
    navigator.clipboard.writeText(text).catch(()=> {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    });
  }

  function currentJSON(){
    return { nodes, stage: { w: parseInt(stage.style.width||1200), h: parseInt(stage.style.height||800), bg: getComputedStyle(stage).backgroundColor } };
  }

  // Share link: base64 JSON in URL hash
  function makeShareLink(){
    const json = currentJSON();
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
    return location.origin + location.pathname + '#d=' + b64;
  }
  shareLinkBtn.addEventListener('click', ()=>{
    const url = makeShareLink();
    copyToClipboard(url);
    alert('Share link copied to clipboard!');
  });

  // Load from hash if present
  function tryLoadFromHash(){
    const m = location.hash.match(/#d=([^&]+)/);
    if(!m) return false;
    try{
      const json = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      nodes = json.nodes||[];
      applyStageStyle(json.stage||{});
      selection=[]; render(); updateProps(); pushHistory();
      return true;
    }catch(e){ console.warn('Bad hash data'); return false; }
  }

  // Init
  function init(){
    grid = Number(gridSizeInput.value||8);
    zoom = Number(zoomInput.value)/100;
    document.documentElement.style.setProperty('--grid', grid+'px');
    document.documentElement.style.setProperty('--zoom', zoom.toString());

    renderPalette();

    // restore from localStorage or hash
    if(!tryLoadFromHash()){
      const saved = localStorage.getItem('design_v1');
      if(saved){ loadSnapshot(saved); historyIdx = history.length-1; }
      else { pushHistory(); render(); }
    }

    // stage defaults to inputs
    stageWInput.value = parseInt(stage.style.width||1200);
    stageHInput.value = parseInt(stage.style.height||800);
    stageBGInput.value = rgbToHex(getComputedStyle(stage).backgroundColor);
  }

  init();
})();
