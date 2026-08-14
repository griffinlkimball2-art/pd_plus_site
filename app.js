/* ===== PD+ shared app logic =====
   Loaded on every page after data.js. All DOM wiring lives in init*()
   functions that check their own elements exist before doing anything,
   so it's safe to call every init function on every page. */

let filtered=DATA.slice(),sortKey="rank",sortDir=1;
const fmt=(x,d=2)=>x==null||Number.isNaN(x)?"—":Number(x).toFixed(d); const fmtBAA=(x)=>x==null||Number.isNaN(x)?"—":Number(x).toFixed(3).replace(/^(-?)0\./,"$1.");
const seasons=[...new Set(DATA.map(d=>d.season))].sort((a,b)=>a-b);
const byId=id=>document.getElementById(id);
function fillSelect(id){byId(id).innerHTML=seasons.map(v=>`<option value="${v}">${v}</option>`).join("")}
function applyFilters(){
 const q=byId("search").value.trim().toLowerCase(),from=+byId("from").value,to=+byId("to").value;
 const minVal=byId("minpd").value.trim(); const min=minVal===""?-Infinity:+minVal;
 const max=byId("maxpd").value===""?Infinity:+byId("maxpd").value;
 filtered=DATA.filter(d=>d.season>=from&&d.season<=to&&(d.pd??-Infinity)>=min&&(d.pd??Infinity)<=max&&(!q||d.player.toLowerCase().includes(q)));
 renderTable();renderScatter();
}
function profile(i){
 const d=DATA[i];
 const components=[
   ["ERA Component","eraz"],
   ["K-BB% Component","kbbz"],
   ["BAA Component","baaz"],
   ["HR/9 Component","hr9z"],
   ["IP Component","ipz"],
   ["WPA Component · Clutch","wpaz"]
 ];
 const rankInfo=components.map(([label,key])=>{
   const sorted=DATA.slice().sort((a,b)=>(b[key]??-Infinity)-(a[key]??-Infinity));
   const rank=sorted.findIndex(x=>x.id===d.id)+1;
   const percentile=DATA.length>1?100*(1-(rank-1)/(DATA.length-1)):100;
   return {label,key,rank,percentile};
 });
 byId("profile").innerHTML=`<div class="label">${d.season} · ${d.team}</div><h3>${d.player}</h3><div class="big">${fmt(d.pd,2)}</div><div class="label">Pitching Dominance+</div>
 <hr class="divider"><div class="grid two">
 <div><b>ERA</b><br>${fmt(d.era,2)}</div><div><b>K-BB%</b><br>${fmt(d.kbb,1)}%</div>
 <div><b>BAA</b><br>${fmtBAA(d.baa)}</div><div><b>HR/9</b><br>${fmt(d.hr9,2)}</div>
 <div><b>IP</b><br>${fmt(d.ip,1)}</div><div><b>WPA</b><br>${fmt(d.wpa,2)}</div></div>
 <hr class="divider">
 ${rankInfo.map(c=>`<div class="note">${c.label}: <b>${fmt(d[c.key],2)}</b> · <b>#${c.rank.toLocaleString()}</b> of ${DATA.length.toLocaleString()}</div>
 <div class="bar" title="Top ${c.percentile.toFixed(1)}% of qualified pitcher-seasons"><i style="width:${Math.max(0,Math.min(100,c.percentile))}%"></i></div>`).join("")}
 <p class="note mt-14">Component bars show the pitcher's percentile position in the full qualified pitcher-season distribution, with the best z-score at 100%.</p>`;
}
function row(d){return `<tr data-id="${d.id}"><td>${d.rank}</td><td>${d.season}</td><td>${d.player}</td><td>${d.team}</td><td><b>${fmt(d.pd,2)}</b></td><td>${fmt(d.era,2)}</td><td>${fmt(d.kbb,1)}%</td><td>${fmtBAA(d.baa)}</td><td>${fmt(d.hr9,2)}</td><td>${fmt(d.ip,1)}</td><td>${fmt(d.wpa,2)}</td></tr>`}
function bindRows(sel){document.querySelectorAll(sel+" tbody tr").forEach(tr=>tr.onclick=()=>profile(+tr.dataset.id))}
function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function computeCyYoungLeaders(minCount=4){
  // One hypothetical Cy Young per AL/NL season (2LG seasons excluded), awarded to the highest PD+.
  const bySeasonLg=new Map();
  DATA.forEach(d=>{
    if(d.lg!=="AL"&&d.lg!=="NL") return;
    const key=d.season+"|"+d.lg;
    const cur=bySeasonLg.get(key);
    if(!cur||d.pd>cur.pd) bySeasonLg.set(key,d);
  });
  const byPlayer=new Map();
  bySeasonLg.forEach(d=>{
    if(!byPlayer.has(d.player)) byPlayer.set(d.player,[]);
    byPlayer.get(d.player).push(d);
  });
  let leaders=[...byPlayer.entries()]
    .map(([player,wins])=>({player,wins:wins.slice().sort((a,b)=>a.season-b.season),count:wins.length}))
    .filter(p=>p.count>=minCount);
  leaders.sort((a,b)=>{
    if(b.count!==a.count) return b.count-a.count;
    const aLast=a.wins.at(-1).season, bLast=b.wins.at(-1).season;
    if(bLast!==aLast) return bLast-aLast;
    return a.player.localeCompare(b.player);
  });
  // Standard competition ranking (ties share a rank, next rank skips)
  let rank=0, lastCount=null;
  return leaders.map((p,i)=>{
    if(p.count!==lastCount){rank=i+1;lastCount=p.count}
    const tied=leaders.filter(x=>x.count===p.count).length>1;
    return {...p,rankLabel:(tied?"T-":"")+ordinal(rank)};
  });
}
function renderCyYoungLeaders(){
  const el=byId("pdCyYoungLeaderboardBody");
  if(!el) return;
  const leaders=computeCyYoungLeaders(4);
  el.innerHTML=leaders.map(p=>`<div class="cy-leader-row">
    <div class="cy-leader-rank">${p.rankLabel}</div>
    <div><div class="cy-leader-name">${p.player}</div><div class="cy-leader-count">${p.count} hypothetical Cy Youngs</div></div>
    <div class="cy-leader-seasons">${p.wins.map(w=>`<span class="cy-leader-chip"><span class="cy-chip-top"><b>${w.season}</b><strong>${fmt(w.pd,2)}</strong></span><span class="cy-chip-bottom"><b>${w.lg}</b><strong>${w.team}</strong></span></span>`).join("")}</div>
  </div>`).join("");
}
function renderCy2026Predictions(){
  const pool=DATA.filter(d=>d.season===2026);
  const components=[["ERA","eraz"],["K-BB%","kbbz"],["BAA","baaz"],["HR/9","hr9z"],["IP","ipz"],["WPA","wpaz"]];
  function rankIn(list,key,val){return list.filter(d=>d[key]>val).length+1}
  function panelHTML(lg,label){
    const lgPool=pool.filter(d=>d.lg===lg).sort((a,b)=>b.pd-a.pd);
    if(!lgPool.length) return `<div class="cy-panel-kicker">${label}</div><p class="note">No qualified 2026 pitchers yet.</p>`;
    const winner=lgPool[0],runnerUp=lgPool[1];
    const rows=components.map(([name,zkey])=>{
      const z=winner[zkey],rank=rankIn(pool,zkey,z);
      return `<div class="cy26-component-row">
          <div class="cy26-component-name">${name}</div>
          <div class="cy26-component-z">z = ${fmt(z,2)}</div>
          <div class="cy26-component-rank">#${rank}</div>
        </div>`;
    }).join("");
    return `<div class="cy-panel-kicker">${label}</div>
      <div class="cy-player">${winner.player}</div>
      <div class="cy-meta">2026 ${lg} · ${winner.team}</div>
      <div class="cy-score-row"><div class="cy-score">${fmt(winner.pd,2)}</div><div class="cy-score-label">PD+</div></div>
      <div class="cy-rank">#${winner.rank} since 1974</div>
      <div class="cy26-breakdown">
        <div class="cy26-breakdown-title">2026 Component Breakdown</div>
        <div class="cy26-component-list">${rows}</div>
        <div class="cy26-breakdown-foot">Out of ${pool.length} qualified pitchers in 2026.</div>
        ${runnerUp?`<div class="cy26-runner-up-box">
          <div class="cy26-runner-up-label">Runner-Up</div>
          <div class="cy26-runner-up-player">${runnerUp.player}</div>
          <div class="cy26-runner-up-pd">PD+ <strong>${fmt(runnerUp.pd,2)}</strong></div>
        </div>`:""}
      </div>`;
  }
  const alEl=byId("cyPredAL"),nlEl=byId("cyPredNL");
  if(alEl) alEl.innerHTML=panelHTML("AL","American League");
  if(nlEl) nlEl.innerHTML=panelHTML("NL","National League");
}
function renderTop(){
 const rows=DATA.slice().sort((a,b)=>b.pd-a.pd).slice(0,15);
 byId("topTable").querySelector("tbody").innerHTML=rows.map(d=>{
   const won=d.cy===1;
   const ongoing=d.season===2026;
   let signifier="—";
   if(won) signifier='<span class="pill" title="Cy Young Award winner">CY</span>';
   if(ongoing) signifier='<span class="pill" title="2026 season is ongoing">LIVE</span>';
   return `<tr data-id="${d.id}">
     <td>${d.rank}</td><td>${d.season}</td>
     <td>${d.player}</td><td>${d.team}</td><td>${fmt(d.age,0)}</td><td><b>${fmt(d.pd,2)}</b></td><td>${signifier}</td>
   </tr>`;
 }).join("");
 bindRows("#topTable");
}
function renderTable(){
 let rows=filtered.slice().sort((a,b)=>{let av=a[sortKey],bv=b[sortKey];if(typeof av==="string")return sortDir*String(av).localeCompare(String(bv));return sortDir*((av??-Infinity)-(bv??-Infinity))});
 byId("count").textContent=`Showing ${rows.length.toLocaleString()} of ${DATA.length.toLocaleString()} pitcher-seasons`;
 byId("leaderTable").querySelector("tbody").innerHTML=rows.map(row).join("");bindRows("#leaderTable");
}
function renderScatter(){
 const el=byId("scatter");
 if(!filtered.length){ Plotly.react(el,[],{margin:{l:55,r:20,t:10,b:45}}); return; }
 const trace={x:filtered.map(d=>d.season),y:filtered.map(d=>d.pd),mode:"markers",type:"scatter",marker:{size:filtered.map(d=>d.pd>=125?8:5),opacity:0.78},customdata:filtered.map(d=>[d.player,d.season,d.pd]),hovertemplate:"<b>%{customdata[0]}</b><br>Season: %{customdata[1]}<br>PD+: %{customdata[2]:.2f}<extra></extra>"};
 const layout={margin:{l:55,r:20,t:45,b:45},
   paper_bgcolor:"#fff",plot_bgcolor:"#fff",hovermode:"closest",xaxis:{title:"Season",dtick:5,gridcolor:"#eee",zeroline:false},yaxis:{title:"PD+",gridcolor:"#eee",zeroline:false},font:{family:"system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",color:"#171717"}};
 Plotly.react(el,[trace],layout,{responsive:true,displaylogo:false});
}

