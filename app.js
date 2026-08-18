/* ===== PD+ shared app logic =====
   Loaded on every page after data.js. All DOM wiring lives in init*()
   functions that check their own elements exist before doing anything,
   so it's safe to call every init function on every page. */

let filtered=DATA.slice(),sortKey="rank",sortDir=1;
const fmt=(x,d=2)=>x==null||Number.isNaN(x)?"—":Number(x).toFixed(d); const fmtBAA=(x)=>x==null||Number.isNaN(x)?"—":Number(x).toFixed(3).replace(/^(-?)0\./,"$1.");
const seasons=[...new Set(DATA.map(d=>d.season))].sort((a,b)=>a-b);
const CURRENT_SEASON=seasons[seasons.length-1];
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
   ["WPA Component","wpaz"]
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
function row(d){return `<tr data-id="${d.id}"><td>${d.rank}</td><td>${d.season}</td><td>${d.player}</td><td>${d.team}</td><td><b>${fmt(d.pd,2)}</b></td><td>${fmt(d.war,1)}</td><td>${fmt(d.era,2)}</td><td>${fmt(d.kbb,1)}%</td><td>${fmtBAA(d.baa)}</td><td>${fmt(d.hr9,2)}</td><td>${fmt(d.ip,1)}</td><td>${fmt(d.wpa,2)}</td></tr>`}
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

/* GOATs of PD+ -- a fixed, curated set of three all-time greats. Who's
   included is hardcoded by design, but every stat shown for them is
   computed live from DATA, not hardcoded, so it stays accurate as the
   dataset refreshes. Reuses CAREER_SPANS (defined further below) and the
   same hypothetical-Cy-Young logic as computeCyYoungLeaders. */
