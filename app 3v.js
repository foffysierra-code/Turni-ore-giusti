const $=id=>document.getElementById(id);
const key="turni-pwa-v2";
const defaults=[
{name:"Giorno",start:"07:00",end:"19:50",credited:740},
{name:"Notte",start:"19:15",end:"07:15",credited:720},
{name:"Smonto",start:"",end:"",credited:0},
{name:"Riposo",start:"",end:"",credited:0},
{name:"Riposo",start:"",end:"",credited:0}];

let data=JSON.parse(localStorage.getItem(key)||"null")||{commitments:[],breaks:[],pattern:defaults,overrides:[]};
if(!data.pattern)data.pattern=defaults;
if(!data.overrides)data.overrides=[];

let selected=localDate("2026-10-16"),editingShift=-1;

// Funzione ISO corretta per il fuso orario locale (evita lo shift UTC di .toISOString())
function iso(d){
  let y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function localDate(s){let [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function save(){localStorage.setItem(key,JSON.stringify(data))}
function start(){return localStorage.getItem("cycleStart")||"2026-10-16"}
function paused(d){let x=iso(d);return data.breaks.some(b=>x>=b.start&&x<=b.end)}

function baseIndex(d){
  let s=localDate(start()),t=localDate(iso(d)),cur=new Date(s),dir=t>=s?1:-1,count=0;
  while(iso(cur)!==iso(t)){
    cur.setDate(cur.getDate()+dir);
    if(!paused(cur))count+=dir;
  }
  return ((count%data.pattern.length)+data.pattern.length)%data.pattern.length;
}

function shiftIndex(d){
  let o=data.overrides.find(x=>x.date===iso(d));
  return o?o.index:(paused(d)?null:baseIndex(d));
}

function fmtDate(d){return d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})}
function fmtMin(m){return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

function renderDay(){
  $("selectedDate").value=iso(selected);
  $("pageTitle").textContent=iso(selected)===iso(new Date())?"Oggi":fmtDate(selected);
  
  let i=shiftIndex(selected),c=$("shiftCard");
  if(i===null) {
    c.innerHTML='<div class="shift-name">Ferie / pausa</div><div class="shift-time">Il ciclo è sospeso in questa data.</div>';
  } else {
    let s=data.pattern[i];
    c.innerHTML=`<div class="shift-name">${esc(s.name)}</div><div class="shift-time">${s.start&&s.end?s.start+"–"+s.end:"Nessun orario"}</div><div class="credited">Ore conteggiate: ${fmtMin(s.credited)}</div>${data.overrides.some(x=>x.date===iso(selected))?'<div class="muted">Modifica manuale per questa giornata</div>':""}`;
  }
  
  let arr=data.commitments.filter(x=>x.date===iso(selected)).sort((a,b)=>a.start.localeCompare(b.start));
  $("commitments").innerHTML=arr.length?arr.map((x,n)=>`<div class="commitment"><b>${esc(x.title)}</b><div>${x.start}–${x.end} · ${esc(x.type)}</div>${x.location?`<div class="muted">📍 ${esc(x.location)}</div>`:""}${x.notes?`<div class="muted">${esc(x.notes)}</div>`:""}<button onclick="delCommit(${n})" style="float:right;color:#b91c1c">Elimina</button></div>`).join(""):'<div class="card muted">Nessun impegno.</div>';
}

window.delCommit = function(n){
  let a=data.commitments.filter(x=>x.date===iso(selected)).sort((a,b)=>a.start.localeCompare(b.start));
  data.commitments.splice(data.commitments.indexOf(a[n]),1);
  save();
  renderDay();
};

function openModal(){$("cDate").value=iso(selected);$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}

$("addBtn").onclick=openModal;
$("addCommitment2").onclick=openModal;
$("closeModal").onclick=closeModal;

$("saveCommitment").onclick=()=>{
  if(!$("cTitle").value.trim())return alert("Inserisci un titolo.");
  data.commitments.push({title:$("cTitle").value,date:$("cDate").value,type:$("cType").value,start:$("cStart").value,end:$("cEnd").value,location:$("cLocation").value,notes:$("cNotes").value});
  save();
  closeModal();
  renderDay();
};

$("prevDay").onclick=()=>{selected.setDate(selected.getDate()-1);renderDay()};
$("nextDay").onclick=()=>{selected.setDate(selected.getDate()+1);renderDay()};
$("selectedDate").onchange=e=>{selected=localDate(e.target.value);renderDay()};

function renderMonth(){
  let v=$("monthPicker").value||iso(selected).slice(0,7),
      [y,m]=v.split("-").map(Number),
      f=new Date(y,m-1,1),
      l=new Date(y,m,0),
      h="";
  
  let firstDayIndex = (f.getDay() + 6) % 7; 
  for(let i=0; i<firstDayIndex; i++) h+="<div></div>";
  
  for(let d=1; d<=l.getDate(); d++){
    let dt=new Date(y,m-1,d),
        i=shiftIndex(dt),
        s=i===null?null:data.pattern[i];
    h+=`<button class="day ${s?"shift":""} ${iso(dt)===iso(selected)?"selected":""}" onclick="selectMonthDay('${iso(dt)}')">${d}${s?`<small>${esc(s.name)}</small>`:""}</button>`;
  }
  $("monthGrid").innerHTML=h;
}

window.selectMonthDay = function(s){
  selected=localDate(s);
  $("monthPicker").value=s.slice(0,7);
  show("home");
  renderDay();
};

$("monthPicker").onchange=renderMonth;

function monthMinutes(v){
  let[y,m]=v.split("-").map(Number),
      days=new Date(y,m,0).getDate(),
      total=0,
      c=Array(data.pattern.length).fill(0);
  for(let d=1; d<=days; d++){
    let dt=new Date(y,m-1,d),
        i=shiftIndex(dt);
    if(i!==null){
      total+=data.pattern[i].credited;
      c[i]++;
    }
  }
  return [total,c];
}

function renderHours(){
  let v=$("hoursMonth").value||iso(selected).slice(0,7);
  $("hoursMonth").value=v;
  let[t,c]=monthMinutes(v);
  $("totalHours").textContent=fmtMin(t);
  $("counts").innerHTML=data.pattern.map((x,i)=>`<div class="stat"><span>${esc(x.name)}</span><b>${c[i]}</b><small>${fmtMin(c[i]*x.credited)}</small></div>`).join("");
}

$("hoursMonth").onchange=renderHours;
$("cycleStart").onchange=()=>{
  localStorage.setItem("cycleStart",$("cycleStart").value);
  renderAll();
};

function renderPattern(){
  $("shiftEditor").innerHTML=data.pattern.map((s,i)=>`<div class="commitment"><div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center"><b>${i+1}</b><div><b>${esc(s.name)}</b><div class="muted">${s.start&&s.end?s.start+"–"+s.end:"Nessun orario"} · ${fmtMin(s.credited)}</div></div><div><button onclick="editShift(${i})">✏️</button><button onclick="deleteShift(${i})">🗑️</button></div></div></div>`).join("");
  $("overrideShift").innerHTML=data.pattern.map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.name)}</option>`).join("");
}

function openShiftModal(i){
  editingShift=i;
  $("shiftModalTitle").textContent=i<0?"Nuovo turno":"Modifica turno";
  let s=i<0?{name:"",start:"",end:"",credited:0}:data.pattern[i];
  $("sName").value=s.name;
  $("sStart").value=s.start;
  $("sEnd").value=s.end;
  $("sCredited").value=s.credited;
  $("shiftModal").classList.remove("hidden");
}

window.editShift = function(i){ openShiftModal(i); };

window.deleteShift = function(i){
  if(data.pattern.length<=1)return alert("Deve rimanere almeno un turno.");
  if(!confirm("Eliminare questo turno dal ciclo?"))return;
  data.pattern.splice(i,1);
  data.overrides=data.overrides.filter(x=>x.index!==i).map(x=>x.index>i?{...x,index:x.index-1}:x);
  save();
  renderAll();
};

$("addShiftBtn").onclick=()=>openShiftModal(-1);
$("closeShiftModal").onclick=()=>$("shiftModal").classList.add("hidden");

$("saveShift").onclick=()=>{
  let name=$("sName").value.trim();
  if(!name)return alert("Inserisci il nome del turno.");
  let s={name,start:$("sStart").value,end:$("sEnd").value,credited:Number($("sCredited").value)||0};
  if(editingShift<0)data.pattern.push(s);
  else data.pattern[editingShift]=s;
  save();
  $("shiftModal").classList.add("hidden");
  renderAll();
};

$("resetPattern").onclick=()=>{
  if(confirm("Ripristinare i 5 turni originali?")){
    data.pattern=JSON.parse(JSON.stringify(defaults));
    data.overrides=[];
    save();
    renderAll();
  }
};

function renderOverrides(){
  $("overrideList").innerHTML=data.overrides.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>`<div class="commitment"><b>${x.date}</b><div>${esc(data.pattern[x.index]?.name||"Turno eliminato")}</div><button onclick="removeOverride('${x.date}')" style="color:#b91c1c">Rimuovi modifica</button></div>`).join("");
}

window.removeOverride = function(date){
  data.overrides=data.overrides.filter(x=>x.date!==date);
  save();
  renderAll();
};

$("saveOverride").onclick=()=>{
  let date=$("overrideDate").value,index=Number($("overrideShift").value);
  if(!date)return alert("Scegli una data.");
  data.overrides=data.overrides.filter(x=>x.date!==date);
  data.overrides.push({date,index});
  save();
  selected=localDate(date);
  renderAll();
};

function renderBreaks(){
  $("breakList").innerHTML=data.breaks.map((b,i)=>`<div class="commitment"><b>${b.start} → ${b.end}</b><div class="muted">${esc(b.reason||"Pausa ciclo")}</div><button onclick="removeBreak(${i})" style="color:#b91c1c">Elimina</button></div>`).join("");
}

$("saveBreak").onclick=()=>{
  let a=$("breakStart").value,b=$("breakEnd").value;
  if(!a||!b||a>b)return alert("Controlla le date.");
  data.breaks.push({start:a,end:b,reason:"Ferie"});
  save();
  renderAll();
};

window.removeBreak = function(i){
  data.breaks.splice(i,1);
  save();
  renderAll();
};

function show(id){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  if(id==="calendar")renderMonth();
  if(id==="hours")renderHours();
  if(id==="settings"){renderPattern();renderOverrides();renderBreaks();}
}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>show(b.dataset.page));

function renderAll(){
  renderDay();
  renderMonth();
  renderHours();
  renderPattern();
  renderOverrides();
  renderBreaks();
}

$("cycleStart").value=localStorage.getItem("cycleStart")||"2026-10-16";
$("overrideDate").value=iso(selected);
renderAll();

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js");
}