function peakByPlayer(){
 const grouped={};
 DATA.forEach(d=>{
   if(!grouped[d.player]) grouped[d.player]=[];
   grouped[d.player].push(d);
 });
 Object.values(grouped).forEach(rows=>rows.sort((a,b)=>a.season-b.season));
 return grouped;
}

const peakPlayers=peakByPlayer();
const peakPlayerNames=Object.keys(peakPlayers).sort((a,b)=>a.localeCompare(b));
let selectedPeakPlayer="";

function findPeak(n){
 let best=null;
 for(const [player,seasons] of Object.entries(peakPlayers)){
   const b=findPlayerPeak(player,n);
   if(b && (!best || b.avg>best.avg)) best=b;
 }
 return best;
}

function findPlayerPeak(player,n){
 const seasons=peakPlayers[player]||[];
 let best=null;
 for(let i=0;i<seasons.length;i++){
   const rows=[];
   for(let j=0;j<n;j++){
     const d=seasons[i+j];
     if(!d || Number(d.season)!==Number(seasons[i].season)+j){
       rows.length=0;
       break;
     }
     rows.push(d);
   }
   if(rows.length!==n) continue;
   const avg=rows.reduce((sum,d)=>sum+Number(d.pd),0)/n;
   if(!best || avg>best.avg) best={player,start:rows[0].season,end:rows[n-1].season,avg,rows};
 }
 return best;
}

