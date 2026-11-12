/* Ask Rico v1.0.9. Separate UI; never writes to loading-business-ledger. */
(()=>{
  'use strict';
  const root=document.getElementById('ask-rico-root');
  if(!root)return;
  const WORKER_KEY='ask-rico-worker-url-v1';
  const STATE={endpoint:localStorage.getItem(WORKER_KEY)||'',code:'',messages:[],busy:false};
  const esc=(id)=>root.querySelector('#'+id);
  root.innerHTML=`
    <button id="ask-rico-launch" type="button" aria-expanded="false" aria-controls="ask-rico-panel"><span class="ask-rico-spark">✦</span><span>Ask Rico</span></button>
    <section id="ask-rico-panel" role="dialog" aria-modal="false" aria-label="Ask Rico assistant" hidden>
      <header class="ask-rico-head"><span class="ask-rico-mark">✦</span><div class="ask-rico-head-title"><strong>Ask Rico</strong><small>OpenAI powered • Read-only</small></div><button id="ask-rico-settings-btn" class="ask-rico-icon-button" type="button" title="Connection settings" aria-label="Connection settings">⚙</button><button id="ask-rico-close" class="ask-rico-icon-button" type="button" aria-label="Close Ask Rico">×</button></header>
      <div class="ask-rico-disclosure">Your ledger stays on this device unless you enable the ledger summary option. Paid AI replies need internet and API credits.</div>
      <div id="ask-rico-messages" aria-live="polite"></div>
      <div class="ask-rico-controls">
        <div class="ask-rico-options"><label><input id="ask-rico-include-summary" type="checkbox"> Use ledger summary</label><label><input id="ask-rico-include-names" type="checkbox" disabled> Include client names</label></div>
        <form id="ask-rico-form" class="ask-rico-compose"><textarea id="ask-rico-text" aria-label="Message Ask Rico" placeholder="Ask a question…" rows="1" maxlength="1200" required></textarea><button id="ask-rico-send" type="submit">Send</button></form>
        <div class="ask-rico-tip">Enter sends • Shift+Enter adds a line. No transactions are changed.</div>
      </div>
      <div id="ask-rico-settings" hidden>
        <strong>Connect your paid OpenAI assistant</strong>
        <p class="ask-rico-settings-caption">First deploy the included Cloudflare Worker. Your OpenAI API key belongs in the Worker's secret settings, never in this app.</p>
        <label class="ask-rico-field">Cloudflare Worker URL<input class="ask-rico-input" id="ask-rico-endpoint" type="url" placeholder="https://ask-rico.your-name.workers.dev" autocomplete="off"></label>
        <label class="ask-rico-field">Private Ask Rico access code<input class="ask-rico-input" id="ask-rico-access" type="password" placeholder="Code configured in Worker" autocomplete="off"></label>
        <p class="ask-rico-settings-caption">The Worker URL is saved on this device. Your access code remains in memory only and must be re-entered after a page reload.</p>
        <div class="ask-rico-settings-actions"><button class="ask-rico-action primary" type="button" id="ask-rico-save">Save & close</button><button class="ask-rico-action" type="button" id="ask-rico-cancel">Cancel</button></div>
        <p id="ask-rico-settings-status" class="ask-rico-status" role="status"></p>
      </div>
    </section>`;
  const panel=esc('ask-rico-panel'),log=esc('ask-rico-messages'),settings=esc('ask-rico-settings');
  const input=esc('ask-rico-text'),btn=esc('ask-rico-send');
  function message(text,kind='bot',record=true){
    const el=document.createElement('div');el.className='ask-rico-message '+kind;el.textContent=text;
    log.appendChild(el);log.scrollTop=log.scrollHeight;
    if(record&&(kind==='user'||kind==='bot')){
      STATE.messages.push({role:kind==='bot'?'assistant':'user',content:String(text).slice(0,1200)});
      if(STATE.messages.length>12)STATE.messages.splice(0,STATE.messages.length-12);
    }
  }
  function showSettings(){
    esc('ask-rico-endpoint').value=STATE.endpoint;
    esc('ask-rico-access').value=STATE.code;
    esc('ask-rico-settings-status').textContent='';
    settings.hidden=false;
  }
  function saveSettings(){
    const u=esc('ask-rico-endpoint').value.trim().replace(/\/+$/,'');
    const code=esc('ask-rico-access').value.trim();
    let parsed;
    try{parsed=new URL(u);}catch(_){esc('ask-rico-settings-status').textContent='Enter a valid Worker URL.';return;}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash){esc('ask-rico-settings-status').textContent='Use a secure https:// Worker URL with no password or query.';return;}
    if(!code||code.length<12){esc('ask-rico-settings-status').textContent='Enter the private access code (at least 12 characters).';return;}
    STATE.endpoint=parsed.origin+parsed.pathname.replace(/\/+$/,'');STATE.code=code;
    localStorage.setItem(WORKER_KEY,STATE.endpoint);
    settings.hidden=true;
    message('Connection settings saved. Ask your question when online. I can read ledger summaries only if you enable the option above.','bot',false);
    input.focus();
  }
  function dateMillis(tx){const t=Date.parse(tx.createdAt);return Number.isFinite(t)?t:0;}
  function amount(x){const v=Number(x||0);return Number.isFinite(v)?Math.round(v*100)/100:0;}
  function snapshot(includeNames){
    let data;
    try{data=JSON.parse(localStorage.getItem('loading-business-ledger')||'null');}catch(_){return {status:'unreadable local ledger'};}
    if(!data||!Array.isArray(data.transactions))return {status:'no local ledger loaded'};
    const list=data.transactions.slice().sort((a,b)=>dateMillis(a)-dateMillis(b));
    const wallets={Globe:amount(data.wallets?.Globe),Smart:amount(data.wallets?.Smart),GCash:amount(data.wallets?.GCash)};
    const balances=new Map();
    for(const c of (Array.isArray(data.customers)?data.customers:[]))balances.set(c.id,new Map());
    let businessCash=0;
    for(const t of list){
      const v=amount(t.amount),wallet=t.wallet;
      if(wallet in wallets){
        if(['sale','gcash_cash_in','gcash_personal'].includes(t.type))wallets[wallet]-=v;
        else if(['gcash_cash_out','reload','adjustment'].includes(t.type))wallets[wallet]+=v;
      }
      if(typeof t.cashEffect==='number')businessCash+=amount(t.cashEffect);
      else if(t.type==='payment')businessCash+=v;
      else if(['sale','gcash_cash_in'].includes(t.type))businessCash+=amount(t.paidAmount);
      const ledger=balances.get(t.customerId);if(!ledger)continue;
      if(['sale','gcash_cash_in','payable'].includes(t.type)){
        const due=t.type==='payable'?v:Math.max(0,amount(t.collectedAmount??v)-amount(t.paidAmount));
        if(due>0)ledger.set(t.id,{amount:due,time:dateMillis(t)});
      }else if(t.type==='interest'){
        const id=t.sourceTransactionId||t.id;
        const previous=ledger.get(id);
        ledger.set(id,{amount:amount(previous?.amount)+v,time:previous?.time||dateMillis(t)});
      }else if(t.type==='payment'){
        let remaining=v;
        for(const debt of [...ledger.values()].sort((a,b)=>a.time-b.time)){
          const paid=Math.min(debt.amount,remaining);debt.amount-=paid;remaining-=paid;if(remaining<=0)break;
        }
      }
    }
    const clients=(Array.isArray(data.customers)?data.customers:[]).map((c,i)=>{
      const total=[...(balances.get(c.id)||new Map()).values()].reduce((a,b)=>a+Math.max(0,b.amount),0);
      return {client:includeNames?String(c.name||'Unnamed').slice(0,70):`Client ${i+1}`,outstanding:amount(total)};
    });
    const debtors=clients.filter(c=>c.outstanding>0).sort((a,b)=>b.outstanding-a.outstanding);
    const recent=list.filter(t=>dateMillis(t)>Date.now()-30*86400000);
    const categories={};for(const t of recent)categories[t.type]=(categories[t.type]||0)+1;
    const safeWallet=Object.fromEntries(Object.entries(wallets).map(([k,v])=>[k,amount(v)]));
    return {asOf:new Date().toISOString(),currency:'PHP',walletBalances:safeWallet,businessCash:amount(businessCash),customerCount:clients.length,customersWithOutstanding:debtors.length,accountsReceivable:amount(debtors.reduce((s,c)=>s+c.outstanding,0)),last30Days:{transactionCount:recent.length,countsByType:categories},topDebtors:debtors.slice(0,12),privacy:includeNames?'customer names included by user choice':'customer names anonymized; phone numbers and notes excluded'};
  }
  async function submit(e){
    if(e)e.preventDefault();
    const q=input.value.trim();if(STATE.busy||!q)return;
    if(!STATE.endpoint||!STATE.code){showSettings();esc('ask-rico-settings-status').textContent='Set the Cloudflare URL and private access code before sending.';return;}
    if(!navigator.onLine){message('Ask Rico needs an internet connection for paid OpenAI replies. The original AI tab remains available offline.','error',false);return;}
    message(q,'user');input.value='';STATE.busy=true;btn.disabled=true;btn.textContent='…';
    const pending=document.createElement('div');pending.className='ask-rico-message bot';pending.textContent='Ask Rico is thinking…';log.appendChild(pending);log.scrollTop=log.scrollHeight;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
    try{
      const useLedger=esc('ask-rico-include-summary').checked;
      const body={messages:STATE.messages.slice(-10),ledgerSnapshot:useLedger?snapshot(esc('ask-rico-include-names').checked):null};
      const res=await fetch(STATE.endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Ask-Rico-Code':STATE.code},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
      const data=await res.json().catch(()=>({error:'Invalid response from backend'}));
      if(!res.ok)throw new Error(data.error||('Worker HTTP '+res.status));
      pending.remove();message(data.reply||'No answer returned.','bot');
      if(typeof data.remainingToday==='number')esc('ask-rico-settings-btn').title='Connection settings • '+data.remainingToday+' requests left today';
    }catch(error){pending.remove();message(error.name==='AbortError'?'Request timed out. Try a shorter question.':String(error.message||error),'error',false);}
    finally{clearTimeout(timeout);STATE.busy=false;btn.disabled=false;btn.textContent='Send';input.focus();}
  }
  function toggle(){panel.hidden=!panel.hidden;esc('ask-rico-launch').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){if(!STATE.messages.length&&log.childElementCount===0)message('Hello, Boss! I’m Ask Rico, your paid OpenAI assistant. Ask anything about your loading business or general questions. Enable “Use ledger summary” when you want me to analyze your actual figures.','bot',false);if(!STATE.endpoint||!STATE.code)showSettings();else input.focus();}}
  esc('ask-rico-launch').addEventListener('click',toggle);
  esc('ask-rico-close').addEventListener('click',toggle);
  esc('ask-rico-settings-btn').addEventListener('click',()=>settings.hidden?showSettings():settings.hidden=true);
  esc('ask-rico-save').addEventListener('click',saveSettings);
  esc('ask-rico-cancel').addEventListener('click',()=>settings.hidden=true);
  esc('ask-rico-form').addEventListener('submit',submit);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submit();}});
  esc('ask-rico-include-summary').addEventListener('change',event=>{const names=esc('ask-rico-include-names');names.disabled=!event.target.checked;if(!event.target.checked)names.checked=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){if(!settings.hidden)settings.hidden=true;else toggle();}});
})();
