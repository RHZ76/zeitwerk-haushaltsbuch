const STORE='viacruz_haushaltsbuch_v1_data';
const LOCK='viacruz_haushaltsbuch_v1_lock';
const DEFAULT_CATS=['Lebensmittel','Tanken','Freizeit','Kleidung','Haus & Wohnung','Gesundheit','Urlaub','Sonstiges'];
let state={entries:[],categories:DEFAULT_CATS.map((name,i)=>({id:'c'+(i+1),name,active:true,created:Date.now()+i}))};
let openAnalyticsCategoryId=null;
let entryTemplateSource=null;
let searchReturnView='transactions';
try{let x=JSON.parse(localStorage.getItem(STORE)||'null');if(x&&Array.isArray(x.entries)&&Array.isArray(x.categories))state=x}catch(e){}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
const ymNow=()=>new Date().toISOString().slice(0,7);
const dateDE=s=>new Date(s+'T12:00:00').toLocaleDateString('de-DE');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const catById=id=>state.categories.find(c=>c.id===id);
function save(){localStorage.setItem(STORE,JSON.stringify(state));render()}
function net(list){return list.reduce((a,e)=>a+(e.type==='refund'?+e.amount:-e.amount),0)}
function expenseTotal(list){return list.filter(e=>e.type==='expense').reduce((a,e)=>a+(+e.amount||0),0)}
function refundTotal(list){return list.filter(e=>e.type==='refund').reduce((a,e)=>a+(+e.amount||0),0)}
function nav(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));render()}
function clearEntryTemplate(){
  entryTemplateSource=null;
  let n=$('#templateNotice');
  if(n){n.classList.add('hidden');n.innerHTML=''}
}
$$('[data-nav]').forEach(b=>b.onclick=()=>{
  if(b.dataset.nav==='entry')clearEntryTemplate();
  nav(b.dataset.nav);
});


function options(includeInactive=false,all=false){let cs=state.categories;return (all?'<option value="all">Alle Kategorien</option>':'')+cs.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
function syncSelects(){let current=$('#category').value, edit=$('#editCategory').value, filter=$('#categoryFilter').value;$('#category').innerHTML=options();$('#editCategory').innerHTML=options(true);$('#categoryFilter').innerHTML=options(true,true);if(current&&catById(current))$('#category').value=current;if(edit&&catById(edit))$('#editCategory').value=edit;if(filter==='all'||catById(filter))$('#categoryFilter').value=filter}
function rowHTML(e){let c=catById(e.categoryId), sign=e.type==='refund'?'+':'−';return `<div class="row" data-id="${e.id}"><div class="rowtop"><div><b>${esc(e.purpose||c?.name||'Buchung')}</b><div class="meta">${dateDE(e.date)} · ${esc(c?.name||'Unbekannte Kategorie')}</div></div><div class="money ${e.type}">${sign}${euro(e.amount)}</div></div><span class="badge ${e.type}">${e.type==='refund'?'Erstattung':'Ausgabe'}</span></div>`}
function bindRows(root=document){root.querySelectorAll('.row[data-id]').forEach(r=>r.onclick=()=>openEdit(r.dataset.id))}

function populateMonthFilter(){
  const el=$('#monthFilter');
  if(!el)return;
  const keep=el.value||ymNow();
  const months=new Set();

  // Aktueller Monat sowie 36 Monate zurück und 12 Monate voraus.
  const now=new Date();
  for(let offset=-36;offset<=12;offset++){
    const d=new Date(now.getFullYear(),now.getMonth()+offset,1);
    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  // Auch Monate aus vorhandenen Buchungen immer anbieten.
  state.entries.forEach(e=>{
    if(e.date&&/^\d{4}-\d{2}/.test(e.date))months.add(e.date.slice(0,7));
  });

  const sorted=[...months].sort((a,b)=>b.localeCompare(a));
  el.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-').map(Number);
    const label=new Date(y,mo-1,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'});
    return `<option value="${m}">${label}</option>`;
  }).join('');

  el.value=months.has(keep)?keep:ymNow();
}

function filtered(monthEl='#monthFilter',catEl='#categoryFilter'){let m=$(monthEl)?.value||ymNow(),c=$(catEl)?.value||'all';return state.entries.filter(e=>(!m||e.date.startsWith(m))&&(c==='all'||e.categoryId===c))}
function renderOverview(){let m=ymNow(), list=state.entries.filter(e=>e.date.startsWith(m));$('#monthNet').textContent=euro(Math.abs(net(list)));$('#monthMeta').textContent=`${list.filter(e=>e.type==='expense').length} Ausgaben · ${list.filter(e=>e.type==='refund').length} Erstattungen`;$('#monthExpenses').textContent=euro(expenseTotal(list));$('#monthRefunds').textContent=euro(refundTotal(list));let sums=state.categories.map(c=>({c,v:Math.abs(net(list.filter(e=>e.categoryId===c.id)))})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,6);$('#categorySummary').innerHTML=sums.length?sums.map(x=>`<div class="catSummaryRow"><div class="catLeft"><i class="catDot"></i><span class="catName">${esc(x.c.name)}</span></div><span class="catAmount">${euro(x.v)}</span></div>`).join(''):'<div class="hint">Noch keine Buchungen in diesem Monat.</div>';let recent=[...state.entries].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created).slice(0,4);$('#recent').innerHTML=recent.length?recent.map(rowHTML).join(''):'<div class="hint">Noch keine Einträge gespeichert.</div>';bindRows($('#recent'))}
function renderTransactions(){populateMonthFilter();let list=filtered().sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);$('#listTotals').innerHTML=`<div class="expenseSummaryGrid">
  <div class="expenseSummaryItem"><span>Ausgaben</span><strong>${euro(expenseTotal(list))}</strong></div>
  <div class="expenseSummaryItem"><span>Erstattungen</span><strong>${euro(refundTotal(list))}</strong></div>
  <div class="expenseSummaryItem total"><span>Gesamt</span><strong>${euro(Math.abs(net(list)))}</strong></div>
</div>`;$('#entries').innerHTML=list.length?list.map(rowHTML).join(''):'<div class="hint">Für diesen Filter gibt es keine Einträge.</div>';bindRows($('#entries'))}