function findCareerPeak(){
 let best=null;
 for(const [player,seasons] of Object.entries(peakPlayers)){
   if(seasons.length<10) continue;
   const avg=seasons.reduce((sum,d)=>sum+Number(d.pd),0)/seasons.length;
   if(!best || avg>best.avg) best={player,avg,rows:seasons};
 }
 return best;
}

function findPlayerCareer(player){
 const seasons=peakPlayers[player]||[];
 if(!seasons.length) return null;
 const avg=seasons.reduce((sum,d)=>sum+Number(d.pd),0)/seasons.length;
 return {player,avg,rows:seasons};
}

function renderPeakSearchSuggestions(){
 const input=byId("pdPeakSearch");
 const box=byId("pdPeakSuggestions");
 const q=input.value.trim().toLowerCase();
 if(!q){ box.style.display="none"; box.innerHTML=""; return; }
 const matches=peakPlayerNames.filter(name=>name.toLowerCase().includes(q)).slice(0,10);
 if(!matches.length){ box.style.display="none"; box.innerHTML=""; return; }
 box.innerHTML=matches.map(name=>`<div class="peak-suggestion" data-player="${name.replace(/"/g,'&quot;')}">${name}</div>`).join("");
 box.style.display="block";
 box.querySelectorAll(".peak-suggestion").forEach(el=>el.addEventListener("mousedown",e=>{
   e.preventDefault();
   selectPeakPlayer(el.dataset.player);
 }));
}

