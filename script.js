// ===== Helpers =====
function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function fmtNum(n, maxFrac){ return new Intl.NumberFormat('pl-PL',{maximumFractionDigits:maxFrac||4}).format(n); }
function fmtCurrency(n, code){ return new Intl.NumberFormat('pl-PL',{style:'currency',currency:code,maximumFractionDigits:2}).format(n); }
function pad2(n){ n=String(n); return n.length<2?'0'+n:n; }
function sanitize(str){ return String(str).replace(/[<>&]/g, function(s){ return ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]); }); }

var LS = {
  history: 'unitconv_history_v3',
  rates:   'unitconv_rates_v3',
  chart:   'unitconv_chart_cache_v2',
  theme:   'unitconv_theme'
};
// Fetch z timeoutem (pewniak na mobilnym)
function jfetch(url, opts, timeoutMs){
  return new Promise(function(resolve, reject){
    var ctrl = new AbortController();
    var id = setTimeout(function(){ ctrl.abort(); reject(new Error('timeout')); }, timeoutMs||8000);
    fetch(url, Object.assign({signal: ctrl.signal}, opts||{}))
      .then(function(r){ clearTimeout(id); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(resolve).catch(reject);
  });
}
// ===== Theme (fallback bez :has()) =====
(function(){
  var MAP={'theme-blue':'blue','theme-violet':'violet','theme-lime':'lime','theme-orange':'orange'};
  try{
    var saved = localStorage.getItem(LS.theme) || 'theme-blue';
    document.documentElement.setAttribute('data-theme', MAP[saved] || 'blue');
    var radios = document.querySelectorAll('.theme-switch input[type="radio"]');
    for (var i=0;i<radios.length;i++){
      radios[i].checked = (radios[i].id === saved);
      radios[i].addEventListener('change', function(e){
        var id = e.target.id;
        localStorage.setItem(LS.theme, id);
        document.documentElement.setAttribute('data-theme', MAP[id] || 'blue');
      });
    }
  }catch(e){}
})();

// ===== Dane jednostek =====
var CURRENCIES = ['PLN','EUR','USD','GBP','CHF','JPY','CZK','SEK','NOK','AUD','CAD'];
var LENGTHS = { mm:0.001, cm:0.01, m:1, km:1000, in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344 };
var MASSES  = { mg:0.000001, g:0.001, kg:1, t:1000, lb:0.45359237, oz:0.028349523125 };
var VOLUMES = { ml:0.001, l:1, "m³":1000, tsp:0.00492892159, tbsp:0.0147867648, cup:0.24, "gal(US)":3.785411784 };
var SPEEDS  = { "m/s":1, "km/h":1000/3600, "mph":1609.344/3600, "kn":1852/3600 };

// ===== Zakładki =====
var tabButtons = $$('.tab');
var panels = {
  currency: $('#panel-currency'),
  length: $('#panel-length'),
  temperature: $('#panel-temperature'),
  mass: $('#panel-mass'),
  volume: $('#panel-volume'),
  speed: $('#panel-speed')
};
tabButtons.forEach(function(btn){
  btn.addEventListener('click', function(){
    tabButtons.forEach(function(b){ b.classList.toggle('active', b===btn); });
    Object.keys(panels).forEach(function(k){
      var el = panels[k];
      var active = (btn.dataset.tab === k);
      el.classList.toggle('hidden', !active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    window.scrollTo(0,0);
  });
});

// ===== Historia =====
var historyArr = JSON.parse(localStorage.getItem(LS.history) || '[]');
var historyList = $('#history-list');
var historyFilterBtns = $$('.history .chip'); // tylko filtry z panelu historii
var historyFilter = 'all';

function saveHistory(){ localStorage.setItem(LS.history, JSON.stringify(historyArr)); }
function addHistory(entry){
  historyArr.unshift({ when:Date.now(), type:entry.type, text:entry.text, data:entry.data||null });
  if (historyArr.length>500) historyArr = historyArr.slice(0,500);
  saveHistory(); renderHistory();
}
function renderHistory(){
  var f = historyFilter;
  historyList.innerHTML = '';
  var filtered = historyArr.filter(function(it){ return f==='all' ? true : it.type===f; });
  if (!filtered.length){
    historyList.innerHTML = '<li class="muted small">Brak wpisów…</li>';
    return;
  }
  filtered.forEach(function(it){
    var li = document.createElement('li');
    li.className = 'item type-'+it.type;
    var d = new Date(it.when);
    var when = pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.'+d.getFullYear()+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
    var left = document.createElement('div');
    left.innerHTML = '<div><span class="tag">'+labelForType(it.type)+'</span> '+sanitize(it.text)+'</div><div class="meta">'+when+'</div>';
    var actions = document.createElement('div');
    actions.className = 'actions';
    var btnUse = document.createElement('button'); btnUse.className='btn'; btnUse.textContent='Użyj ponownie';
    var btnCopy = document.createElement('button'); btnCopy.className='btn'; btnCopy.textContent='Kopiuj wynik';
    btnUse.addEventListener('click', function(){ reuseEntry(it); });
    btnCopy.addEventListener('click', function(){ if (navigator.clipboard) navigator.clipboard.writeText(it.text); });
    actions.appendChild(btnUse); actions.appendChild(btnCopy);
    li.appendChild(left); li.appendChild(actions);
    historyList.appendChild(li);
  });
}
function labelForType(t){ return {currency:'Waluta',length:'Długość',temperature:'Temperatura',mass:'Masa',volume:'Objętość',speed:'Prędkość'}[t]||t; }
historyFilterBtns.forEach(function(b){
  b.addEventListener('click', function(){
    historyFilterBtns.forEach(function(x){ x.classList.toggle('active', x===b); });
    historyFilter = b.dataset.filter; renderHistory();
    // BONUS: klik w filtr przełącza też panel u góry
    var target = b.dataset.filter;
    var tabBtn = tabButtons.find(function(t){ return t.dataset.tab === target; });
    if (tabBtn) tabBtn.click();
  });
});
$('#history-clear').addEventListener('click', function(){
  if (!historyArr.length) return;
  if (confirm('Usunąć wpisy historii ('+historyArr.length+')?')){
    historyArr = []; saveHistory(); renderHistory();
  }
});
$('#history-export').addEventListener('click', function(){
  var blob = new Blob([JSON.stringify(historyArr, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download='historia-konwersji.json'; a.click();
  URL.revokeObjectURL(url);
});
function reuseEntry(it){
  function setSelectValue(sel, val){
    var el = $(sel); var ok=false;
    Array.prototype.slice.call(el.options).forEach(function(o){ if (o.value===val) ok=true; });
    if (ok) el.value = val;
  }
  if (it.type==='currency' && it.data){
    $('#cur-amount').value = it.data.amount;
    setSelectValue('#cur-from', it.data.from);
    setSelectValue('#cur-to', it.data.to);
    $('#cur-manual-toggle').checked = !!it.data.manualRate;
    toggleManualRate(!!it.data.manualRate);
    if (it.data.manualRate) $('#cur-manual-rate').value = it.data.manualRate;
    convertCurrency(); tabButtons.find(function(b){return b.dataset.tab==='currency';}).click();
  }
  if (it.type==='length' && it.data){
    $('#len-amount').value = it.data.amount;
    setSelectValue('#len-from', it.data.from);
    setSelectValue('#len-to', it.data.to);
    convertLength(); tabButtons.find(function(b){return b.dataset.tab==='length';}).click();
  }
  if (it.type==='temperature' && it.data){
    $('#tmp-amount').value = it.data.amount;
    setSelectValue('#tmp-from', it.data.from);
    setSelectValue('#tmp-to', it.data.to);
    convertTemperature(); tabButtons.find(function(b){return b.dataset.tab==='temperature';}).click();
  }
  if (it.type==='mass' && it.data){
    $('#mass-amount').value = it.data.amount;
    setSelectValue('#mass-from', it.data.from);
    setSelectValue('#mass-to', it.data.to);
    convertMass(); tabButtons.find(function(b){return b.dataset.tab==='mass';}).click();
  }
  if (it.type==='volume' && it.data){
    $('#vol-amount').value = it.data.amount;
    setSelectValue('#vol-from', it.data.from);
    setSelectValue('#vol-to', it.data.to);
    convertVolume(); tabButtons.find(function(b){return b.dataset.tab==='volume';}).click();
  }
  if (it.type==='speed' && it.data){
    $('#spd-amount').value = it.data.amount;
    setSelectValue('#spd-from', it.data.from);
    setSelectValue('#spd-to', it.data.to);
    convertSpeed(); tabButtons.find(function(b){return b.dataset.tab==='speed';}).click();
  }
}

// ===== Waluta =====
var curAmount = $('#cur-amount');
var curFrom = $('#cur-from');
var curTo = $('#cur-to');
var curSwap = $('#cur-swap');
var curResult = $('#cur-result');
var curRateInfo = $('#cur-rate-info');
var curSave = $('#cur-save');
var curManualToggle = $('#cur-manual-toggle');
var curManualWrap = $('#cur-manual-wrap');
var curManualRate = $('#cur-manual-rate');
var curManualFrom = $('#cur-manual-from');
var curManualTo = $('#cur-manual-to');
var curRefresh = $('#cur-refresh');
var curSource = $('#cur-source');

CURRENCIES.forEach(function(code){
  if (!Array.prototype.slice.call(curFrom.options).some(function(o){return o.value===code;})){
    curFrom.appendChild(new Option(code, code));
  }
  if (!Array.prototype.slice.call(curTo.options).some(function(o){return o.value===code;})){
    curTo.appendChild(new Option(code, code));
  }
});
curFrom.value = 'PLN'; curTo.value = 'EUR';

function toggleManualRate(state){ curManualWrap.hidden = !state; convertCurrency(); }
curManualToggle.addEventListener('change', function(e){ toggleManualRate(e.target.checked); });

curSwap.addEventListener('click', function(){
  var a = curFrom.value; curFrom.value = curTo.value; curTo.value = a;
  convertCurrency(); refreshChart();
});
[curAmount, curFrom, curTo, curManualRate].forEach(function(el){
  el.addEventListener('input', function(){ convertCurrency(); });
});
[curFrom, curTo].forEach(function(el){
  el.addEventListener('change', function(){ convertCurrency(); refreshChart(); });
});
curRefresh.addEventListener('click', fetchRates);
curSave.addEventListener('click', function(){
  var amount = Number(curAmount.value||0);
  var from = curFrom.value, to = curTo.value;
  var out = computeCurrency(amount, from, to);
  var text = fmtCurrency(amount, from)+' → '+fmtCurrency(out.value, to)+'  (kurs 1 '+from+' = '+out.ratio.toFixed(4)+' '+to+(out.source?(', '+out.source):'')+')';
  addHistory({ type:'currency', text:text, data:{ amount:amount, from:from, to:to, manualRate: curManualToggle.checked ? Number(curManualRate.value) : 0 } });
});

function computeCurrency(amount, from, to){
  if (!amount || from===to){
    updateCurRateUI(1, '(ta sama waluta)');
    return { value: amount||0, ratio:1, source:'' };
  }
  if (curManualToggle.checked){
    var r = Math.max(0, Number(curManualRate.value||0));
    updateCurRateUI(r, 'ręcznie');
    return { value: amount*r, ratio:r, source:'ręcznie' };
  }
  var data = getRates();
  var ratio = 1; var label = 'wbudowane';
  if (data && data.rates && data.rates[from] && data.rates[to]){
    ratio = data.rates[to] / data.rates[from];
    label = data.date ? ('ECB '+data.date) : 'zapisane';
  }
  updateCurRateUI(ratio, label);
  return { value: amount*ratio, ratio:ratio, source:label };
}
function updateCurRateUI(ratio, sourceLabel){
  var amount = Number(curAmount.value||0);
  var out = amount * ratio;
  curResult.textContent = fmtCurrency(out, curTo.value);
  curRateInfo.textContent = 'Kurs: 1 '+curFrom.value+' = '+ratio.toFixed(4)+' '+curTo.value;
  curManualFrom.textContent = curFrom.value;
  curManualTo.textContent = curTo.value;
  curSource.textContent = 'Źródło: '+(sourceLabel||'—');
}
function convertCurrency(){ computeCurrency(Number(curAmount.value||0), curFrom.value, curTo.value); }

function getRates(){
  var saved = localStorage.getItem(LS.rates);
  if (saved) return JSON.parse(saved);
  var seed = { base:'EUR', date:'', rates:{ EUR:1, PLN:4.35, USD:1.10, GBP:0.84, CHF:0.95, JPY:170, CZK:25.2, SEK:11.2, NOK:11.5, AUD:1.61, CAD:1.47 } };
  localStorage.setItem(LS.rates, JSON.stringify(seed));
  return seed;
}
async function fetchRates(){
  curSource.textContent = 'Pobieranie…';
  // 1) exchangerate.host → 2) frankfurter.app → 3) komunikat
  try{
    var j1 = await jfetch('https://api.exchangerate.host/latest?base=EUR', null, 8000);
    var filtered1 = { EUR:1 };
    CURRENCIES.forEach(function(c){ if (j1.rates && j1.rates[c]) filtered1[c] = j1.rates[c]; });
    var stored1 = { base:'EUR', date:j1.date||'', rates:filtered1 };
    localStorage.setItem(LS.rates, JSON.stringify(stored1));
    curSource.textContent = 'Źródło: ECB '+stored1.date;
  }catch(e1){
    try{
      var j2 = await jfetch('https://api.frankfurter.app/latest?from=EUR', null, 8000);
      var filtered2 = { EUR:1 };
      CURRENCIES.forEach(function(c){ if (j2.rates && j2.rates[c]) filtered2[c] = j2.rates[c]; });
      var stored2 = { base:'EUR', date:j2.date||'', rates:filtered2 };
      localStorage.setItem(LS.rates, JSON.stringify(stored2));
      curSource.textContent = 'Źródło: Frankfurter '+stored2.date;
    }catch(e2){
      curSource.textContent = 'Źródło: błąd pobierania – używam zapisanych/wbudowanych';
    }
  }
  convertCurrency();
  refreshChart(true);
}
// ===== Wykres walut =====
var chartCanvas = $('#cur-chart');
var chartRangeBtns = $$('.chip-sm');
var chartRangeDays = 30;
var curChartRefresh = $('#cur-chart-refresh');
var curChartStatus = $('#cur-chart-status');

chartRangeBtns.forEach(function(b){
  b.addEventListener('click', function(){
    chartRangeBtns.forEach(function(x){ x.classList.toggle('active', x===b); });
    chartRangeDays = Number(b.dataset.range);
    refreshChart();
  });
});
if (curChartRefresh){
  curChartRefresh.addEventListener('click', function(){ refreshChart(true); });
}
window.addEventListener('online', function(){ updateChartStatus(); });
window.addEventListener('offline', function(){ updateChartStatus(); });

function updateChartStatus(mode){
  var online = navigator.onLine;
  if (!curChartStatus) return;
  if (online){
    curChartStatus.textContent = mode==='fetched' ? 'Odświeżono dane z sieci.' : 'Online.';
  }else{
    curChartStatus.textContent = 'Offline – pokazuję zapisane dane.';
  }
}
function syntheticSeries(days, ratio){
  var out = [];
  var now = new Date();
  for (var i = days - 1; i >= 0; i--) {
    var d = new Date(now); d.setDate(now.getDate() - i);
    var noise = (Math.random() - 0.5) * ratio * 0.005; // ±0.5%
    out.push({ d: d.toISOString().slice(0,10), v: ratio + noise });
  }
  return out;
}

async function refreshChart(forceNetwork){
  var base = curFrom.value, sym = curTo.value;
  if (base===sym){ drawChart([]); updateChartStatus(); return; }

  var key = base+'->'+sym+'_'+chartRangeDays;
  var cached = getChartCache(key);
  if (cached && !forceNetwork){ drawChart(cached.data); updateChartStatus(); return; }

  var end = new Date();
  var start = new Date(end); start.setDate(end.getDate()-chartRangeDays);
  function fmt(d){ return d.toISOString().slice(0,10); }

  try{
    var url = 'https://api.exchangerate.host/timeseries?start_date='+fmt(start)+'&end_date='+fmt(end)+'&base='+base+'&symbols='+sym;
    var res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    var json = await res.json();
    var out = [];
    var days = Object.keys(json.rates).sort();
    days.forEach(function(d){
      var v = json.rates[d] && json.rates[d][sym];
      if (typeof v==='number') out.push({ d:d, v:v });
    });
    setChartCache(key, out);
    drawChart(out);
    updateChartStatus('fetched');
  } catch (e) {
    var fb = getChartCache(key);
    if (fb && fb.data && fb.data.length) {
      drawChart(fb.data);
      updateChartStatus(); // zwykle offline
    } else {
      var r = computeCurrency(1, base, sym).ratio || 1;
      var pseudo = syntheticSeries(chartRangeDays, r);
      setChartCache(key, pseudo);
      drawChart(pseudo);
      if (curChartStatus) {
        curChartStatus.textContent = 'Brak danych z API – pokazuję linię na bazie aktualnego kursu.';
      }
    }
  }
}
function getChartCache(key){
  var raw = localStorage.getItem(LS.chart); if (!raw) return null;
  var map = JSON.parse(raw); return map[key]||null;
}
function setChartCache(key, data){
  var raw = localStorage.getItem(LS.chart);
  var map = raw ? JSON.parse(raw) : {};
  map[key] = { data:data, saved:Date.now() };
  var keys = Object.keys(map); if (keys.length>30) delete map[keys[0]];
  localStorage.setItem(LS.chart, JSON.stringify(map));
}
function drawChart(points){
  var ctx = chartCanvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var cssW = chartCanvas.clientWidth || (chartCanvas.parentElement ? chartCanvas.parentElement.clientWidth : 600) || 600;
  var cssH = 260;
  chartCanvas.width = Math.floor(cssW*dpr);
  chartCanvas.height = Math.floor(cssH*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);

  var pad = 36;
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(pad, cssH-pad); ctx.lineTo(cssW-pad, cssH-pad); ctx.moveTo(pad, pad); ctx.lineTo(pad, cssH-pad); ctx.stroke();

  if (!points || !points.length){ ctx.fillText('Brak danych do wykresu.', pad+8, pad+8); return; }

  var vals = points.map(function(p){ return p.v; });
  var min = Math.min.apply(null, vals);
  var max = Math.max.apply(null, vals);
  var range = (max-min)||1;
  var left=pad, top=pad, right=cssW-pad, bottom=cssH-pad; var w=right-left, h=bottom-top;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (var i=0;i<=4;i++){
    var y = top + (h*i/4);
    ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
    var val = (max - range*i/4);
    ctx.fillText(val.toFixed(4), 6, y+4);
  }

  ctx.strokeStyle = '#6aa6ff'; ctx.lineWidth = 2; ctx.beginPath();
  for (var j=0;j<points.length;j++){
    var x = left + (w * j / (points.length-1));
    var y2 = top + (h * (1 - (points[j].v - min)/range));
    if (j===0) ctx.moveTo(x,y2); else ctx.lineTo(x,y2);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  var last = points[points.length-1];
  ctx.fillText('Min: '+min.toFixed(4)+'  Max: '+max.toFixed(4)+'  Ostatni: '+last.v.toFixed(4)+'  Punkty: '+points.length, left+4, bottom+24);
}

// ===== Długość =====
var lenAmount=$('#len-amount'), lenFrom=$('#len-from'), lenTo=$('#len-to');
var lenSwap=$('#len-swap'), lenResult=$('#len-result'), lenInfo=$('#len-info'), lenSave=$('#len-save');
Object.keys(LENGTHS).forEach(function(u){
  if (!Array.prototype.slice.call(lenFrom.options).some(function(o){return o.value===u;})) lenFrom.appendChild(new Option(u,u));
  if (!Array.prototype.slice.call(lenTo.options).some(function(o){return o.value===u;})) lenTo.appendChild(new Option(u,u));
});
lenFrom.value='m'; lenTo.value='km';
[lenAmount,lenFrom,lenTo].forEach(function(el){ el.addEventListener('input', convertLength); });
lenSwap.addEventListener('click', function(){ var a=lenFrom.value; lenFrom.value=lenTo.value; lenTo.value=a; convertLength(); });
lenSave.addEventListener('click', function(){
  var amount=Number(lenAmount.value||0), from=lenFrom.value, to=lenTo.value;
  var out=computeLength(amount,from,to);
  addHistory({ type:'length', text: fmtNum(amount)+' '+from+' → '+fmtNum(out.value)+' '+to+'  (1 '+from+' = '+fmtNum(out.ratio)+' '+to+')', data:{amount:amount,from:from,to:to} });
});
function computeLength(amount,from,to){
  if (!amount || from===to){ lenInfo.textContent='Te same jednostki.'; lenResult.textContent=fmtNum(amount||0)+' '+to; return {value:amount||0, ratio:1}; }
  var inM = amount*LENGTHS[from]; var out = inM/LENGTHS[to]; var ratio=LENGTHS[from]/LENGTHS[to];
  lenInfo.textContent='1 '+from+' = '+fmtNum(ratio)+' '+to; lenResult.textContent=fmtNum(out)+' '+to; return {value:out, ratio:ratio};
}
function convertLength(){ computeLength(Number(lenAmount.value||0), lenFrom.value, lenTo.value); }

// ===== Temperatura =====
var tmpAmount=$('#tmp-amount'), tmpFrom=$('#tmp-from'), tmpTo=$('#tmp-to');
var tmpSwap=$('#tmp-swap'), tmpResult=$('#tmp-result'), tmpInfo=$('#tmp-info'), tmpSave=$('#tmp-save');
[tmpAmount,tmpFrom,tmpTo].forEach(function(el){ el.addEventListener('input', convertTemperature); });
tmpSwap.addEventListener('click', function(){ var a=tmpFrom.value; tmpFrom.value=tmpTo.value; tmpTo.value=a; convertTemperature(); });
tmpSave.addEventListener('click', function(){
  var amount=Number(tmpAmount.value||0), from=tmpFrom.value, to=tmpTo.value;
  var out=computeTemperature(amount,from,to);
  addHistory({ type:'temperature', text: fmtNum(amount,2)+' °'+from+' → '+fmtNum(out.value,2)+' °'+to, data:{amount:amount,from:from,to:to} });
});
function computeTemperature(val,from,to){
  if (from===to){ tmpInfo.textContent='Te same jednostki.'; tmpResult.textContent=fmtNum(val,2)+' °'+to; return {value:val}; }
  var c; if (from==='C') c=val; if (from==='F') c=(val-32)*5/9; if (from==='K') c=val-273.15;
  var out; if (to==='C') out=c; if (to==='F') out=(c*9/5)+32; if (to==='K') out=c+273.15;
  tmpInfo.textContent='Przeliczono przez °C.'; tmpResult.textContent=fmtNum(out,2)+' °'+to; return {value:out};
}
function convertTemperature(){ computeTemperature(Number(tmpAmount.value||0), tmpFrom.value, tmpTo.value); }

// ===== Masa =====
var massAmount=$('#mass-amount'), massFrom=$('#mass-from'), massTo=$('#mass-to');
var massSwap=$('#mass-swap'), massResult=$('#mass-result'), massInfo=$('#mass-info'), massSave=$('#mass-save');
Object.keys(MASSES).forEach(function(u){
  if (!Array.prototype.slice.call(massFrom.options).some(function(o){return o.value===u;})) massFrom.appendChild(new Option(u,u));
  if (!Array.prototype.slice.call(massTo.options).some(function(o){return o.value===u;})) massTo.appendChild(new Option(u,u));
});
massFrom.value='kg'; massTo.value='g';
[massAmount,massFrom,massTo].forEach(function(el){ el.addEventListener('input', convertMass); });
massSwap.addEventListener('click', function(){ var a=massFrom.value; massFrom.value=massTo.value; massTo.value=a; convertMass(); });
massSave.addEventListener('click', function(){
  var amount=Number(massAmount.value||0), from=massFrom.value, to=massTo.value;
  var out=computeMass(amount,from,to);
  addHistory({ type:'mass', text: fmtNum(amount)+' '+from+' → '+fmtNum(out.value)+' '+to+'  (1 '+from+' = '+fmtNum(out.ratio)+' '+to+')', data:{amount:amount,from:from,to:to} });
});
function computeMass(amount,from,to){
  if (!amount || from===to){ massInfo.textContent='Te same jednostki.'; massResult.textContent=fmtNum(amount||0)+' '+to; return {value:amount||0, ratio:1}; }
  var inKg=amount*MASSES[from]; var out=inKg/MASSES[to]; var ratio=MASSES[from]/MASSES[to];
  massInfo.textContent='1 '+from+' = '+fmtNum(ratio)+' '+to; massResult.textContent=fmtNum(out)+' '+to; return {value:out, ratio:ratio};
}
function convertMass(){ computeMass(Number(massAmount.value||0), massFrom.value, massTo.value); }

// ===== Objętość =====
var volAmount=$('#vol-amount'), volFrom=$('#vol-from'), volTo=$('#vol-to');
var volSwap=$('#vol-swap'), volResult=$('#vol-result'), volInfo=$('#vol-info'), volSave=$('#vol-save');
Object.keys(VOLUMES).forEach(function(u){
  if (!Array.prototype.slice.call(volFrom.options).some(function(o){return o.value===u;})) volFrom.appendChild(new Option(u,u));
  if (!Array.prototype.slice.call(volTo.options).some(function(o){return o.value===u;})) volTo.appendChild(new Option(u,u));
});
volFrom.value='l'; volTo.value='ml';
[volAmount,volFrom,volTo].forEach(function(el){ el.addEventListener('input', convertVolume); });
volSwap.addEventListener('click', function(){ var a=volFrom.value; volFrom.value=volTo.value; volTo.value=a; convertVolume(); });
volSave.addEventListener('click', function(){
  var amount=Number(volAmount.value||0), from=volFrom.value, to=volTo.value;
  var out=computeVolume(amount,from,to);
  addHistory({ type:'volume', text: fmtNum(amount)+' '+from+' → '+fmtNum(out.value)+' '+to+'  (1 '+from+' = '+fmtNum(out.ratio)+' '+to+')', data:{amount:amount,from:from,to:to} });
});
function computeVolume(amount,from,to){
  if (!amount || from===to){ volInfo.textContent='Te same jednostki.'; volResult.textContent=fmtNum(amount||0)+' '+to; return {value:amount||0, ratio:1}; }
  var inL=amount*VOLUMES[from]; var out=inL/VOLUMES[to]; var ratio=VOLUMES[from]/VOLUMES[to];
  volInfo.textContent='1 '+from+' = '+fmtNum(ratio)+' '+to; volResult.textContent=fmtNum(out)+' '+to; return {value:out, ratio:ratio};
}
function convertVolume(){ computeVolume(Number(volAmount.value||0), volFrom.value, volTo.value); }

// ===== Prędkość =====
var spdAmount=$('#spd-amount'), spdFrom=$('#spd-from'), spdTo=$('#spd-to');
var spdSwap=$('#spd-swap'), spdResult=$('#spd-result'), spdInfo=$('#spd-info'), spdSave=$('#spd-save');
Object.keys(SPEEDS).forEach(function(u){
  if (!Array.prototype.slice.call(spdFrom.options).some(function(o){return o.value===u;})) spdFrom.appendChild(new Option(u,u));
  if (!Array.prototype.slice.call(spdTo.options).some(function(o){return o.value===u;})) spdTo.appendChild(new Option(u,u));
});
spdFrom.value='km/h'; spdTo.value='m/s';
[spdAmount,spdFrom,spdTo].forEach(function(el){ el.addEventListener('input', convertSpeed); });
spdSwap.addEventListener('click', function(){ var a=spdFrom.value; spdFrom.value=spdTo.value; spdTo.value=a; convertSpeed(); });
spdSave.addEventListener('click', function(){
  var amount=Number(spdAmount.value||0), from=spdFrom.value, to=spdTo.value;
  var out=computeSpeed(amount,from,to);
  addHistory({ type:'speed', text: fmtNum(amount)+' '+from+' → '+fmtNum(out.value)+' '+to+'  (1 '+from+' = '+fmtNum(out.ratio)+' '+to+')', data:{amount:amount,from:from,to:to} });
});
function computeSpeed(amount,from,to){
  if (!amount || from===to){ spdInfo.textContent='Te same jednostki.'; spdResult.textContent=fmtNum(amount||0)+' '+to; return {value:amount||0, ratio:1}; }
  var inMS=amount*SPEEDS[from]; var out=inMS/SPEEDS[to]; var ratio=SPEEDS[from]/SPEEDS[to];
  spdInfo.textContent='1 '+from+' = '+fmtNum(ratio)+' '+to; spdResult.textContent=fmtNum(out)+' '+to; return {value:out, ratio:ratio};
}
function convertSpeed(){ computeSpeed(Number(spdAmount.value||0), spdFrom.value, spdTo.value); }

// ===== Init =====
function init(){
  // Uzupełnij selecty, przelicz i narysuj wykres/cachowanie
  renderHistory();
  convertCurrency(); convertLength(); convertTemperature(); convertMass(); convertVolume(); convertSpeed();
  refreshChart(); updateChartStatus();
  window.scrollTo(0,0);
}
init();

// Responsywny resize wykresu
var rsId = 0;
window.addEventListener('resize', function(){
  clearTimeout(rsId);
  rsId = setTimeout(function(){
    var key = curFrom.value+'->'+curTo.value+'_'+chartRangeDays;
    var cache = getChartCache(key);
    drawChart((cache && cache.data) || []);
  }, 150);
});