const GOAT_PLAYERS=["Pedro Martínez","Randy Johnson","Roger Clemens"];
function computeGoatsData(){
  const cyLeaders=computeCyYoungLeaders(0);
  const cyByPlayer=new Map(cyLeaders.map(p=>[p.player,p]));
  const results=GOAT_PLAYERS.map(player=>{
    const rows=DATA.filter(d=>d.player===player);
    const avg=rows.reduce((a,b)=>a+b.pd,0)/rows.length;
    const best=rows.reduce((a,b)=>b.pd>a.pd?b:a);
    const realCY=rows.filter(d=>d.cy===1).length;
    const cyInfo=cyByPlayer.get(player);
    const hypoCY=cyInfo?cyInfo.count:0;
    const hypoYears=cyInfo?cyInfo.wins.map(w=>w.season):[];
    const span=CAREER_SPANS[player];
    return{
      player,
      span:span?`${span[0]}\u2013${span[1]==null?"Present":span[1]}`:"",
      seasons:rows.length,
      avg,
      bestSeason:best.season,
      bestPd:best.pd,
      realCY,hypoCY,
      net:hypoCY-realCY,
      hypoYears
    };
  });
  results.sort((a,b)=>b.avg-a.avg);
  return results;
}
function renderGoats(){
  const el=byId("goatsGrid");
  if(!el)return;
  const data=computeGoatsData();
  el.innerHTML=data.map((p,i)=>{
    const netLabel=p.net>0?`+${p.net}`:(p.net<0?`\u2212${Math.abs(p.net)}`:"0");
    return`<div class="goat-card">
    <div class="goat-rank">#${i+1}</div>
    <div class="goat-name">${p.player}</div>
    <div class="goat-span">${p.span}</div>
    <div class="goat-avg-block">
      <div class="goat-avg">${fmt(p.avg,2)}</div>
      <div class="goat-avg-label">Career Average PD+</div>
      <div class="goat-avg-sub">${p.seasons} qualified seasons</div>
    </div>
    <div class="goat-stat-block">
      <div class="goat-stat-label">Best Season</div>
      <div class="goat-stat-value">${p.bestSeason} \u00b7 ${fmt(p.bestPd,2)} PD+</div>
    </div>
    <div class="goat-cy-row">
      <div class="goat-cy-item"><div class="goat-cy-num">${p.hypoCY}</div><div class="goat-cy-label">PD+ CYs</div></div>
      <div class="goat-cy-item"><div class="goat-cy-num">${p.realCY}</div><div class="goat-cy-label">Real CYs</div></div>
      <div class="goat-cy-item"><div class="goat-cy-net">${netLabel}</div><div class="goat-cy-label">Net</div></div>
    </div>
    <div class="goat-years-block">
      <div class="goat-years-label">PD+ Cy Young Years</div>
      <div class="goat-year-chips">${p.hypoYears.map(y=>`<span class="goat-year-chip">${y}</span>`).join("")}</div>
    </div>
  </div>`;
  }).join("");
}
function initGoats(){
  if(!byId("goatsGrid"))return;
  renderGoats();
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

/* Best/Worst Net PD+ Cy Youngs -- hypothetical PD+ Cy Youngs minus real Cy Youngs.
   Career spans are researched real-world debut/final years for this specific,
   small set of players -- not derived from the qualified-seasons dataset, since
   that would understate careers by clipping non-qualifying rookie/decline years. */
const CAREER_SPANS={
  "Frank Tanana":[1973,1993],
  "Randy Johnson":[1988,2009],
  "Floyd Bannister":[1977,1992],
  "Gerrit Cole":[2013,null],
  "Justin Verlander":[2005,null],
  "Kevin Brown":[1986,2005],
  "Nolan Ryan Jr.":[1966,1993],
  "Pedro Martínez":[1992,2009],
  "Roger Clemens":[1984,2007],
  "Ron Guidry":[1975,1988],
  "Tom Seaver":[1967,1986],
  "Blake Snell":[2016,null],
  "Jim Palmer":[1965,1984],
  "Steve Carlton":[1965,1988],
  "Tom Glavine":[1987,2008]
};
function computeNetCyYoungBoards(){
  const bySeasonLg=new Map();
  DATA.forEach(d=>{
    if(d.lg!=="AL"&&d.lg!=="NL")return;
    const key=d.season+"|"+d.lg;
    const cur=bySeasonLg.get(key);
    if(!cur||d.pd>cur.pd)bySeasonLg.set(key,d);
  });
  const hypotheticalWinsByPlayer=new Map();
  bySeasonLg.forEach(d=>{
    hypotheticalWinsByPlayer.set(d.player,(hypotheticalWinsByPlayer.get(d.player)||0)+1);
  });
  const actualWinsByPlayer=new Map();
  DATA.forEach(d=>{
    if(d.cy===1)actualWinsByPlayer.set(d.player,(actualWinsByPlayer.get(d.player)||0)+1);
  });
  const allPlayers=new Set([...actualWinsByPlayer.keys(),...hypotheticalWinsByPlayer.keys()]);
  const results=[...allPlayers].map(player=>{
    const actual=actualWinsByPlayer.get(player)||0;
    const hypothetical=hypotheticalWinsByPlayer.get(player)||0;
    return{player,actual,hypothetical,net:hypothetical-actual};
  });
  const best=results.filter(r=>r.net>=2).sort((a,b)=>b.net-a.net||a.player.localeCompare(b.player));
  const worst=results.filter(r=>r.net<=-2).sort((a,b)=>a.net-b.net||a.player.localeCompare(b.player));
  return{best,worst};
}
function netCySpanText(player){
  const span=CAREER_SPANS[player];
  if(!span)return"";
  const[start,end]=span;
  return`${start}\u2013${end==null?"Present":end}`;
}
function netCyRowHTML(r,cls){
  const span=netCySpanText(r.player);
  const netLabel=r.net>0?`+${r.net}`:`\u2212${Math.abs(r.net)}`;
  return`<div class="net-row ${cls}">
    <div>
      <div class="net-name-line"><span class="net-name">${r.player}</span>${span?`<span class="net-span">${span}</span>`:""}</div>
      <div class="net-breakdown">${r.hypothetical} PD+ Cy Young${r.hypothetical===1?"":"s"} \u00b7 ${r.actual} real Cy Young${r.actual===1?"":"s"}</div>
    </div>
    <div class="net-value">${netLabel}</div>
  </div>`;
}
function renderNetCyYoungBoards(){
  const bestEl=document.getElementById("cyNetBest");
  const worstEl=document.getElementById("cyNetWorst");
  if(!bestEl||!worstEl)return;
  const{best,worst}=computeNetCyYoungBoards();
  bestEl.innerHTML=best.map(r=>netCyRowHTML(r,"net-positive")).join("");
  worstEl.innerHTML=worst.map(r=>netCyRowHTML(r,"net-negative")).join("");
}
function initNetCyYoungBoards(){
  if(!document.getElementById("cyNetBest"))return;
  renderNetCyYoungBoards();
}

/* Best Non-Cy Young Seasons by PD+ -- top 5 PD+ seasons that didn't win the
   real award, excluding the current in-progress season (which would otherwise
   always trivially qualify since no winner's been decided yet). Voting
   finishes are researched real-world facts for this specific, small set of
   seasons -- not derivable from the dataset itself. */
const CY_VOTING_FINISHES={
  "2002|Pedro Martínez":{ordinal:"2nd",aheadPlayers:["Barry Zito"]},
  "2004|Randy Johnson":{ordinal:"2nd",aheadPlayers:["Roger Clemens"]},
  "1997|Randy Johnson":{ordinal:"2nd",aheadPlayers:["Roger Clemens"]},
  "2003|Pedro Martínez":{ordinal:"3rd",aheadPlayers:["Roy Halladay","Esteban Loaiza"]},
  "2019|Gerrit Cole":{ordinal:"2nd",aheadPlayers:["Justin Verlander"]}
};
function computeBestNonCyYoung(){
  return DATA.filter(d=>d.cy!==1&&d.lg!=="2LG"&&d.season!==CURRENT_SEASON)
    .sort((a,b)=>b.pd-a.pd)
    .slice(0,5);
}
function bcyVoteText(season,player){
  const info=CY_VOTING_FINISHES[`${season}|${player}`];
  if(!info)return"Voting finish not yet added.";
  return`Finished ${info.ordinal}, behind ${info.aheadPlayers.map(p=>`<b>${p}</b>`).join(" &amp; ")}`;
}
function renderBestNonCyYoung(){
  const el=byId("bestNonCyYoung");
  if(!el)return;
  const rows=computeBestNonCyYoung();
  el.innerHTML=rows.map((d,i)=>`<div class="bcy-row">
    <div class="bcy-rank">${i+1}</div>
    <div>
      <div class="bcy-player-line">${d.player}<span class="bcy-meta">${d.season} ${d.lg} \u00b7 ${d.team}</span></div>
      <div class="bcy-vote">${bcyVoteText(d.season,d.player)}</div>
    </div>
    <div class="bcy-value">${fmt(d.pd,2)}</div>
  </div>`).join("");
}
function initBestNonCyYoung(){
  if(!byId("bestNonCyYoung"))return;
  renderBestNonCyYoung();
}

function renderCurrentSeasonPredictions(){
  const pool=DATA.filter(d=>d.season===CURRENT_SEASON);
  const components=[["ERA","eraz"],["K-BB%","kbbz"],["BAA","baaz"],["HR/9","hr9z"],["IP","ipz"],["WPA","wpaz"]];
  function rankIn(list,key,val){return list.filter(d=>d[key]>val).length+1}
  function panelHTML(lg,label){
    const lgPool=pool.filter(d=>d.lg===lg).sort((a,b)=>b.pd-a.pd);
    if(!lgPool.length) return `<div class="cy-panel-kicker">${label}</div><p class="note">No qualified ${CURRENT_SEASON} pitchers yet.</p>`;
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
      <div class="cy-meta">${CURRENT_SEASON} ${lg} · ${winner.team}</div>
      <div class="cy-score-row"><div class="cy-score">${fmt(winner.pd,2)}</div><div class="cy-score-label">PD+</div></div>
      <div class="cy-rank">#${winner.rank} since 1974</div>
      <div class="cy26-breakdown">
        <div class="cy26-breakdown-title">${CURRENT_SEASON} Component Breakdown</div>
        <div class="cy26-component-list">${rows}</div>
        <div class="cy26-breakdown-foot">Out of ${pool.length} qualified pitchers in ${CURRENT_SEASON}.</div>
        ${runnerUp?`<div class="cy26-runner-up-box">
          <div class="cy26-runner-up-label">Runner-Up</div>
          <div class="cy26-runner-up-player">${runnerUp.player}</div>
          <div class="cy26-runner-up-pd">PD+ <strong>${fmt(runnerUp.pd,2)}</strong></div>
        </div>`:""}
      </div>`;
  }
  const headingEl=byId("cySeasonHeading");
  if(headingEl) headingEl.textContent=`${CURRENT_SEASON} PD+ Cy Young Predictions`;
  const subtitleEl=byId("cySeasonSubtitle");
  if(subtitleEl) subtitleEl.textContent=`The highest-PD+ pitcher currently in each league, based on the ${CURRENT_SEASON} data in the dashboard.`;
  const alEl=byId("cyPredAL"),nlEl=byId("cyPredNL");
  if(alEl) alEl.innerHTML=panelHTML("AL","American League");
  if(nlEl) nlEl.innerHTML=panelHTML("NL","National League");
}
function renderTop(){
 const rows=DATA.slice().sort((a,b)=>b.pd-a.pd).slice(0,15);
 byId("topTable").querySelector("tbody").innerHTML=rows.map(d=>{
   const won=d.cy===1;
   const ongoing=d.season===CURRENT_SEASON;
   let signifier="—";
   if(won) signifier='<span class="pill" title="Cy Young Award winner">CY</span>';
   if(ongoing) signifier=`<span class="pill" title="${CURRENT_SEASON} season is ongoing">LIVE</span>`;
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
const hhAvgKeys=["pd","eraz","kbbz","baaz","hr9z","ipz","wpaz"];

function hhById(id){return document.getElementById(id);}
function hhEsc(v){
  return String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function hhNorm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
const hhPlayers=[...new Set(DATA.map(d=>d.player))].sort((a,b)=>a.localeCompare(b));
let hhMode="";

function hhCanonical(value){
  const n=hhNorm(value);
  if(!n)return "";
  return hhPlayers.find(p=>hhNorm(p)===n)||"";
}
function hhRowsFor(player){
  return DATA.filter(d=>d.player===player).sort((a,b)=>a.season-b.season);
}
function hhPlayerYears(player){
  return hhRowsFor(player).map(d=>Number(d.season));
}
function hhOther(side){return side===1?2:1;}
function hhAvgRow(rows){
  const out={};
  hhAvgKeys.forEach(k=>{
    const vals=rows.map(r=>Number(r[k])).filter(v=>!Number.isNaN(v));
    out[k]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  });
  return out;
}
function hhFmt(v){return v==null||Number.isNaN(v)?"\u2014":Number(v).toFixed(2);}

function hhGetValue(side){
  const player=hhCanonical(hhById("hhPitcher"+side).value);
  if(!player)return null;
  if(hhMode==="season"){
    const selEl=hhById("hhSeason"+side);
    if(!selEl||!selEl.value)return null;
    const season=Number(selEl.value);
    const row=DATA.find(d=>d.player===player&&Number(d.season)===season);
    if(!row)return null;
    return {
      player,
      yearLabel:String(row.season),
      subtitle:`${row.season} season \u00b7 ${row.team}`,
      pd:Number(row.pd),eraz:Number(row.eraz),kbbz:Number(row.kbbz),baaz:Number(row.baaz),hr9z:Number(row.hr9z),ipz:Number(row.ipz),wpaz:Number(row.wpaz)
    };
  }
  if(hhMode==="span"){
    const s=hhById("hhStart"+side), e=hhById("hhEnd"+side);
    if(!s||!e||!s.value||!e.value)return null;
    const start=Number(s.value), end=Number(e.value);
    const rows=hhRowsFor(player).filter(d=>Number(d.season)>=start&&Number(d.season)<=end);
    if(!rows.length)return null;
    const avg=hhAvgRow(rows);
    return {
      player,
      yearLabel:`${start}\u2013${end}`,
      subtitle:`${start}\u2013${end} span`,
      seasonCount:rows.length,
      qualifyingYears:rows.map(d=>d.season),
      ...avg
    };
  }
  if(hhMode==="career"){
    const other=hhOther(side);
    const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
    if(player===otherPlayer)return null;
    const rows=hhRowsFor(player);
    if(!rows.length)return null;
    const avg=hhAvgRow(rows);
    return {
      player,
      yearLabel:"",
      subtitle:`Career \u00b7 ${rows.length} qualified season${rows.length===1?"":"s"}`,
      ...avg
    };
  }
  return null;
}

function hhEmptyMessage(side){
  const typed=hhById("hhPitcher"+side).value.trim();
  if(hhMode==="career"&&typed){
    const player=hhCanonical(typed);
    const other=hhOther(side);
    const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
    if(player&&player===otherPlayer){
      return "Already selected as the other pitcher \u2014 career mode compares two different pitchers.";
    }
  }
  if(hhMode==="season")return "Search for a pitcher, then choose a season.";
  if(hhMode==="span")return "Search for a pitcher, then choose a start and end year.";
  if(hhMode==="career")return "Search for a pitcher to see career averages.";
  return "";
}
function hhModeMeta(){
  if(hhMode==="season")return "Qualified pitcher-season";
  if(hhMode==="span")return "Average across qualified seasons in range";
  if(hhMode==="career")return "Average across all qualified seasons";
  return "";
}
function hhHowWorksText(){
  if(hhMode==="season")return "Choose a qualified pitcher-season on each side. The component rows compare the six standardized z-scores that make up PD+.";
  if(hhMode==="span")return "Choose a pitcher and a year range on each side. The component rows compare each pitcher's average z-scores across their qualified seasons within that range.";
  if(hhMode==="career")return "Choose a pitcher on each side. The component rows compare each pitcher's average z-scores across their full set of qualified seasons.";
  return "";
}

function hhRender(side,val){
  const el=hhById("hhResult"+side);
  if(!val){
    el.innerHTML=`<div class="hh-result-empty">${hhEsc(hhEmptyMessage(side))}</div>`;
    return;
  }
  let subtitleHTML=hhEsc(val.subtitle);
  if(val.qualifyingYears){
    subtitleHTML+=` \u00b7 <span class="hh-season-count" tabindex="0">${val.seasonCount} season${val.seasonCount===1?"":"s"}<span class="hh-season-tooltip">${val.qualifyingYears.join(", ")}</span></span>`;
  }
  el.innerHTML=`<div class="hh-result-player">${hhEsc(val.player)}</div>
    <div class="hh-result-season">${subtitleHTML}</div>
    <div class="hh-result-pd">${hhFmt(val.pd)}</div>
    <div class="hh-result-label">Pitching Dominance+</div>
    <div class="hh-result-meta">${hhModeMeta()}</div>`;
}

function hhShowSuggestions(side){
  const input=hhById("hhPitcher"+side), box=hhById("hhSuggestions"+side);
  const q=hhNorm(input.value);
  if(!q){
    box.innerHTML="";
    box.style.display="none";
    return;
  }
  let pool=hhPlayers;
  if(hhMode==="career"){
    const other=hhOther(side);
    const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
    if(otherPlayer)pool=hhPlayers.filter(p=>p!==otherPlayer);
  }

  const parts=q.split(/\s+/).filter(Boolean);
  const matches=pool.filter(p=>{
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
      e.preventDefault();
      input.value=el.dataset.name;
      box.style.display="none";
      hhOnPitcherSelected(side);
    });
  });
}
function hhHideSuggestions(side){
  setTimeout(()=>{hhById("hhSuggestions"+side).style.display="none";},120);
}

function hhPopulateSeason(side,preserve){
  const input=hhById("hhPitcher"+side), select=hhById("hhSeason"+side);
  const old=select.value, player=hhCanonical(input.value);
  if(!player){
    select.disabled=true;
    select.innerHTML='<option value="">Choose a pitcher above</option>';
    hhRender(side,null);hhUpdate();return;
  }
  input.value=player;
  const other=hhOther(side);
  const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
  const otherSeasonEl=hhById("hhSeason"+other);
  const blocked=(otherPlayer===player&&otherSeasonEl&&otherSeasonEl.value)?Number(otherSeasonEl.value):null;
  const rows=hhRowsFor(player);
  select.disabled=false;
  select.innerHTML='<option value="">Choose a season</option>'+rows.map(d=>{
    const off=blocked!==null&&Number(d.season)===blocked;
    return `<option value="${d.season}"${off?" disabled":""}>${d.season}${off?" \u2014 already selected":""}</option>`;
  }).join("");
  if(preserve&&old){
    const opt=[...select.options].find(o=>o.value===old);
    if(opt&&!opt.disabled)select.value=old;
  }
  hhRender(side,hhGetValue(side));hhUpdate();
}

function hhValidStart(y,end,win){
  if(y>=end)return false;
  if(!win)return true;
  if(end>win.end)return y>win.end;
  if(end<win.start)return true;
  return false;
}
function hhValidEnd(y,start,win){
  if(y<=start)return false;
  if(!win)return true;
  if(start<win.start)return y<win.start;
  if(start>win.end)return true;
  return false;
}
function hhOtherWindow(side){
  if(hhMode!=="span")return null;
  const other=hhOther(side);
  const player=hhCanonical(hhById("hhPitcher"+side).value);
  const otherPlayer=hhCanonical(hhById("hhPitcher"+other).value);
  if(!player||player!==otherPlayer)return null;
  const s=hhById("hhStart"+other), e=hhById("hhEnd"+other);
  if(!s||!e||!s.value||!e.value)return null;
  return {start:Number(s.value),end:Number(e.value)};
}
function hhBuildSpanControls(side){
  const startSel=hhById("hhStart"+side), endSel=hhById("hhEnd"+side);
  if(!startSel||!endSel)return;
  const player=hhCanonical(hhById("hhPitcher"+side).value);
  const oldStart=startSel.value, oldEnd=endSel.value;

  if(!player){
    startSel.disabled=true;endSel.disabled=true;
    startSel.innerHTML='<option value="">Choose a pitcher above</option>';
    endSel.innerHTML='<option value="">Choose a pitcher above</option>';
    return;
  }
  startSel.disabled=false;endSel.disabled=false;

  const years=hhPlayerYears(player);
  const win=hhOtherWindow(side);
  const insideWin=y=>win&&y>=win.start&&y<=win.end;

  const endVal=oldEnd?Number(oldEnd):null;
  const startOptions=years.filter(y=>{
    if(insideWin(y))return false;
    if(endVal!==null)return hhValidStart(y,endVal,win);
    return true;
  });
  startSel.innerHTML='<option value="">Start year</option>'+startOptions.map(y=>`<option value="${y}">${y}</option>`).join("");
  startSel.value=startOptions.map(String).includes(oldStart)?oldStart:"";

  const startVal=startSel.value?Number(startSel.value):null;
  const endOptions=years.filter(y=>{
    if(insideWin(y))return false;
    if(startVal!==null)return hhValidEnd(y,startVal,win);
    return true;
  });
  endSel.innerHTML='<option value="">End year</option>'+endOptions.map(y=>`<option value="${y}">${y}</option>`).join("");
  endSel.value=endOptions.map(String).includes(oldEnd)?oldEnd:"";
}

function hhPopulateCareer(side){
  const input=hhById("hhPitcher"+side);
  const player=hhCanonical(input.value);
  if(player)input.value=player;
  hhRender(side,hhGetValue(side));
  hhUpdate();
}

function hhOnPitcherSelected(side){
  if(hhMode==="season")hhPopulateSeason(side,false);
  else if(hhMode==="span"){
    hhBuildSpanControls(side);
    hhRender(side,hhGetValue(side));
    hhUpdate();
  } else if(hhMode==="career"){
    hhPopulateCareer(side);
  }
  hhRefreshOther(side);
}
function hhOnTypedInput(side){
  const val=hhById("hhPitcher"+side).value;
  const player=hhCanonical(val);
  if(player||!val.trim())hhOnPitcherSelected(side);
}
function hhRefreshOther(side){
  const other=hhOther(side);
  if(hhMode==="season"){
    hhPopulateSeason(other,true);
  } else if(hhMode==="span"){
    hhBuildSpanControls(other);
    hhRender(other,hhGetValue(other));
    hhUpdate();
  } else if(hhMode==="career"){
    hhRender(other,hhGetValue(other));
    hhUpdate();
  }
}

function hhWireSide(side){
  const input=hhById("hhPitcher"+side);
  input.addEventListener("input",()=>{
    hhShowSuggestions(side);
    hhOnTypedInput(side);
  });
  input.addEventListener("focus",()=>hhShowSuggestions(side));
  input.addEventListener("blur",()=>hhHideSuggestions(side));

  if(hhMode==="season"){
    hhById("hhSeason"+side).addEventListener("change",()=>{
      hhRender(side,hhGetValue(side));
      hhUpdate();
      hhRefreshOther(side);
    });
  } else if(hhMode==="span"){
    ["hhStart"+side,"hhEnd"+side].forEach(id=>{
      hhById(id).addEventListener("change",()=>{
        hhBuildSpanControls(side);
        hhRender(side,hhGetValue(side));
        hhUpdate();
        hhRefreshOther(side);
      });
    });
  }
}

function hhControlsHTML(side){
  if(hhMode==="season"){
    return `<div class="hh-control"><label for="hhSeason${side}">Season</label><select id="hhSeason${side}" disabled><option value="">Choose a pitcher above</option></select></div>`;
  }
  if(hhMode==="span"){
    return `<div class="hh-control"><label for="hhStart${side}">Start year</label><select id="hhStart${side}" disabled><option value="">Choose a pitcher above</option></select></div>
    <div class="hh-control"><label for="hhEnd${side}">End year</label><select id="hhEnd${side}" disabled><option value="">Choose a pitcher above</option></select></div>`;
  }
  return "";
}
function hhBodyHTML(){
  return `
  <div class="hh-compare-grid">
    <div class="hh-panel">
      <div class="hh-panel-label">Pitcher 1</div>
      <div class="hh-control">
        <label for="hhPitcher1">Search pitcher</label>
        <input id="hhPitcher1" type="text" placeholder="e.g. Pedro Martinez" autocomplete="off">
        <div id="hhSuggestions1" class="hh-suggestions"></div>
      </div>
      <div id="hhControls1"></div>
      <div id="hhResult1" class="hh-result"></div>
    </div>
    <div class="hh-panel">
      <div class="hh-panel-label">Pitcher 2</div>
      <div class="hh-control">
        <label for="hhPitcher2">Search pitcher</label>
        <input id="hhPitcher2" type="text" placeholder="e.g. Greg Maddux" autocomplete="off">
        <div id="hhSuggestions2" class="hh-suggestions"></div>
      </div>
      <div id="hhControls2"></div>
      <div id="hhResult2" class="hh-result"></div>
    </div>
  </div>

  <div class="hh-breakdown" id="hhComparison">
    <div class="hh-breakdown-title">Component Breakdown</div>
    <div class="hh-table-wrap">
      <table class="hh-table">
        <thead>
          <tr><th>Component</th><th id="hhHead1">Pitcher 1</th><th id="hhHead2">Pitcher 2</th><th>Higher</th></tr>
        </thead>
        <tbody id="hhComponentBody"></tbody>
      </table>
    </div>
    <div class="hh-winner-line" id="hhWinnerLine"></div>
    <div class="hh-how-works">
      <strong>How it works</strong>
      <span id="hhHowWorksText"></span>
    </div>
  </div>`;
}

function hhSetMode(mode){
  hhMode=mode;
  const body=hhById("hhBody");
  if(!mode){
    body.innerHTML='<div class="hh-mode-empty">Choose a compare mode above to begin.</div>';
    return;
  }
  body.innerHTML=hhBodyHTML();
  hhById("hhHowWorksText").textContent=hhHowWorksText();
  [1,2].forEach(side=>{
    hhById("hhControls"+side).innerHTML=hhControlsHTML(side);
    hhRender(side,null);
    hhWireSide(side);
  });
  hhUpdate();
}

function hhUpdate(){
  const el=hhById("hhComparison");
  if(!el)return;
  const a=hhGetValue(1),b=hhGetValue(2);
  if(!a||!b){
    hhById("hhHead1").textContent="Pitcher 1";
    hhById("hhHead2").textContent="Pitcher 2";
    hhById("hhComponentBody").innerHTML=hhComponents.map(([label])=>
      `<tr><td class="hh-component">${label}</td><td class="hh-breakdown-empty">\u2014</td><td class="hh-breakdown-empty">\u2014</td><td class="hh-breakdown-empty">\u2014</td></tr>`
    ).join("");
    hhById("hhWinnerLine").innerHTML=`<strong>Higher PD+:</strong> \u2014 \u00b7 Difference: \u2014`;
    return;
  }
  hhById("hhHead1").textContent=a.player+(a.yearLabel?` ${a.yearLabel}`:"");
  hhById("hhHead2").textContent=b.player+(b.yearLabel?` ${b.yearLabel}`:"");
  hhById("hhComponentBody").innerHTML=hhComponents.map(([label,key])=>{
    const av=a[key],bv=b[key];
    if(av==null||bv==null){
      return `<tr><td class="hh-component">${label}</td><td class="hh-breakdown-empty">\u2014</td><td class="hh-breakdown-empty">\u2014</td><td class="hh-breakdown-empty">\u2014</td></tr>`;
    }
    const higher=Math.abs(av-bv)<1e-9?"Tie":(av>bv?a.player:b.player);
    return `<tr>
      <td class="hh-component">${label}</td>
      <td class="${av>=bv?"hh-higher":""}">${av.toFixed(2)}</td>
      <td class="${bv>=av?"hh-higher":""}">${bv.toFixed(2)}</td>
      <td class="hh-higher">${hhEsc(higher)}</td>
    </tr>`;
  }).join("");
  const diff=Math.abs(a.pd-b.pd);
  const tie=diff<1e-9;
  const winnerVal=tie?null:(a.pd>b.pd?a:b);
  const winnerText=tie?"Tie":hhEsc(winnerVal.player)+(winnerVal.yearLabel?` (${hhEsc(winnerVal.yearLabel)})`:"");
  hhById("hhWinnerLine").innerHTML=`<strong>Higher PD+:</strong> ${winnerText} \u00b7 Difference: <strong>${diff.toFixed(2)}</strong>`;
}


/* Historical Cy Young Prediction (year/league picker) */
const CY_YEARS=Array.from({length:52},(_,i)=>2025-i);
const CY_YEAR_OVERRIDES={"1984|NL":{player:"Rick Sutcliffe",team:"CLE/CHC",pd:105.8637159,league:"NL",isReliever:false}};
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
function computeDecadeCyAccuracy(startYear,endYear){
  let hits=0,total=0;
  for(let year=startYear;year<=endYear;year++){
    ["AL","NL"].forEach(lg=>{
      const pool=DATA.filter(d=>d.season===year&&d.lg===lg);
      if(!pool.length)return;
      const leader=pool.reduce((a,b)=>b.pd>a.pd?b:a);
      let actualPlayer=null;
      const ov=CY_YEAR_OVERRIDES[`${year}|${lg}`];
      if(ov){
        actualPlayer=ov.player;
      }else{
        const actualWinner=DATA.find(d=>d.season===year&&d.lg===lg&&d.cy===1);
        if(actualWinner){
          actualPlayer=actualWinner.player;
        }else{
          const relieverWinner=RELIEVER_CY_YOUNGS.find(r=>r.year===year&&r.league===lg&&r.cy===1);
          if(!relieverWinner)return;
          actualPlayer=relieverWinner.player;
        }
      }
      total++;
      if(actualPlayer===leader.player)hits++;
    });
  }
  return{hits,total,pct:total?100*hits/total:null};
}
function renderPDEra(){
  const el=document.getElementById("pdEraSelect");
  if(!el) return;
  const topSection=document.querySelector("#pd-era-comparison .pd-era-top");
  const bottomSection=document.querySelector("#pd-era-comparison .pd-era-bottom");

  if(!el.value){
    document.getElementById("pdEraStats").innerHTML='<div class="pd-era-empty">Choose a decade to see its PD+ distribution.</div>';
    document.getElementById("pdEraTopSeasons").innerHTML="";
    document.getElementById("pdEraBottomSeasons").innerHTML="";
    if(topSection)topSection.style.display="none";
    if(bottomSection)bottomSection.style.display="none";
    return;
  }
  if(topSection)topSection.style.display="";
  if(bottomSection)bottomSection.style.display="";

  const start=Number(el.value);
  const startYear=Math.max(1974,start);
  const endYear=start+9;
  const rows=PD_ERA_DATA.filter(r=>r.year>=startYear&&r.year<=endYear);
  const pds=rows.map(r=>r.pd);
  const avg=pds.reduce((a,b)=>a+b,0)/pds.length;
  const range=Math.max(...pds)-Math.min(...pds);
  const accuracy=computeDecadeCyAccuracy(startYear,endYear);
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
      <div class="label">PD+ Cy Young Accuracy</div>
      <div class="value">${accuracy.pct==null?"\u2014":accuracy.pct.toFixed(0)+"%"}</div>
      <div class="sub">${accuracy.total?`${accuracy.hits} of ${accuracy.total} awards`:"No decided awards yet"}</div>
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

  const bottom=[...rows].sort((a,b)=>a.pd-b.pd).slice(0,5).map((r,i)=>({...r,rank:i+1}));
  document.getElementById("pdEraBottomSeasons").innerHTML=[...bottom].reverse().map(r=>`
    <div class="pd-era-best">
      <div>
        <div class="player">${r.rank}. ${r.player}</div>
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

/* PD+ Trend by Year -- max/average/min PD+ across all qualified pitcher-seasons
   per year, independent of the decade dropdown above. */
function renderEraTrend(){
  const el=document.getElementById("eraTrend");
  if(!el) return;
  const years=[...new Set(PD_ERA_DATA.map(d=>d.year))].sort((a,b)=>a-b);
  const maxes=[],avgs=[],mins=[];
  years.forEach(y=>{
    const vals=PD_ERA_DATA.filter(d=>d.year===y).map(d=>d.pd);
    maxes.push(Math.max(...vals));
    avgs.push(vals.reduce((a,b)=>a+b,0)/vals.length);
    mins.push(Math.min(...vals));
  });
  const traces=[
    {x:years,y:maxes,mode:"lines+markers",name:"Max",line:{color:"#2f6fed",width:2},marker:{size:4}},
    {x:years,y:avgs,mode:"lines+markers",name:"Average",line:{color:"#171717",width:2},marker:{size:4}},
    {x:years,y:mins,mode:"lines+markers",name:"Min",line:{color:"#c2703d",width:2},marker:{size:4}},
  ];
  const layout={
    margin:{l:55,r:20,t:20,b:45},
    paper_bgcolor:"#fff",plot_bgcolor:"#fff",hovermode:"x unified",
    xaxis:{title:"Season",dtick:10,tick0:1980,gridcolor:"#eee",zeroline:false},
    yaxis:{title:"PD+",gridcolor:"#eee",zeroline:false},
    font:{family:"system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",color:"#171717"},
    legend:{orientation:"h",y:-0.25}
  };
  Plotly.react(el,traces,layout,{responsive:true,displaylogo:false});
}
function initEraTrend(){
  if(!document.getElementById("eraTrend")) return;
  renderEraTrend();
}

/* PD+ Component Leaders -- #1 all-time z-score in each component.
   Computed live from DATA (previously a hardcoded snapshot). */
function computeComponentLeaders(){
  const components=[["ERA Z-Score","eraz"],["K-BB% Z-Score","kbbz"],["BAA Z-Score","baaz"],["HR/9 Z-Score","hr9z"],["IP Z-Score","ipz"],["WPA Z-Score","wpaz"]];
  return components.map(([label,key])=>{
    const top=DATA.reduce((a,b)=>(b[key]??-Infinity)>(a[key]??-Infinity)?b:a);
    return {label,player:top.player,season:top.season,score:top[key]};
  });
}
function computeOverallLeader(){
  const top=DATA.reduce((a,b)=>Number(b.compz)>Number(a.compz)?b:a);
  return {label:"Composite Z-Score",player:top.player,season:top.season,score:top.compz};
}
function initComponentLeaders(){
  const el=document.getElementById("componentLeadersGrid");
  if(!el) return;
  const leaders=computeComponentLeaders();
  const overall=computeOverallLeader();
  const cardHTML=l=>`<div class="component-leader-card">
  <div class="component-leader-label">${l.label}</div>
  <div class="component-leader-player">${l.player}</div>
  <div class="component-leader-season">${l.season} season</div>
  <div class="component-leader-score">${fmt(l.score,2)}</div>
  <div class="component-leader-rank">#1 overall in the ${DATA.length.toLocaleString()} qualified pitcher-seasons</div>
</div>`;
  const overallHTML=`<div class="component-leader-card component-leader-overall">
  <div>
    <div class="component-leader-label">${overall.label}</div>
    <div class="component-leader-player">${overall.player}</div>
    <div class="component-leader-season">${overall.season} season</div>
  </div>
  <div class="component-leader-overall-score">
    <div class="component-leader-score">${fmt(overall.score,2)}</div>
    <div class="component-leader-rank">#1 overall in the ${DATA.length.toLocaleString()} qualified pitcher-seasons</div>
  </div>
</div>`;
  el.innerHTML=leaders.map(cardHTML).join("")+overallHTML;
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
  byId("reset").onclick=()=>{byId("search").value="";byId("from").value=seasons[0];byId("to").value=seasons.at(-1);byId("minpd").value="";byId("maxpd").value="";applyFilters()};
  window.onresize=renderScatter;
  renderTop();
  applyFilters();
  profile(DATA.slice().sort((a,b)=>b.pd-a.pd)[0].id);
}

function initPeakFinder(){
  if(!byId("pdPeakResult")) return;
  byId("pdPeakLength").addEventListener("change",()=>{
    if(!byId("pdPeakLength").value){
      selectedPeakPlayer="";
      byId("pdPeakSearch").value="";
      byId("pdPeakSuggestions").style.display="none";
      byId("pdPeakSelected").style.display="none";
    }
    renderPeakFinder();
  });
  byId("pdPeakSearch").addEventListener("input",renderPeakSearchSuggestions);
  byId("pdPeakSearch").addEventListener("focus",renderPeakSearchSuggestions);
  byId("pdPeakClear").addEventListener("click",clearPeakPlayer);
  document.addEventListener("click",e=>{
    if(!byId("pdPeakSuggestions")) return;
    if(!e.target.closest(".peak-search-control")) byId("pdPeakSuggestions").style.display="none";
  });
  renderPeakFinder();
}

/* Season Search -- full stat line lookup for any single qualified pitcher-season.
   Reuses the same search/suggestion pattern as Peak Finder and the same
   component-breakdown bar style as the Home page Season Profile. */
let selectedSeasonSearchPlayer="";
function renderSeasonSearchSuggestions(){
  const input=byId("seasonSearchInput"),box=byId("seasonSearchSuggestions");
  const q=hhNorm(input.value);
  if(!q){box.innerHTML="";box.style.display="none";return;}
  const parts=q.split(/\s+/).filter(Boolean);
  const matches=hhPlayers.filter(p=>{
    const n=hhNorm(p);
    return parts.every(part=>n.includes(part));
  }).sort((a,b)=>{
    const an=hhNorm(a),bn=hhNorm(b);
    const ap=an.startsWith(q)?0:1,bp=bn.startsWith(q)?0:1;
    if(ap!==bp)return ap-bp;
    return an.localeCompare(bn);
  }).slice(0,10);
  if(!matches.length){box.innerHTML="";box.style.display="none";return;}
  box.innerHTML=matches.map(p=>`<div class="peak-suggestion" data-player="${hhEsc(p)}">${hhEsc(p)}</div>`).join("");
  box.style.display="block";
  box.querySelectorAll(".peak-suggestion").forEach(el=>el.addEventListener("mousedown",e=>{
    e.preventDefault();
    selectSeasonSearchPlayer(el.dataset.player);
  }));
}
function selectSeasonSearchPlayer(player){
  selectedSeasonSearchPlayer=player;
  byId("seasonSearchInput").value=player;
  byId("seasonSearchSuggestions").style.display="none";
  populateSeasonSearchYears();
}
function populateSeasonSearchYears(){
  const sel=byId("seasonSearchYear");
  const rows=DATA.filter(d=>d.player===selectedSeasonSearchPlayer).sort((a,b)=>a.season-b.season);
  if(!rows.length){
    sel.disabled=true;
    sel.innerHTML='<option value="">Choose a pitcher above</option>';
    renderSeasonSearchResult(null);
    return;
  }
  sel.disabled=false;
  sel.innerHTML='<option value="">Choose a season</option>'+rows.map(d=>`<option value="${d.season}">${d.season}</option>`).join("");
  renderSeasonSearchResult(null);
}
function renderSeasonSearchResult(d){
  const el=byId("seasonSearchResult");
  if(!d){
    el.innerHTML='<div class="pd-era-empty">Search for a pitcher, then choose a season to see the full stat line.</div>';
    return;
  }
  const components=[
    ["ERA Z-Score","eraz"],["K-BB% Z-Score","kbbz"],["BAA Z-Score","baaz"],
    ["HR/9 Z-Score","hr9z"],["IP Z-Score","ipz"],["WPA Z-Score","wpaz"]
  ];
  const rankInfo=components.map(([label,key])=>{
    const sorted=DATA.slice().sort((a,b)=>(b[key]??-Infinity)-(a[key]??-Infinity));
    const rank=sorted.findIndex(x=>x.id===d.id)+1;
    const percentile=DATA.length>1?100*(1-(rank-1)/(DATA.length-1)):100;
    return{label,key,rank,percentile};
  });
  el.innerHTML=`<div class="label">${d.season} season</div><h3>${d.player}</h3>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
      <div class="big">${fmt(d.pd,2)}</div>
      <span class="season-search-rank">#${d.rank.toLocaleString()} all-time</span>
      ${d.cy===1?'<span class="pill" title="Cy Young Award winner">CY</span>':""}
    </div>
    <div class="label">Pitching Dominance+</div>
    <hr class="divider">
    <div class="stat-grid">
      <div><b>Team</b>${d.team}</div>
      <div><b>LG</b>${d.lg}</div>
      <div><b>Age</b>${fmt(d.age,0)}</div>
      <div><b>W-L</b>${d.w}-${d.l}</div>
      <div><b class="fwar-label">fWAR</b>${fmt(d.war,1)}</div>
      <div><b>ERA</b>${fmt(d.era,2)}</div>
      <div><b>FIP</b>${fmt(d.fip,2)}</div>
      <div><b>K-BB%</b>${fmt(d.kbb,1)}%</div>
      <div><b>BAA</b>${fmtBAA(d.baa)}</div>
      <div><b>HR/9</b>${fmt(d.hr9,2)}</div>
      <div><b>IP</b>${fmt(d.ip,1)}</div>
      <div><b>WPA</b>${fmt(d.wpa,2)}</div>
    </div>
    <hr class="divider">
    <div class="comp-title">Component Breakdown</div>
    ${rankInfo.map(c=>`<div class="note">${c.label}: <b>${fmt(d[c.key],2)}</b> \u00b7 <b>#${c.rank.toLocaleString()}</b> of ${DATA.length.toLocaleString()}</div>
    <div class="bar" title="Top ${c.percentile.toFixed(1)}% of qualified pitcher-seasons"><i style="width:${Math.max(0,Math.min(100,c.percentile))}%"></i></div>`).join("")}
    <p class="note mt-14">Component bars show the pitcher's percentile position in the full qualified pitcher-season distribution, with the best z-score at 100%.</p>`;
}
function initSeasonSearch(){
  if(!byId("seasonSearchInput")) return;
  byId("seasonSearchInput").addEventListener("input",()=>{
    renderSeasonSearchSuggestions();
    const val=byId("seasonSearchInput").value;
    const canon=hhCanonical(val);
    if(canon){
      selectedSeasonSearchPlayer=canon;
      populateSeasonSearchYears();
    }else if(!val.trim()){
      selectedSeasonSearchPlayer="";
      byId("seasonSearchYear").disabled=true;
      byId("seasonSearchYear").innerHTML='<option value="">Choose a pitcher above</option>';
      renderSeasonSearchResult(null);
    }
  });
  byId("seasonSearchInput").addEventListener("focus",renderSeasonSearchSuggestions);
  byId("seasonSearchYear").addEventListener("change",()=>{
    const season=Number(byId("seasonSearchYear").value);
    if(!season){renderSeasonSearchResult(null);return;}
    const d=DATA.find(x=>x.player===selectedSeasonSearchPlayer&&x.season===season);
    renderSeasonSearchResult(d);
  });
  document.addEventListener("click",e=>{
    if(!byId("seasonSearchSuggestions")) return;
    if(!e.target.closest(".peak-search-control")) byId("seasonSearchSuggestions").style.display="none";
  });
  renderSeasonSearchResult(null);
}

function initHeadToHead(){
  const modeSel=hhById("hhMode");
  if(!modeSel) return;
  modeSel.addEventListener("change",()=>hhSetMode(modeSel.value));
  hhSetMode("");
}

function initCyYoungLeaders(){
  if(!byId("pdCyYoungLeaderboardBody")) return;
  renderCyYoungLeaders();
}

function initCurrentSeasonPredictions(){
  if(!byId("cyPredAL")) return;
  renderCurrentSeasonPredictions();
}

/* This Season -- PD+ vs. Innings Pitched scatter and PD+ distribution histogram,
   both scoped to CURRENT_SEASON so they roll over automatically each year. */
function renderSeasonWorkloadScatter(){
  const el=byId("seasonWorkloadScatter");
  if(!el) return;
  const headingEl=byId("seasonWorkloadHeading");
  if(headingEl) headingEl.textContent=`${CURRENT_SEASON} PD+ vs. Innings Pitched`;
  const pool=DATA.filter(d=>d.season===CURRENT_SEASON);
  const trace={
    x:pool.map(d=>d.ip),
    y:pool.map(d=>d.pd),
    mode:"markers",
    type:"scatter",
    marker:{size:8,opacity:0.78,color:"#2f6fed"},
    customdata:pool.map(d=>[d.player,d.team,d.lg]),
    hovertemplate:"<b>%{customdata[0]}</b><br>%{customdata[1]} \u00b7 %{customdata[2]}<br>IP: %{x:.1f}<br>PD+: %{y:.2f}<extra></extra>"
  };
  const layout={
    margin:{l:55,r:20,t:20,b:45},
    paper_bgcolor:"#fff",plot_bgcolor:"#fff",hovermode:"closest",
    xaxis:{title:"Innings Pitched",gridcolor:"#eee",zeroline:false},
    yaxis:{title:"PD+",gridcolor:"#eee",zeroline:false},
    font:{family:"system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",color:"#171717"}
  };
  Plotly.react(el,[trace],layout,{responsive:true,displaylogo:false});
}
function renderSeasonDistHistogram(){
  const el=byId("seasonDistHistogram");
  if(!el) return;
  const headingEl=byId("seasonDistHeading");
  if(headingEl) headingEl.textContent=`${CURRENT_SEASON} PD+ Distribution`;
  const pool=DATA.filter(d=>d.season===CURRENT_SEASON);
  const trace={
    x:pool.map(d=>d.pd),
    type:"histogram",
    xbins:{size:5},
    marker:{color:"#2f6fed"}
  };
  const layout={
    margin:{l:55,r:20,t:20,b:45},
    paper_bgcolor:"#fff",plot_bgcolor:"#fff",bargap:0.05,
    xaxis:{title:"PD+",gridcolor:"#eee",zeroline:false},
    yaxis:{title:"Pitchers",gridcolor:"#eee",zeroline:false},
    font:{family:"system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",color:"#171717"}
  };
  Plotly.react(el,[trace],layout,{responsive:true,displaylogo:false});
}
function initSeasonCharts(){
  if(!byId("seasonWorkloadScatter")) return;
  renderSeasonWorkloadScatter();
  renderSeasonDistHistogram();
}

/* Run every page init. Each one is a no-op if its markup isn't on the page. */
initHome();
initPeakFinder();
initSeasonSearch();
initHeadToHead();
initCyYoungPredictor();
initCyYoungLeaders();
initNetCyYoungBoards();
initBestNonCyYoung();
initGoats();
initCurrentSeasonPredictions();
initSeasonCharts();
initEraComparison();
initEraTrend();
initComponentLeaders();