function selectPeakPlayer(player){
 selectedPeakPlayer=player;
 byId("pdPeakSearch").value=player;
 byId("pdPeakSuggestions").style.display="none";
 byId("pdPeakSelectedName").textContent=player;
 byId("pdPeakSelected").style.display="flex";
 renderPeakFinder();
}

function clearPeakPlayer(){
 selectedPeakPlayer="";
 byId("pdPeakSearch").value="";
 byId("pdPeakSuggestions").style.display="none";
 byId("pdPeakSelected").style.display="none";
 renderPeakFinder();
}

function renderPeakFinder(){
 const value=byId("pdPeakLength").value;
 const result=byId("pdPeakResult");
 const player=selectedPeakPlayer;

 if(!value){
   result.innerHTML='<div class="peak-warning">Choose a peak length to see results.</div>';
   return;
 }

 if(player){
   if(value==="career"){
     const b=findPlayerCareer(player);
     if(!b){ result.innerHTML='<div class="peak-warning">No qualified seasons found for this pitcher.</div>'; return; }
     result.innerHTML=`
       <div class="peak-main">
         <div class="peak-kicker">Individual career average</div>
         <div class="peak-player">${b.player}</div>
         <div class="peak-years">${b.rows[0].season}–${b.rows[b.rows.length-1].season} · ${b.rows.length} qualified seasons</div>
         <div class="peak-score">${fmt(b.avg,2)}</div>
         <div class="peak-score-label">Average PD+</div>
       </div>
       <div class="peak-detail peak-career-detail">
         ${b.rows.map(d=>`<div class="peak-pill"><div class="year">${d.season}</div><div class="pd">${fmt(d.pd,2)}</div></div>`).join("")}
       </div>
       <p class="peak-explain">Career mode for a selected pitcher averages every qualified season in the dataset; there is no 10-season minimum.</p>
     `;
     return;
   }

   const n=Number(value);
   const b=findPlayerPeak(player,n);
   if(!b){
     result.innerHTML=`<div class="peak-warning">${player} does not have ${n} consecutive qualified seasons in the dataset.</div>`;
     return;
   }
   result.innerHTML=`
     <div class="peak-main">
       <div class="peak-kicker">${player} · highest ${n}-season average</div>
       <div class="peak-player">${b.player}</div>
       <div class="peak-years">${b.start}${n>1?"–"+b.end:" season"}</div>
       <div class="peak-score">${fmt(b.avg,2)}</div>
       <div class="peak-score-label">Average PD+</div>
     </div>
     <div class="peak-detail">
       ${b.rows.map(d=>`<div class="peak-pill"><div class="year">${d.season}</div><div class="pd">${fmt(d.pd,2)}</div></div>`).join("")}
     </div>
     <p class="peak-explain">Every season in the selected window must be a qualified season for ${player}, with no missing years.</p>
   `;
   return;
 }

 if(value==="career"){
   const b=findCareerPeak();
   if(!b){
     result.innerHTML='<div class="peak-warning">No pitcher has at least 10 qualified seasons in the dataset.</div>';
     return;
   }
   result.innerHTML=`
     <div class="peak-main">
       <div class="peak-kicker">Highest career average · 10+ qualified seasons</div>
       <div class="peak-player">${b.player}</div>
       <div class="peak-years">${b.rows[0].season}–${b.rows[b.rows.length-1].season} · ${b.rows.length} qualified seasons</div>
       <div class="peak-score">${fmt(b.avg,2)}</div>
       <div class="peak-score-label">Average PD+</div>
     </div>
     <div class="peak-detail peak-career-detail">
       ${b.rows.map(d=>`<div class="peak-pill"><div class="year">${d.season}</div><div class="pd">${fmt(d.pd,2)}</div></div>`).join("")}
     </div>
     <p class="peak-explain">Career mode considers only pitchers with at least 10 qualified seasons and averages every qualified season for each eligible pitcher.</p>
   `;
   return;
 }

 const n=Number(value);
 const b=findPeak(n);
 if(!b){
   result.innerHTML=`<div class="peak-warning">No pitcher has ${n} consecutive qualified seasons in the dataset.</div>`;
   return;
 }
 result.innerHTML=`
   <div class="peak-main">
     <div class="peak-kicker">Highest ${n}-season average</div>
     <div class="peak-player">${b.player}</div>
     <div class="peak-years">${b.start}${n>1?"–"+b.end:" season"}</div>
     <div class="peak-score">${fmt(b.avg,2)}</div>
     <div class="peak-score-label">Average PD+</div>
   </div>
   <div class="peak-detail">
     ${b.rows.map(d=>`<div class="peak-pill"><div class="year">${d.season}</div><div class="pd">${fmt(d.pd,2)}</div></div>`).join("")}
   </div>
   <p class="peak-explain">Every season in the selected window must be a qualified season for the same pitcher, with no missing years.</p>
 `;
}