function renderSearch(){
  let input=$('#searchInput'), results=$('#searchResults'), meta=$('#searchMeta');
  if(!input||!results||!meta)return;
  let q=input.value.trim().toLocaleLowerCase('de-DE');

  if(!q){
    meta.textContent='Gib einen Suchbegriff ein.';
    results.innerHTML='';
    return;
  }

  let list=[...state.entries]
    .filter(e=>{
      let c=catById(e.categoryId)?.name||'';
      let type=e.type==='refund'?'Erstattung':'Ausgabe';
      let hay=[e.purpose||'',c,type,e.date,dateDE(e.date)]
        .join(' ')
        .toLocaleLowerCase('de-DE');
      return hay.includes(q);
    })
    .sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);

  meta.textContent=list.length===1?'1 Treffer':`${list.length} Treffer`;

  results.innerHTML=list.length?list.map(e=>{
    let c=catById(e.categoryId);
    let sign=e.type==='refund'?'+':'−';
    return `<div class="searchResult card" data-search-id="${e.id}">
      <div class="searchResultTop">
        <div class="searchResultText">
          <b>${esc(e.purpose||c?.name||'Buchung')}</b>
          <div class="meta">${dateDE(e.date)} · ${esc(c?.name||'Unbekannte Kategorie')}</div>
        </div>
        <div class="money ${e.type}">${sign}${euro(e.amount)}</div>
      </div>
      <span class="badge ${e.type}">${e.type==='refund'?'Erstattung':'Ausgabe'}</span>
      <div class="searchActions">
        <button type="button" data-search-action="edit" data-id="${e.id}">Bearbeiten</button>
        <button type="button" class="secondary" data-search-action="template" data-id="${e.id}">Als Vorlage übernehmen</button>
      </div>
    </div>`;
  }).join(''):'<div class="hint">Keine passenden Buchungen gefunden.</div>';

  results.querySelectorAll('[data-search-action="edit"]').forEach(b=>{
    b.onclick=()=>openEdit(b.dataset.id);
  });
  results.querySelectorAll('[data-search-action="template"]').forEach(b=>{
    b.onclick=()=>useEntryAsTemplate(b.dataset.id);
  });
}

