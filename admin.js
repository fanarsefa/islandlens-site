'use strict';
// Forge family sign-in log. Reads /api/signins and summarises it in the browser.
const PRODUCTS={stackforge:'StackForge',bessforge:'BESSForge',cycleforge:'CycleForge',gridforge:'GridForge'};
const ACTIVE_MS=30*60*1000,DAY_MS=86400000;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let code='',events=[],total=0,now=Date.now();

function ago(t){const s=Math.max(0,Math.round((now-t)/1000));
 if(s<60)return 'just now';const m=Math.round(s/60);if(m<60)return m+' min ago';const h=Math.round(m/60);if(h<48)return h+' h ago';return Math.round(h/24)+' days ago'}
function when(t){return `<time datetime="${new Date(t).toISOString()}" title="${esc(new Date(t).toLocaleString())}">${esc(ago(t))}</time>`}
const product=p=>PRODUCTS[p]||p||'?';
const tier=k=>{k=String(k||'full');return `<span class="adm-tag${k==='trial'?' trial':''}">${esc(k[0].toUpperCase()+k.slice(1))}</span>`};

async function load(){
 $('#adm-refresh').disabled=true;
 try{
  const r=await fetch('/api/signins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){if(r.status===401||r.status===429)signOut(j.error);else showError(j.error||'Could not load the sign-in log.');return}
  events=j.events||[];total=j.total||0;now=j.now||Date.now();
  $('#adm-gate').hidden=true;$('#adm-board').hidden=false;$('#adm-out').hidden=false;
  draw();
 }catch(e){showError('Could not reach the server.')}
 finally{$('#adm-refresh').disabled=false}
}
function showError(msg){if(!$('#adm-board').hidden){$('#adm-sub').textContent=msg}else{$('#adm-err').textContent=msg}}
function signOut(msg){code='';try{sessionStorage.removeItem('islandlens_admin')}catch(e){}
 $('#adm-board').hidden=true;$('#adm-out').hidden=true;$('#adm-gate').hidden=false;$('#adm-code').value='';$('#adm-err').textContent=msg||'';$('#adm-code').focus()}

function draw(){
 const p=$('#adm-product').value,q=$('#adm-q').value.trim().toLowerCase();
 const list=events.filter(e=>(!p||e.p===p)&&(!q||String(e.n||'').toLowerCase().includes(q)));
 // One person = same name (ignoring case), product and code hint.
 const people=new Map();
 for(const e of list){const key=[String(e.n||'').toLowerCase(),e.p,e.c].join('|');
  let x=people.get(key);if(!x){x={n:e.n||'(no name)',p:e.p,c:e.c,k:e.k,signins:0,runs:0,first:e.t,last:e.t,u:null,l:null};people.set(key,x)}
  if(e.e==='signin')x.signins++;else if(e.e==='run')x.runs++;
  if(e.t>x.last){x.last=e.t}if(e.t<x.first)x.first=e.t;
  // Events arrive newest first, so the first trial count seen is the latest one.
  if(x.u==null&&e.u!=null){x.u=e.u;x.l=e.l}if(!x.k&&e.k)x.k=e.k}
 const rows=[...people.values()].sort((a,b)=>b.last-a.last);
 const active=rows.filter(x=>now-x.last<ACTIVE_MS).length;
 const names=new Set(rows.map(x=>String(x.n).toLowerCase())).size;
 const day=list.filter(e=>e.e==='signin'&&now-e.t<DAY_MS).length,week=list.filter(e=>e.e==='run'&&now-e.t<7*DAY_MS).length;
 $('#adm-tiles').innerHTML=[['Active now',active,'last 30 minutes'],['People',names,'distinct names'],['Sign-ins',day,'last 24 hours'],['Runs',week,'last 7 days']]
  .map(([a,b,c])=>`<div class="adm-tile"><p>${a}</p><b>${b.toLocaleString()}</b><small>${c}</small></div>`).join('');
 $('#adm-sub').textContent=total>events.length?`Showing the latest ${events.length.toLocaleString()} of ${total.toLocaleString()} entries.`:`${events.length.toLocaleString()} entries in the log.`;
 $('#adm-people').innerHTML=`<thead><tr><th>Name</th><th>Product</th><th>Code</th><th>Access</th><th class="n">Sign-ins</th><th class="n">Runs</th><th>Trial runs used</th><th>Last seen</th><th>First seen</th></tr></thead><tbody>`+
  (rows.length?rows.map(x=>`<tr><td>${now-x.last<ACTIVE_MS?'<span class="adm-dot" title="Active in the last 30 minutes"></span>':''}${esc(x.n)}</td><td>${esc(product(x.p))}</td><td><code>${esc(x.c)}</code></td><td>${tier(x.k)}</td><td class="n">${x.signins}</td><td class="n">${x.runs}</td><td>${x.u!=null&&x.l!=null?`${x.u} of ${x.l}`:'–'}</td><td>${when(x.last)}</td><td>${when(x.first)}</td></tr>`).join('')
  :'<tr><td colspan="9" class="adm-empty">No sign-ins match.</td></tr>')+'</tbody>';
 $('#adm-events').innerHTML='<thead><tr><th>When</th><th>Name</th><th>Product</th><th>Event</th><th>Code</th><th>Detail</th></tr></thead><tbody>'+
  (list.length?list.slice(0,200).map(e=>`<tr><td>${when(e.t)}</td><td>${esc(e.n)}</td><td>${esc(product(e.p))}</td><td>${e.e==='signin'?'Signed in':e.e==='run'?'Run':esc(e.e)}</td><td><code>${esc(e.c)}</code></td><td>${e.u!=null&&e.l!=null?`trial run ${e.u} of ${e.l}`:''}</td></tr>`).join('')
  :'<tr><td colspan="6" class="adm-empty">No activity yet.</td></tr>')+'</tbody>';
}

$('#adm-form').onsubmit=e=>{e.preventDefault();code=$('#adm-code').value;$('#adm-err').textContent='';try{sessionStorage.setItem('islandlens_admin',code)}catch(e){}load()};
$('#adm-refresh').onclick=load;
$('#adm-out').onclick=()=>signOut();
$('#adm-product').onchange=draw;$('#adm-q').oninput=draw;
try{code=sessionStorage.getItem('islandlens_admin')||''}catch(e){}
if(code)load();else $('#adm-code').focus();