/* PD+ Head-to-Head Comparison functions */
const hhComponents=[
  ["ERA Z-Score","eraz"],
  ["K-BB% Z-Score","kbbz"],
  ["BAA Z-Score","baaz"],
  ["HR/9 Z-Score","hr9z"],
  ["IP Z-Score","ipz"],
  ["WPA Z-Score","wpaz"]
];

function hhById(id){return document.getElementById(id);}
function hhEsc(v){
  return String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function hhNorm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
const hhPlayers=[...new Set(DATA.map(d=>d.player))].sort((a,b)=>a.localeCompare(b));

function hhCanonical(value){
  const n=hhNorm(value);
  if(!n)return "";
  return hhPlayers.find(p=>hhNorm(p)===n)||"";
}
function hhRowsFor(player){
  return DATA.filter(d=>d.player===player).sort((a,b)=>a.season-b.season);
}
function hhOther(side){return side===1?2:1;}
function hhSelectedSeason(side){
  const v=hhById("hhSeason"+side).value;
  return v===""?null:Number(v);
}
function hhGetRow(side){
  const player=hhCanonical(hhById("hhPitcher"+side).value);
  const season=hhSelectedSeason(side);
  if(!player||season===null)return null;
  return DATA.find(d=>d.player===player&&Number(d.season)===season)||null;
}
function hhShowSuggestions(side){
  const input=hhById("hhPitcher"+side), box=hhById("hhSuggestions"+side);
  const q=hhNorm(input.value);
  if(!q){
    box.innerHTML="";
    box.style.display="none";
    return;
  }

  // Match every word typed, ignoring accents and punctuation. Prefer names
  // whose normalized name starts with the search text, then fall back to
  // names containing all of the typed words.
  const parts=q.split(/\s+/).filter(Boolean);
  const matches=hhPlayers.filter(p=>{
    const n=hhNorm(p);
    return parts.every(part=>n.includes(part));
  }).sort((a,b)=>{
    const an=hhNorm(a), bn=hhNorm(b);
    const ap=an.startsWith(q)?0:1, bp=bn.startsWith(q)?0:1;
    if(ap!==bp)return ap-bp;
    return an.localeCompare(bn);
  }).slice(0,10);

  if(!matches.length){
    box.innerHTML="";
    box.style.display="none";
    return;
  }

  box.innerHTML=matches.map((p,i)=>
    `<div class="hh-suggestion${i===0?" active":""}" role="option" data-name="${hhEsc(p)}">${hhEsc(p)}</div>`
  ).join("");
  box.style.display="block";

  box.querySelectorAll(".hh-suggestion").forEach(el=>{
    el.addEventListener("mousedown",e=>{
      // mousedown fires before the input's blur event, so select the name
      // without losing the suggestion list first.
      e.preventDefault();
      input.value=el.dataset.name;
      box.style.display="none";
      hhPopulate(side,false);
      hhRefreshOther(side);
    });
  });
}
function hhHideSuggestions(side){
  setTimeout(()=>{hhById("hhSuggestions"+side).style.display="none";},120);
}
function hhPopulate(side,preserve=true){
  const input=hhById("hhPitcher"+side), select=hhById("hhSeason"+side);
  const old=hhSelectedSeason(side), player=hhCanonical(input.value);
  if(!player){
    select.disabled=true;
    select.innerHTML='<option value="">Choose a pitcher above</option>';
    hhRender(side,null);hhUpdate();return;
  }
  input.value=player;
  const other=hhOther(side);
  const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
  const blocked=otherPlayer===player?hhSelectedSeason(other):null;
  const rows=hhRowsFor(player);
  select.disabled=false;
  select.innerHTML='<option value="">Choose a season</option>'+rows.map(d=>{
    const off=blocked!==null&&Number(d.season)===blocked;
    return `<option value="${d.season}"${off?" disabled":""}>${d.season}${off?" — already selected":""}</option>`;
  }).join("");
  if(preserve&&old!==null){
    const opt=[...select.options].find(o=>Number(o.value)===old);
    if(opt&&!opt.disabled)select.value=String(old);
  }
  hhRender(side,hhGetRow(side));hhUpdate();
}
function hhRender(side,row){
  const el=hhById("hhResult"+side);
  if(!row){
    el.innerHTML='<div class="hh-result-empty">Choose a season to display the PD+ value.</div>';
    return;
  }
  el.innerHTML=`<div class="hh-result-player">${hhEsc(row.player)}</div>
    <div class="hh-result-season">${row.season} season · ${hhEsc(row.team)}</div>
    <div class="hh-result-pd">${Number(row.pd).toFixed(2)}</div>
    <div class="hh-result-label">Pitching Dominance+</div>
    <div class="hh-result-meta">Qualified pitcher-season</div>`;
}
function hhRefreshOther(side){
  const other=hhOther(side);
  const p=hhCanonical(hhById("hhPitcher"+side).value);
  const op=hhCanonical(hhById("hhPitcher"+other).value);
  if(p&&p===op)hhPopulate(other,true);
}
function hhUpdate(){
  const a=hhGetRow(1),b=hhGetRow(2),el=hhById("hhComparison");
  // Keep the Component Breakdown permanently open. It only fills in once
  // both pitcher-seasons have been selected.
  el.style.display="";
  if(!a||!b){
    hhById("hhHead1").textContent="Pitcher 1";
    hhById("hhHead2").textContent="Pitcher 2";
    hhById("hhComponentBody").innerHTML=hhComponents.map(([label])=>
      `<tr><td class="hh-component">${label}</td><td class="hh-breakdown-empty">—</td><td class="hh-breakdown-empty">—</td><td class="hh-breakdown-empty">—</td></tr>`
    ).join("");
    hhById("hhWinnerLine").innerHTML=`<strong>Higher PD+:</strong> — · Difference: —`;
    return;
  }
  hhById("hhHead1").textContent=`${a.player} ${a.season}`;
  hhById("hhHead2").textContent=`${b.player} ${b.season}`;
  hhById("hhComponentBody").innerHTML=hhComponents.map(([label,key])=>{
    const av=Number(a[key]),bv=Number(b[key]);
    const higher=Math.abs(av-bv)<1e-12?"Tie":(av>bv?a.player:b.player);
    return `<tr>
      <td class="hh-component">${label}</td>
      <td class="${av>=bv?"hh-higher":""}">${av.toFixed(2)}</td>
      <td class="${bv>=av?"hh-higher":""}">${bv.toFixed(2)}</td>
      <td class="hh-higher">${hhEsc(higher)}</td>
    </tr>`;
  }).join("");
  const diff=Math.abs(Number(a.pd)-Number(b.pd));
  const winner=Math.abs(Number(a.pd)-Number(b.pd))<1e-9?"Tie":(Number(a.pd)>Number(b.pd)?a.player:b.player);
  const winnerSeason=winner==="Tie"?"":(winner===a.player?` (${a.season})`:` (${b.season})`);
  hhById("hhWinnerLine").innerHTML=`<strong>Higher PD+:</strong> ${hhEsc(winner)}${winnerSeason} · Difference: <strong>${diff.toFixed(2)}</strong>`;
  syncBottomAlignment();
}

/* Historical Cy Young Prediction (year/league picker) */
const CY_YEARS=Array.from({length:52},(_,i)=>2025-i);
const CY_YEAR_OVERRIDES={"1984|NL":{player:"Rick Sutcliffe",team:"CLE/CHC",pd:105.8640976,league:"NL",isReliever:false},"1996|AL":{player:"Pat Hentgen",team:"TOR",pd:113.1276445,league:"AL",isReliever:false}};
let cyDecadeSelect=null,cyYearSelect=null,cyLeagueSelect=null,cyResult=null,cyVerdict=null,cyReset=null;

function cyBlankResult(){
  cyResult.innerHTML='<div class="cy-grid"><div class="cy-panel"><div class="cy-panel-kicker">Highest PD+ pitcher</div></div><div class="cy-panel"><div class="cy-panel-kicker">Actual Cy Young winner</div></div></div>';
  cyVerdict.innerHTML='<strong>PD+ vs. Cy Young Voters</strong>';
}

function populateCYYears(){
  const decade=Number(cyDecadeSelect.value);
  cyYearSelect.innerHTML='<option value="">Choose year</option>';
  if(!decade){
    cyYearSelect.disabled=true;
    cyBlankResult();
    return;
  }
  const start=decade===1970?1974:decade;
  const end=decade===2020?2025:decade+9;
  for(let y=start;y<=end;y++){
    const opt=document.createElement("option");
    opt.value=String(y);
    opt.textContent=String(y);
    cyYearSelect.appendChild(opt);
  }
  cyYearSelect.disabled=false;
  cyBlankResult();
}

function findCYActual(year,league){
  const ov=CY_YEAR_OVERRIDES[`${year}|${league}`];
  if(ov)return ov;
  const d=DATA.find(x=>Number(x.season)===Number(year)&&String(x.lg)===league&&Number(x.cy)===1);
  if(d)return {player:d.player,team:d.team,pd:d.pd,isReliever:false};
  const rel=RELIEVER_CY_YOUNGS.find(x=>Number(x.year)===Number(year)&&String(x.league)===league&&Number(x.cy)===1);
  return rel?{player:rel.player,team:rel.team,pd:null,isReliever:true}:null;
}

function renderCYPrediction(){
  const year=Number(cyYearSelect.value);
  const league=cyLeagueSelect.value;

  if(!year||!league){
    cyBlankResult();
    return;
  }

  const candidates=DATA.filter(d=>Number(d.season)===year&&String(d.lg)===league);
  const leader=candidates.length?candidates.reduce((a,b)=>Number(b.pd)>Number(a.pd)?b:a):null;
  const actual=findCYActual(year,league);

  if(!leader&&!actual){
    cyBlankResult();
    return;
  }

  let h='<div class="cy-grid">';
  h+='<div class="cy-panel"><div class="cy-panel-kicker">Highest PD+ pitcher</div>'+
    (leader?`<div class="cy-player">${leader.player}</div><div class="cy-meta">${year} ${league} \u00b7 ${leader.team}</div><div class="cy-score">${fmt(leader.pd,2)}</div><div class="cy-score-label">PD+</div>`:'')+
    '</div>';

  h+='<div class="cy-panel"><div class="cy-panel-kicker">Actual Cy Young winner</div>'+
    (actual?`<div class="cy-player">${actual.player}</div><div class="cy-meta">${year} ${league} \u00b7 ${actual.team}</div>`:'')+
    (actual&&actual.isReliever
      ?'<div class="cy-disclaimer">This Cy Young was won by a reliever who did not qualify for the dataset and therefore does not have a PD+ value for comparison.</div>'
      :(actual?`<div class="cy-score">${fmt(actual.pd,2)}</div><div class="cy-score-label">PD+</div>`:'')
    )+
    '</div></div>';

  if(leader&&actual){
    const same=leader.player===actual.player;
    cyVerdict.innerHTML=`<strong>PD+ vs. Cy Young Voters: ${same?'AGREE':'DISAGREE'}</strong>${same?`${leader.player} had the highest PD+ in the ${year} ${league} and also won the Cy Young.`:`The highest-PD+ pitcher was ${leader.player}, while the Cy Young winner was ${actual.player}.`}`;
  }else{
    cyVerdict.innerHTML='<strong>PD+ vs. Cy Young Voters</strong>';
  }

  cyResult.innerHTML=h;
}

function initCyYoungPredictor(){
  cyDecadeSelect=document.getElementById("cyDecade");
  if(!cyDecadeSelect) return;
  cyYearSelect=document.getElementById("cyYear");
  cyLeagueSelect=document.getElementById("cyLeague");
  cyResult=document.getElementById("cyResult");
  cyVerdict=document.getElementById("cyVerdict");
  cyReset=document.getElementById("cyReset");
  cyDecadeSelect.addEventListener("change",populateCYYears);
  cyYearSelect.addEventListener("change",renderCYPrediction);
  cyLeagueSelect.addEventListener("change",renderCYPrediction);
  cyReset.addEventListener("click",()=>{
    cyDecadeSelect.value="";
    cyYearSelect.innerHTML='<option value="">Choose year</option>';
    cyYearSelect.disabled=true;
    cyLeagueSelect.value="";
    cyBlankResult();
  });
  cyBlankResult();
}

/* PD+ by Decade (era comparison) */
function renderPDEra(){
  const el=document.getElementById("pdEraSelect");
  if(!el) return;
  const start=Number(el.value);
  const rows=PD_ERA_DATA.filter(r=>r.year>=Math.max(1974,start)&&r.year<=start+9);
  const pds=rows.map(r=>r.pd);
  const avg=pds.reduce((a,b)=>a+b,0)/pds.length;
  const range=Math.max(...pds)-Math.min(...pds);
  const best=rows.reduce((a,b)=>b.pd>a.pd?b:a);
  const n100=pds.filter(x=>x>=100).length;
  const n115=pds.filter(x=>x>=115).length;
  const n130=pds.filter(x=>x>=130).length;

  document.getElementById("pdEraStats").innerHTML=`
    <div class="pd-era-stat">
      <div class="label">Average PD+</div>
      <div class="value">${avg.toFixed(1)}</div>
      <div class="sub">All pitcher-seasons</div>
    </div>
    <div class="pd-era-stat">
      <div class="label">PD+ Range</div>
      <div class="value">${range.toFixed(1)}</div>
      <div class="sub">All pitcher-seasons</div>
    </div>
    <div class="pd-era-stat">
      <div class="label">Highest PD+</div>
      <div class="value">${best.pd.toFixed(1)}</div>
      <div class="sub">${best.player} \u00b7 ${best.year}</div>
    </div>
    <div class="pd-era-stat">
      <div class="label">PD+ 100+ Seasons</div>
      <div class="value">${n100}</div>
      <div class="sub">PD+ \u2265 100</div>
    </div>
    <div class="pd-era-stat">
      <div class="label">PD+ 115+ Seasons</div>
      <div class="value">${n115}</div>
      <div class="sub">PD+ \u2265 115</div>
    </div>
    <div class="pd-era-stat">
      <div class="label">PD+ 130+ Seasons</div>
      <div class="value">${n130}</div>
      <div class="sub">PD+ \u2265 130</div>
    </div>`;

  const top=[...rows].sort((a,b)=>b.pd-a.pd).slice(0,5);
  document.getElementById("pdEraTopSeasons").innerHTML=top.map((r,i)=>`
    <div class="pd-era-best">
      <div>
        <div class="player">${i+1}. ${r.player}</div>
        <div class="season">${r.year}</div>
      </div>
      <div class="pd">${r.pd.toFixed(1)}</div>
    </div>`).join("");
}
function initEraComparison(){
  const el=document.getElementById("pdEraSelect");
  if(!el) return;
  el.addEventListener("change",renderPDEra);
  renderPDEra();
}

/* PD+ Component Leaders -- #1 all-time z-score in each component.
   Computed live from DATA (previously a hardcoded snapshot). */
function computeComponentLeaders(){
  const components=[["ERA Z-Score","eraz"],["K-BB% Z-Score","kbbz"],["BAA Z-Score","baaz"],["HR/9 Z-Score","hr9z"],["IP Z-Score","ipz"],["WPA Z-Score \u00b7 Clutch","wpaz"]];
  return components.map(([label,key])=>{
    const top=DATA.reduce((a,b)=>(b[key]??-Infinity)>(a[key]??-Infinity)?b:a);
    return {label,player:top.player,season:top.season,score:top[key]};
  });
}
function initComponentLeaders(){
  const el=document.getElementById("componentLeadersGrid");
  if(!el) return;
  const leaders=computeComponentLeaders();
  el.innerHTML=leaders.map(l=>`<div class="component-leader-card">
  <div class="component-leader-label">${l.label}</div>
  <div class="component-leader-player">${l.player}</div>
  <div class="component-leader-season">${l.season} season</div>
  <div class="component-leader-score">${fmt(l.score,2)}</div>
  <div class="component-leader-rank">#1 overall in the ${DATA.length.toLocaleString()} qualified pitcher-seasons</div>
</div>`).join("");
}

/* ===== Page init functions ===== */
/* Each checks its own key element before doing anything, so it's safe
   to call every init function unconditionally on every page. */

function initHome(){
  if(!byId("leaderTable")) return;
  fillSelect("from");fillSelect("to");
  byId("from").value=seasons[0];byId("to").value=seasons.at(-1);
  document.querySelectorAll("#leaderTable th").forEach(th=>th.onclick=()=>{const k=th.dataset.key;if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=1}renderTable()});
  ["search","from","to","minpd","maxpd"].forEach(id=>byId(id).addEventListener("input",applyFilters));
  byId("reset").onclick=()=>{byId("search").value="";byId("from").value=seasons[0];byId("to").value=seasons.at(-1);byId("minpd").value=0;byId("maxpd").value="";applyFilters()};
  window.onresize=renderScatter;
  renderTop();
  applyFilters();
  profile(DATA.slice().sort((a,b)=>b.pd-a.pd)[0].id);
}

