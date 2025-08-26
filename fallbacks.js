/* fallbacks.js v3 — 4 źródła kursów + timeout + prosty timeseries
   + przejęcie kliknięcia przycisku „Pobierz kursy”
   Ładuje się PO script.js i nadpisuje fetchRates() oraz refreshChart(). */

(function(){
  // Fetch JSON z timeoutem (9s), działa też bez AbortController
  function jfetch(url, timeoutMs){
    timeoutMs = timeoutMs || 9000;
    if (typeof AbortController === 'function'){
      var ctrl = new AbortController();
      var id = setTimeout(function(){ try{ctrl.abort();}catch(_){} }, timeoutMs);
      return fetch(url, {signal: ctrl.signal, cache:'no-store', mode:'cors'})
        .then(function(r){ clearTimeout(id); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
    }else{
      return Promise.race([
        fetch(url, {cache:'no-store', mode:'cors'}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }),
        new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('timeout')); }, timeoutMs); })
      ]);
    }
  }
  function setSource(txt){ var el=document.querySelector('#cur-source'); if(el) el.textContent=txt; }
  function setStatus(txt){ var el=document.querySelector('#cur-chart-status'); if(el) el.textContent=txt; }

  // Providery "latest" (EUR jako baza)
  var providersLatest = [
    function(){ return jfetch('https://api.frankfurter.app/latest?from=EUR').then(j=>({date:j.date, rates:j.rates, name:'Frankfurter'})); },
    function(){ return jfetch('https://api.exchangerate.host/latest?base=EUR').then(j=>({date:j.date, rates:j.rates, name:'ECB'})); },
    function(){ return jfetch('https://open.er-api.com/v6/latest/EUR').then(j=>({date:(j.time_last_update_utc||'').split(' ')[0], rates:j.rates, name:'ER-API'})); },
    function(){ return jfetch('https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/eur.json')
      .then(function(j){ var r={}; Object.keys(j.eur||{}).forEach(function(k){ r[k.toUpperCase()]=j.eur[k]; }); return {date:j.date||'', rates:r, name:'jsDelivr'}; }); }
  ];

  // === Nadpisanie fetchRates ===
  window.fetchRates = async function(){
    setSource('Pobieranie…');
    var CCY = (window.CURRENCIES || []);
    var LS_KEY = window.LS ? window.LS.rates : 'unitconv_rates_v3';
    for (var i=0;i<providersLatest.length;i++){
      try{
        var data = await providersLatest[i]();
        var filtered = { EUR:1 };
        CCY.forEach(function(c){ if (data.rates && data.rates[c]) filtered[c]=data.rates[c]; });
        var stored = { base:'EUR', date:data.date||'', rates:filtered };
        localStorage.setItem(LS_KEY, JSON.stringify(stored));
        setSource('Źródło: '+data.name + (stored.date ? ' '+stored.date : ''));
        if (window.convertCurrency) window.convertCurrency();
        if (window.refreshChart) window.refreshChart(true);
        return;
      }catch(e){ /* próbuj kolejnego */ }
    }
    setSource('Źródło: błąd pobierania – używam zapisanych/wbudowanych');
    if (window.convertCurrency) window.convertCurrency();
    if (window.refreshChart) window.refreshChart(true);
  };

  // === Nadpisanie refreshChart (timeseries Frankfurter + fallback syntetyczny) ===
  window.refreshChart = async function(forceNetwork){
    var baseEl = document.querySelector('#cur-from');
    var toEl   = document.querySelector('#cur-to');
    if (!baseEl || !toEl) return;

    var base = baseEl.value, sym = toEl.value;
    var days = window.chartRangeDays || 30;
    if (base===sym){ window.drawChart && window.drawChart([]); setStatus('—'); return; }

    var key = base+'->'+sym+'_'+days;
    var cached = window.getChartCache && window.getChartCache(key);
    if (cached && !forceNetwork){ window.drawChart && window.drawChart(cached.data); setStatus('Z pamięci.'); return; }

    var end = new Date(), start = new Date(end); start.setDate(end.getDate()-days);
    function fmt(d){ return d.toISOString().slice(0,10); }

    try{
      var url = 'https://api.frankfurter.app/'+fmt(start)+'..'+fmt(end)+'?from='+base+'&to='+sym;
      var j = await jfetch(url, 9000);
      var out = []; Object.keys(j.rates||{}).sort().forEach(function(d){
        var v = j.rates[d] && j.rates[d][sym]; if (typeof v==='number') out.push({d:d, v:v});
      });
      if (out.length){
        window.setChartCache && window.setChartCache(key, out);
        window.drawChart && window.drawChart(out);
        setStatus('Odświeżono dane z sieci.');
        return;
      }
    }catch(_){}

    // fallback: syntetyka (zawsze coś narysuj)
    var r = (window.computeCurrency ? window.computeCurrency(1, base, sym).ratio : 1) || 1;
    var pseudo = window.syntheticSeries ? window.syntheticSeries(days, r) : (function(){
      var a=[], now=new Date();
      for (var i=days-1;i>=0;i--){ var d=new Date(now); d.setDate(now.getDate()-i); a.push({d:d.toISOString().slice(0,10), v:r}); }
      return a;
    })();
    window.setChartCache && window.setChartCache(key, pseudo);
    window.drawChart && window.drawChart(pseudo);
    setStatus('Pokazuję wykres syntetyczny (brak danych historycznych).');
  };

  // === PRZEJĘCIE PRZYCISKU „POBIERZ KURSY” ===
  function hookButton(){
    var btn = document.getElementById('cur-refresh');
    if (!btn) return;
    // capture + stopImmediatePropagation: blokuje stary handler i wywołuje nowy
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      window.fetchRates();
    }, {capture:true});
  }

  // DOM jest już zparsowany (defer), ale na wszelki wypadek:
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hookButton);
  } else {
    hookButton();
  }

  // Opcjonalnie: automatyczne pobranie raz przy starcie (jeśli online)
  if (navigator.onLine){
    try{ window.fetchRates(); }catch(_){}
  }
})();