function useEntryAsTemplate(id){
  let e=state.entries.find(x=>x.id===id);
  if(!e)return;

  entryTemplateSource=e.id;
  $('#date').value=today();
  $('#amount').value='';
  $('#category').value=e.categoryId;
  $('#purpose').value=e.purpose||'';
  submitType=e.type;

  let c=catById(e.categoryId);
  let n=$('#templateNotice');
  if(n){
    n.innerHTML=`<b>Vorlage übernommen</b><span>${esc(c?.name||'Unbekannte Kategorie')} · ${e.type==='refund'?'Erstattung':'Ausgabe'}</span><small>Datum ist heute, der Betrag bleibt bewusst leer.</small>`;
    n.classList.remove('hidden');
  }

  nav('entry');
  setTimeout(()=>$('#amount')?.focus(),60);
}

function renderCategories(){
  let list=state.categories;
  $('#categoryList').innerHTML=list.map(c=>`<div class="card catManageRow" data-cat="${c.id}">
    <div class="catLeft"><i class="catDot"></i><div><b>${esc(c.name)}</b></div></div>
    <div>
      <button data-cat-action="rename">Bearbeiten</button>
      <button data-cat-action="delete" class="dangerBtn">Löschen</button>
    </div>
  </div>`).join('');

  $$('[data-cat-action]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    let id=b.closest('[data-cat]').dataset.cat,c=catById(id);
    if(!c)return;

    if(b.dataset.catAction==='rename'){
      let n=prompt('Kategorie umbenennen:',c.name);
      if(n&&n.trim()){
        let name=n.trim();
        let duplicate=state.categories.some(x=>x.id!==id&&x.name.toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE'));
        if(duplicate)return alert('Diese Kategorie gibt es bereits.');
        c.name=name;
        save();
      }
    } else {
      let used=state.entries.filter(x=>x.categoryId===id).length;
      if(used>0){
        alert(`Die Kategorie „${c.name}“ kann nicht gelöscht werden, weil noch ${used} ${used===1?'Buchung':'Buchungen'} damit gespeichert ${used===1?'ist':'sind'}.\n\nBitte diese Buchungen zuerst bearbeiten oder löschen. So gehen keine Haushaltsdaten verloren.`);
        return;
      }
      if(confirm(`Kategorie „${c.name}“ wirklich löschen?`)){
        state.categories=state.categories.filter(x=>x.id!==id);
        if(openAnalyticsCategoryId===id)openAnalyticsCategoryId=null;
        save();
      }
    }
  });
}
function renderAnalytics(){
  let m=$('#analyticsMonth').value||ymNow(),
      list=state.entries.filter(e=>e.date.startsWith(m)),
      total=Math.abs(net(list));
  $('#analyticsTotal').innerHTML=`<small>GESAMTAUSGABEN</small><strong>${euro(total)}</strong><span>Ausgaben ${euro(expenseTotal(list))} · Erstattungen ${euro(refundTotal(list))}</span>`;

  let sums=state.categories
    .map(c=>({c,v:Math.abs(net(list.filter(e=>e.categoryId===c.id)))}))
    .filter(x=>x.v>0)
    .sort((a,b)=>b.v-a.v);

  let max=Math.max(1,...sums.map(x=>x.v));
  renderAnalyticsPie(sums);
  $('#analyticsCategories').innerHTML=sums.length
    ? sums.map(x=>`<div class="analyticsRow clickable ${openAnalyticsCategoryId===x.c.id?'active':''}" data-analytics-cat="${x.c.id}">
        <div class="analyticsTop"><b>${esc(x.c.name)}</b><span>${euro(x.v)} <i class="analyticsChevron">›</i></span></div>
        <div class="bar"><i style="width:${Math.max(3,x.v/max*100)}%"></i></div>
      </div>`).join('')
    : '<div class="hint">Noch keine Daten für diesen Monat.</div>';

  $$('[data-analytics-cat]').forEach(el=>el.onclick=()=>{
    let id=el.dataset.analyticsCat;
    openAnalyticsCategoryId=openAnalyticsCategoryId===id?null:id;
    renderAnalytics();
  });

  renderAnalyticsDetail(m,list);
}
function renderAnalyticsPie(sums){
  let pie=$('#analyticsPie'),legend=$('#analyticsPieLegend'),center=$('#analyticsPieCenter');
  if(!pie||!legend||!center)return;

  let positive=sums.filter(x=>x.v>0);
  let total=positive.reduce((s,x)=>s+x.v,0);

  if(!positive.length||total<=0){
    pie.style.background='#e8ece9';
    center.innerHTML='<b>0,00 €</b><span>Gesamtausgaben</span>';
    legend.innerHTML='<div class="analyticsPieEmpty">Noch keine Ausgaben für diesen Monat.</div>';
    return;
  }

  /* Feste, gut unterscheidbare Palette. Neue Kategorien erhalten automatisch die nächste Farbe. */
  let colors=['#168f4d','#64a96f','#a8c96f','#d4b85a','#d98b5f','#bd6f75','#8c78b8','#5f91b5','#67aaa4','#8b9b63'];
  let start=0,parts=[];
  positive.forEach((x,i)=>{
    let end=start+(x.v/total*100);
    parts.push(`${colors[i%colors.length]} ${start.toFixed(3)}% ${end.toFixed(3)}%`);
    start=end;
  });
  pie.style.background=`conic-gradient(${parts.join(',')})`;
  center.innerHTML=`<b>${euro(total)}</b><span>Gesamtausgaben</span>`;

  legend.innerHTML=positive.map((x,i)=>{
    let pct=(x.v/total*100);
    return `<div class="analyticsPieLegendRow">
      <i class="analyticsPieLegendDot" style="background:${colors[i%colors.length]}"></i>
      <span class="analyticsPieLegendName">${esc(x.c.name)}</span>
      <span class="analyticsPieLegendValue">${pct.toLocaleString('de-DE',{maximumFractionDigits:1})}% · ${euro(x.v)}</span>
    </div>`;
  }).join('');
}
function renderAnalyticsDetail(month,list){
  let box=$('#analyticsDetail');
  if(!openAnalyticsCategoryId){box.innerHTML='';return}
  let c=catById(openAnalyticsCategoryId);
  if(!c){openAnalyticsCategoryId=null;box.innerHTML='';return}
  let rows=list.filter(e=>e.categoryId===c.id).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
  if(!rows.length){box.innerHTML='';return}
  let monthName=new Date(month+'-01T12:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  box.innerHTML=`<div class="card analyticsDetailCard">
    <div class="analyticsDetailHeader">
      <div><h3>${esc(c.name)}</h3><p>${esc(monthName)} · ${rows.length} ${rows.length===1?'Buchung':'Buchungen'}</p></div>
      <button id="printAnalyticsCategory" class="analyticsPrintBtn">Drucken</button>
    </div>
    <div>${rows.map(rowHTML).join('')}</div>
    <div class="detailTotal"><span>Gesamt ${esc(c.name)}</span><span>${euro(Math.abs(net(rows)))}</span></div>
  </div>`;
  bindRows(box);
  $('#printAnalyticsCategory').onclick=()=>printAnalyticsCategory(month,c.id);
}
function render(){syncSelects();renderOverview();renderTransactions();renderSearch();renderCategories();renderAnalytics()}
$('#date').value=today();populateMonthFilter();$('#monthFilter').value=ymNow();$('#analyticsMonth').value=ymNow();
let submitType='expense';$$('#entryForm button[type=submit]').forEach(b=>b.onclick=()=>submitType=b.dataset.type);
$('#entryForm').onsubmit=e=>{e.preventDefault();let amount=Number($('#amount').value);if(!(amount>0))return;state.entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),date:$('#date').value,amount,categoryId:$('#category').value,purpose:$('#purpose').value.trim(),type:submitType,created:Date.now()});save();$('#amount').value='';$('#purpose').value='';clearEntryTemplate();nav('overview')};
$('#monthFilter').onchange=renderTransactions;$('#categoryFilter').onchange=renderTransactions;$('#analyticsMonth').onchange=()=>{openAnalyticsCategoryId=null;renderAnalytics()};$('#clearFilters').onclick=()=>{$('#monthFilter').value=ymNow();$('#categoryFilter').value='all';renderTransactions()};
function openGlobalSearch(fromView){
  searchReturnView=fromView||'transactions';
  let back=$('#closeSearch');
  if(back){
    back.textContent=searchReturnView==='entry'?'Zurück zur Buchung':
      searchReturnView==='overview'?'Zurück zur Übersicht':'Zurück zu Ausgaben';
  }
  nav('search');
  setTimeout(()=>$('#searchInput')?.focus(),60);
}
$('#openSearch').onclick=()=>openGlobalSearch('transactions');
$('#openSearchFromOverview').onclick=()=>openGlobalSearch('overview');
$('#openSearchFromEntry').onclick=()=>openGlobalSearch('entry');
$('#closeSearch').onclick=()=>nav(searchReturnView||'transactions');
$('#searchInput').oninput=renderSearch;
function createCategoryAndSelect(targetSelectId){
  let n=prompt('Name der neuen Kategorie:','');
  if(!n||!n.trim())return;
  n=n.trim();
  let existing=state.categories.find(c=>c.name.toLocaleLowerCase('de-DE')===n.toLocaleLowerCase('de-DE'));
  if(existing){
    save();
    if(targetSelectId&&document.querySelector(targetSelectId))document.querySelector(targetSelectId).value=existing.id;
    return;
  }
  let c={id:'c'+Date.now(),name:n,active:true,created:Date.now()};
  state.categories.push(c);
  save();
  if(targetSelectId&&document.querySelector(targetSelectId))document.querySelector(targetSelectId).value=c.id;
}
$('#addCategoryEntry').onclick=()=>createCategoryAndSelect('#category');
$('#addCategoryEdit').onclick=()=>createCategoryAndSelect('#editCategory');
$('#addCategory').onclick=()=>createCategoryAndSelect(null);
function openEdit(id){let e=state.entries.find(x=>x.id===id);if(!e)return;$('#editId').value=e.id;$('#editDate').value=e.date;$('#editAmount').value=e.amount;$('#editCategory').value=e.categoryId;$('#editPurpose').value=e.purpose||'';$('#editType').value=e.type;$('#editBox').classList.remove('hidden')}
$('#editForm').onsubmit=e=>{e.preventDefault();let x=state.entries.find(a=>a.id===$('#editId').value);if(!x)return;x.date=$('#editDate').value;x.amount=Number($('#editAmount').value);x.categoryId=$('#editCategory').value;x.purpose=$('#editPurpose').value.trim();x.type=$('#editType').value;$('#editBox').classList.add('hidden');save()};
$('#deleteEntry').onclick=()=>{let id=$('#editId').value;if(confirm('Diesen Eintrag wirklich löschen?')){state.entries=state.entries.filter(e=>e.id!==id);$('#editBox').classList.add('hidden');save()}};
$('#closeEdit').onclick=()=>$('#editBox').classList.add('hidden');
$('#menuBtn').onclick=()=>$('#menu').classList.remove('hidden');$('#closeMenu').onclick=()=>$('#menu').classList.add('hidden');$('#about').onclick=()=>{$('#menu').classList.add('hidden');$('#aboutBox').classList.remove('hidden')};$('#closeAbout').onclick=()=>$('#aboutBox').classList.add('hidden');
function download(name,text,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
$('#backup').onclick=()=>download(`haushaltsbuch-backup-${today()}.json`,JSON.stringify({app:'Haushaltsbuch',schema:1,version:'0.3.0',exported:new Date().toISOString(),data:state},null,2),'application/json');
$('#restore').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let x=JSON.parse(await f.text());if(x.app!=='Haushaltsbuch'||!x.data||!Array.isArray(x.data.entries)||!Array.isArray(x.data.categories))throw 0;if(confirm('Datensicherung wiederherstellen? Aktuelle Daten werden ersetzt.')){state=x.data;save();alert('Datensicherung wurde wiederhergestellt.')}}catch(_){alert('Diese Datei ist keine gültige Haushaltsbuch-Datensicherung.')}e.target.value=''};
$('#csv').onclick=()=>{let rows=[['Datum','Buchungsart','Betrag','Kategorie','Verwendungszweck'],...state.entries.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,e.type==='refund'?'Erstattung':'Ausgabe',String(e.amount).replace('.',','),catById(e.categoryId)?.name||'',e.purpose||''])];let csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');download(`haushaltsbuch-${today()}.csv`,csv,'text/csv;charset=utf-8')};
$('#printFiltered').onclick=()=>printReport();
$('#printAnalyticsMonth').onclick=()=>printAnalyticsMonth($('#analyticsMonth').value||ymNow());
function printAnalyticsMonth(month){
  let list=state.entries
    .filter(e=>e.date.startsWith(month))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
  let monthName=new Date(month+'-01T12:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  let groups=state.categories.map(c=>({
    c,
    rows:list.filter(e=>e.categoryId===c.id)
  })).filter(g=>g.rows.length).sort((a,b)=>a.c.name.localeCompare(b.c.name,'de'));

  let old=$('#printSheet');if(old)old.remove();
  let s=document.createElement('section');s.id='printSheet';s.className='analyticsMonthPrint';

  let categoryHtml=groups.length?`
    <div class="printCategorySummary">
      <div class="printCategorySummaryHead"><span>Kategorie</span><span>Betrag</span></div>
      ${groups.map(g=>`<div class="printCategorySummaryRow"><span>${esc(g.c.name)}</span><b>${euro(Math.abs(net(g.rows)))}</b></div>`).join('')}
    </div>`:'<p>Für diesen Monat gibt es keine Buchungen.</p>';

  s.innerHTML=`<h1>Haushaltsbuch – Monatsauswertung</h1>
    <p>${esc(monthName)}</p>
    <div class="printMonthSummary">
      <div><span>Ausgaben</span><b>${euro(expenseTotal(list))}</b></div>
      <div><span>Erstattungen</span><b>${euro(refundTotal(list))}</b></div>
      <div><span>Gesamt</span><b>${euro(Math.abs(net(list)))}</b></div>
    </div>
    ${categoryHtml}
    <div class="printGrandTotal"><span>Gesamt ${esc(monthName)}</span><b>${euro(Math.abs(net(list)))}</b></div>
    <div class="printFooter">powered by viacruz · viacruz.com</div>`;
  document.body.appendChild(s);
  setTimeout(()=>window.print(),250);
}
function printAnalyticsCategory(month,categoryId){
  let c=catById(categoryId);
  if(!c)return;
  let list=state.entries
    .filter(e=>e.date.startsWith(month)&&e.categoryId===categoryId)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.created-b.created);
  let monthName=new Date(month+'-01T12:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  let old=$('#printSheet');if(old)old.remove();
  let s=document.createElement('section');s.id='printSheet';
  s.innerHTML=`<h1>Haushaltsbuch – Auswertung</h1>
    <p>${esc(c.name)} · ${esc(monthName)}</p>
    <table><thead><tr><th>Datum</th><th>Verwendungszweck</th><th>Art</th><th>Betrag</th></tr></thead>
    <tbody>${list.map(e=>`<tr><td>${dateDE(e.date)}</td><td>${esc(e.purpose)}</td><td>${e.type==='refund'?'Erstattung':'Ausgabe'}</td><td>${e.type==='refund'?'+':'−'}${euro(e.amount)}</td></tr>`).join('')}
    <tr class="printSum"><td colspan="3">Gesamt ${esc(c.name)}</td><td>${euro(Math.abs(net(list)))}</td></tr></tbody></table>
    <div class="printFooter">powered by viacruz · viacruz.com</div>`;
  document.body.appendChild(s);
  setTimeout(()=>window.print(),250);
}
function printReport(){let list=filtered().sort((a,b)=>a.date.localeCompare(b.date));let m=$('#monthFilter').value||ymNow(),cat=$('#categoryFilter').value,catName=cat==='all'?'Alle Kategorien':catById(cat)?.name||'';let old=$('#printSheet');if(old)old.remove();let s=document.createElement('section');s.id='printSheet';s.className='transactionsPrint';s.innerHTML=`<h1>Haushaltsbuch</h1><p>${m} · ${esc(catName)}</p><table><thead><tr><th>Datum</th><th>Kategorie</th><th>Verwendungszweck</th><th>Art</th><th>Betrag</th></tr></thead><tbody>${list.map(e=>`<tr><td>${dateDE(e.date)}</td><td>${esc(catById(e.categoryId)?.name||'')}</td><td>${esc(e.purpose)}</td><td>${e.type==='refund'?'Erstattung':'Ausgabe'}</td><td>${e.type==='refund'?'+':'−'}${euro(e.amount)}</td></tr>`).join('')}<tr class="printSum"><td colspan="4">Gesamt</td><td>${euro(Math.abs(net(list)))}</td></tr></tbody></table><div class="printFooter">powered by viacruz · viacruz.com</div>`;document.body.appendChild(s);setTimeout(()=>window.print(),250)}
$('#lockSettings').onclick=()=>{$('#menu').classList.add('hidden');$('#lockBox').classList.remove('hidden')};$('#closeLockBox').onclick=()=>$('#lockBox').classList.add('hidden');
(()=>{try{let st={enabled:false,pin:'',delay:1,lastHidden:0};try{st={...st,...JSON.parse(localStorage.getItem(LOCK)||'{}')}}catch(e){}const saveL=()=>localStorage.setItem(LOCK,JSON.stringify(st));const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)};const valid=p=>/^\d{4,6}$/.test(p);function refresh(){let on=st.enabled;$('#lockStatus').textContent=on?'Eingeschaltet.':'Ausgeschaltet.';$('#enableLock').classList.toggle('hidden',on);['changePin','lockDelayWrap','lockNow','disableLock'].forEach(id=>$('#'+id).classList.toggle('hidden',!on));$('#lockDelay').value=String(st.delay)}function newPin(){let a=prompt('Neue PIN festlegen (4 bis 6 Ziffern):','');if(a===null)return null;if(!valid(a)){alert('Bitte 4 bis 6 Ziffern eingeben.');return null}let b=prompt('PIN noch einmal eingeben:','');if(a!==b){alert('Die PIN-Eingaben stimmen nicht überein.');return null}return a}function current(){let p=prompt('Aktuelle PIN eingeben:','');return p!==null&&hash(p)===st.pin}function lock(){if(st.enabled)$('#pinScreen').classList.remove('hidden')}function unlock(){if(hash($('#pinInput').value)===st.pin){$('#pinScreen').classList.add('hidden');$('#pinInput').value='';$('#pinError').textContent=''}else $('#pinError').textContent='PIN nicht richtig.'}$('#enableLock').onclick=()=>{let p=newPin();if(!p)return;st.enabled=true;st.pin=hash(p);saveL();refresh()};$('#changePin').onclick=()=>{if(!current())return alert('PIN nicht richtig.');let p=newPin();if(p){st.pin=hash(p);saveL();alert('PIN geändert.')}};$('#disableLock').onclick=()=>{if(!current())return alert('PIN nicht richtig.');if(confirm('App-Sperre wirklich ausschalten?')){st={enabled:false,pin:'',delay:1,lastHidden:0};saveL();refresh();$('#pinScreen').classList.add('hidden')}};$('#lockNow').onclick=lock;$('#lockDelay').onchange=()=>{st.delay=Number($('#lockDelay').value);saveL()};$('#pinUnlock').onclick=unlock;$('#pinInput').onkeydown=e=>{if(e.key==='Enter')unlock()};document.addEventListener('visibilitychange',()=>{if(document.hidden){st.lastHidden=Date.now();saveL()}else if(st.enabled&&st.lastHidden&&Date.now()-st.lastHidden>=st.delay*60000)lock()});refresh();if(st.enabled)lock()}catch(e){console.error('Lokale App-Sperre deaktiviert:',e)}})();
render();
setTimeout(()=>{$('#splash').classList.add('hidden');$('#app').classList.remove('hidden')},650);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