function initPeakFinder(){
  if(!byId("pdPeakResult")) return;
  byId("pdPeakLength").addEventListener("change",renderPeakFinder);
  byId("pdPeakSearch").addEventListener("input",renderPeakSearchSuggestions);
  byId("pdPeakSearch").addEventListener("focus",renderPeakSearchSuggestions);
  byId("pdPeakClear").addEventListener("click",clearPeakPlayer);
  document.addEventListener("click",e=>{
    if(!byId("pdPeakSuggestions")) return;
    if(!e.target.closest(".peak-search-control")) byId("pdPeakSuggestions").style.display="none";
  });
  renderPeakFinder();
}

function initHeadToHead(){
  if(!hhById("hhPitcher1")) return;
  [1,2].forEach(side=>{
    const input=hhById(`hhPitcher${side}`);
    const select=hhById(`hhSeason${side}`);
    input.addEventListener("input",()=>{
      hhShowSuggestions(side);
      const player=hhCanonical(input.value);
      if(player===hhCanonical(input.value) && input.value.trim() && player){
        hhPopulate(side,false);
      } else if(!input.value.trim()){
        hhPopulate(side,false);
      }
    });
    input.addEventListener("focus",()=>hhShowSuggestions(side));
    input.addEventListener("blur",()=>hhHideSuggestions(side));
    select.addEventListener("change",()=>{
      hhRender(side,hhGetRow(side));
      hhUpdate();
    });
  });
  hhUpdate();
}

function initCyYoungLeaders(){
  if(!byId("pdCyYoungLeaderboardBody")) return;
  renderCyYoungLeaders();
}

function initCy2026Predictions(){
  if(!byId("cyPredAL")) return;
  renderCy2026Predictions();
}

/* Run every page init. Each one is a no-op if its markup isn't on the page. */
initHome();
initPeakFinder();
initHeadToHead();
initCyYoungPredictor();
initCyYoungLeaders();
initCy2026Predictions();
initEraComparison();
initComponentLeaders();
