'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Cloud, CloudOff, Download, History, Plus, RefreshCw, Search, Users, WalletCards, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type WalletName = 'Globe' | 'Smart' | 'GCash';
type TxType = 'sale' | 'payment' | 'reload' | 'adjustment' | 'payable' | 'interest' | 'gcash_cash_in' | 'gcash_cash_out' | 'gcash_personal' | 'cash_add';
type Customer = { id: string; name: string; phone: string };
type Transaction = { id: string; type: TxType; wallet?: WalletName; customerId?: string; amount: number; collectedAmount?: number; paidAmount: number; cashEffect?: number; note: string; createdAt: string; sourceTransactionId?: string; interestCycle?: number };
type LedgerState = { version: number; wallets: Record<WalletName, number>; customers: Customer[]; transactions: Transaction[]; interestAppliedThrough?: string };

const EMPTY_STATE: LedgerState = { version: 0, wallets: { Globe: 0, Smart: 0, GCash: 0 }, customers: [], transactions: [] };
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const dt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const walletLogos: Record<WalletName, string> = { Globe: '/globe-logo.svg', Smart: '/smart-logo.svg', GCash: '/gcash-logo.svg' };

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const debtTypes: TxType[] = ['sale', 'gcash_cash_in', 'payable'];
function debtLots(customerId: string, transactions: Transaction[], through = Number.POSITIVE_INFINITY) {
  const lots = new Map<string, { balance: number; openedAt: number }>();
  const ordered = transactions.filter(tx => tx.customerId === customerId && new Date(tx.createdAt).getTime() <= through).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const tx of ordered) {
    if (debtTypes.includes(tx.type)) {
      const debt = tx.type === 'payable' ? tx.amount : Math.max(0, (tx.collectedAmount ?? tx.amount) - tx.paidAmount);
      if (debt > 0) lots.set(tx.id, { balance: debt, openedAt: new Date(tx.createdAt).getTime() });
    } else if (tx.type === 'interest') {
      const key = tx.sourceTransactionId ?? tx.id; const existing = lots.get(key);
      lots.set(key, { balance: (existing?.balance ?? 0) + tx.amount, openedAt: existing?.openedAt ?? new Date(tx.createdAt).getTime() });
    } else if (tx.type === 'payment') {
      let payment = tx.amount;
      for (const [, lot] of [...lots.entries()].sort((a,b) => a[1].openedAt - b[1].openedAt)) { const used = Math.min(lot.balance, payment); lot.balance -= used; payment -= used; if (payment <= 0) break; }
    }
  }
  return lots;
}
function customerBalance(customerId: string, transactions: Transaction[]) {
  return [...debtLots(customerId, transactions).values()].reduce((total, lot) => total + lot.balance, 0);
}
function walletBalance(wallet: WalletName, state: LedgerState) {
  return state.transactions.reduce((balance, tx) => tx.wallet !== wallet ? balance : tx.type === 'sale' || tx.type === 'gcash_cash_in' || tx.type === 'gcash_personal' ? balance - tx.amount : tx.type === 'gcash_cash_out' || tx.type === 'reload' || tx.type === 'adjustment' ? balance + tx.amount : balance, state.wallets[wallet]);
}
function businessCashBalance(transactions: Transaction[]) {
  return transactions.reduce((balance, tx) => {
    if (typeof tx.cashEffect === 'number') return balance + tx.cashEffect;
    if (tx.type === 'payment') return balance + tx.amount;
    if (tx.type === 'sale' || tx.type === 'gcash_cash_in') return balance + tx.paidAmount;
    return balance;
  }, 0);
}
export default function Home() {
  const [state, setState] = useState<LedgerState>(EMPTY_STATE);
  const [view, setView] = useState<'overview' | 'clients' | 'history'>('overview');
  const [dialog, setDialog] = useState<TxType | 'customer' | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showPayablesOnly, setShowPayablesOnly] = useState(false);
  const [online, setOnline] = useState(true); const [syncing, setSyncing] = useState(false); const [dirty, setDirty] = useState(false); const [ready, setReady] = useState(false); const [cloudChecked, setCloudChecked] = useState(false); const [search, setSearch] = useState(''); const [clientSearch, setClientSearch] = useState(''); const [greeting, setGreeting] = useState('Good day');
  const [form, setForm] = useState({ wallet: 'Globe' as WalletName, customerId: '', amount: '', collectedAmount: '', paidAmount: '', fundingSource: 'cash' as 'cash' | 'capital', note: '', name: '', phone: '' });
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const updateGreeting = () => { const hour = new Date().getHours(); setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'); };
    updateGreeting(); const greetingTimer = window.setInterval(updateGreeting, 60_000);
    const cached = localStorage.getItem('loading-business-ledger'); if (cached) { try { setState(JSON.parse(cached)); } catch {} }
    setOnline(navigator.onLine); setReady(true);
    fetch('/api/state').then(r => r.ok ? r.json() : null).then(remote => { if (remote?.state) setState(current => remote.state.version > current.version ? remote.state : current); }).catch(() => undefined).finally(() => setCloudChecked(true));
    navigator.serviceWorker?.register('/sw.js').catch(() => undefined);
    const onOnline = () => setOnline(true); const onOffline = () => setOnline(false); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    return () => { window.clearInterval(greetingTimer); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);
  useEffect(() => {
    if (!ready) return; localStorage.setItem('loading-business-ledger', JSON.stringify(state)); if (!dirty || !online) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => { setSyncing(true); try { const response = await fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state }) }); if (response.ok) setDirty(false); } catch {} finally { setSyncing(false); } }, 700);
  }, [state, dirty, online, ready]);
  useEffect(() => { if (online && dirty) setState(s => ({ ...s })); }, [online, dirty]);
  useEffect(() => {
    if (!ready || !cloudChecked) return;
    const legacyCalendarInterest = state.transactions.some(tx => tx.type === 'interest' && !tx.sourceTransactionId);
    if (legacyCalendarInterest) { setState(current => ({ ...current, transactions: current.transactions.filter(tx => tx.type !== 'interest' || tx.sourceTransactionId), interestAppliedThrough: undefined, version: Date.now() })); setDirty(true); return; }
    const now = Date.now(); const existing = new Set(state.transactions.filter(tx => tx.type === 'interest' && tx.sourceTransactionId && tx.interestCycle).map(tx => `${tx.sourceTransactionId}:${tx.interestCycle}`));
    const due = state.transactions.filter(tx => debtTypes.includes(tx.type) && tx.customerId).flatMap(source => Array.from({ length: Math.max(0, Math.floor((now - new Date(source.createdAt).getTime()) / THIRTY_DAYS)) }, (_, index) => ({ source, cycle: index + 1, dueAt: new Date(source.createdAt).getTime() + (index + 1) * THIRTY_DAYS }))).filter(item => !existing.has(`${item.source.id}:${item.cycle}`)).sort((a,b) => a.dueAt - b.dueAt);
    if (!due.length) return;
    const added: Transaction[] = []; let working = [...state.transactions];
    for (const item of due) {
      const remaining = debtLots(item.source.customerId!, working, item.dueAt).get(item.source.id)?.balance ?? 0;
      const interest = Number((Math.ceil(remaining * 1.05) - remaining).toFixed(2));
      if (interest > 0) { const tx: Transaction = { id: crypto.randomUUID(), type: 'interest', customerId: item.source.customerId, amount: interest, paidAmount: 0, sourceTransactionId: item.source.id, interestCycle: item.cycle, note: `5% interest after ${item.cycle * 30} days`, createdAt: new Date(item.dueAt).toISOString() }; added.push(tx); working.push(tx); }
    }
    if (added.length) { setState(current => ({ ...current, transactions: [...current.transactions, ...added].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), version: Date.now() })); setDirty(true); }
  }, [ready, cloudChecked, state.version]);

  const balances = useMemo(() => ({ Globe: walletBalance('Globe', state), Smart: walletBalance('Smart', state), GCash: walletBalance('GCash', state) }), [state]);
  const clients = useMemo(() => state.customers.map(c => ({ ...c, balance: Math.max(0, customerBalance(c.id, state.transactions)) })).sort((a,b) => b.balance - a.balance), [state]);
  const totalPayables = clients.reduce((sum, c) => sum + c.balance, 0);
  const totalLoaderFunds = balances.Globe + balances.Smart + balances.GCash;
  const businessCash = businessCashBalance(state.transactions);
  const totalBusinessFunds = totalLoaderFunds + totalPayables + businessCash;
  const todaySales = state.transactions.filter(tx => ['sale','gcash_cash_in'].includes(tx.type) && new Date(tx.createdAt).toDateString() === new Date().toDateString()).reduce((sum, tx) => sum + (tx.collectedAmount ?? tx.amount), 0);
  const filteredTransactions = state.transactions.filter(tx => `${tx.type} ${tx.wallet ?? ''} ${state.customers.find(c => c.id === tx.customerId)?.name ?? ''} ${tx.note}`.toLowerCase().includes(search.toLowerCase()));
  const displayedClients = (showPayablesOnly ? clients.filter(client => client.balance > 0) : clients).filter(client => client.name.toLowerCase().includes(clientSearch.trim().toLowerCase()));
  const selectedClient = clients.find(client => client.id === selectedClientId);
  const selectedClientTransactions = selectedClientId ? state.transactions.filter(tx => tx.customerId === selectedClientId) : [];

  function mutate(updater: (current: LedgerState) => LedgerState) { setState(current => ({ ...updater(current), version: Date.now() })); setDirty(true); }
  function resetForm(wallet: WalletName = 'Globe') { setForm({ wallet, customerId: '', amount: '', collectedAmount: '', paidAmount: '', fundingSource: 'cash', note: '', name: '', phone: '' }); }
  function openDialog(next: typeof dialog, wallet: WalletName = 'Globe') { resetForm(wallet); setDialog(next); }
  function saveCustomer() { if (!form.name.trim()) return; mutate(s => ({ ...s, customers: [{ id: crypto.randomUUID(), name: form.name.trim(), phone: form.phone.trim() }, ...s.customers] })); setDialog(null); }
  function saveTransaction() {
    const amount = Number(form.amount); const collectedAmount = Number(form.collectedAmount || form.amount); const paidAmount = Number(form.paidAmount || 0); if (!dialog || !['sale','payment','reload','adjustment','payable','gcash_cash_in','gcash_cash_out','gcash_personal','cash_add'].includes(dialog) || amount <= 0) return;
    const deductsWallet = dialog === 'sale' || dialog === 'gcash_cash_in' || dialog === 'gcash_personal'; const transactionWallet: WalletName = dialog.startsWith('gcash_') ? 'GCash' : form.wallet;
    if (deductsWallet && amount > balances[transactionWallet]) { alert(`Not enough ${transactionWallet} balance.`); return; } if ((dialog === 'payment' || dialog === 'payable') && !form.customerId) return;
    if (((dialog === 'reload' && form.fundingSource === 'cash') || dialog === 'gcash_cash_out') && (dialog === 'gcash_cash_out' ? collectedAmount : amount) > businessCash) { alert('Not enough Business Cash. Add cash first or choose New capital for the reload.'); return; }
    const hasCollection = dialog === 'sale' || dialog === 'gcash_cash_in' || dialog === 'gcash_cash_out';
    const cashEffect = dialog === 'payment' ? amount : dialog === 'sale' || dialog === 'gcash_cash_in' ? Math.min(collectedAmount, paidAmount) : dialog === 'gcash_cash_out' ? -collectedAmount : dialog === 'reload' && form.fundingSource === 'cash' ? -amount : dialog === 'cash_add' ? amount : 0;
    const tx: Transaction = { id: crypto.randomUUID(), type: dialog, wallet: dialog === 'payment' || dialog === 'payable' || dialog === 'cash_add' ? undefined : transactionWallet, customerId: dialog === 'gcash_personal' || dialog === 'gcash_cash_out' ? undefined : form.customerId || undefined, amount, collectedAmount: hasCollection ? collectedAmount : undefined, paidAmount: dialog === 'gcash_cash_out' ? 0 : hasCollection ? Math.min(collectedAmount, paidAmount) : 0, cashEffect, note: form.note.trim(), createdAt: new Date().toISOString() };
    mutate(s => ({ ...s, transactions: [tx, ...s.transactions] })); setDialog(null);
  }
  function exportCsv() {
    const rows = [['Date','Type','Wallet','Wallet amount','Amount to collect / cash given','Customer','Paid now','Business cash movement','Note'], ...state.transactions.map(tx => [tx.createdAt, tx.type, tx.wallet ?? '', tx.amount, tx.collectedAmount ?? '', state.customers.find(c=>c.id===tx.customerId)?.name ?? '', tx.paidAmount, tx.cashEffect ?? '', tx.note])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = `loading-ledger-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-10">
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between"><button onClick={() => setView('overview')} className="flex items-center gap-3 text-left"><img src="/rico-logo.png" alt="Rico J." className="size-10 rounded-xl object-cover object-top ring-1 ring-black/10"/><div><p className="text-lg font-bold leading-tight">Loading Business</p><p className="text-xs text-muted-foreground">Daily ledger</p></div></button><div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}{online ? (syncing ? 'Syncing…' : dirty ? 'Waiting to sync' : 'Online · Synced') : 'Offline · Saved on device'}</div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8"><div className="mb-6 hidden gap-2 sm:flex"><Button variant={view==='overview'?'secondary':'ghost'} onClick={()=>setView('overview')}><WalletCards/>Overview</Button><Button variant={view==='clients'?'secondary':'ghost'} onClick={()=>setView('clients')}><Users/>Clients</Button><Button variant={view==='history'?'secondary':'ghost'} onClick={()=>setView('history')}><History/>History</Button></div>
      {view === 'overview' && <div className="space-y-7">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-primary">{new Intl.DateTimeFormat('en-PH',{dateStyle:'full'}).format(new Date())}</p><h1 className="mt-1 text-3xl font-black tracking-tight">{greeting}, Boss Rico J.</h1><p className="mt-1 text-muted-foreground">Your wallets, sales, and customer credits in one place.</p></div><Button size="lg" onClick={()=>openDialog('sale')} className="h-11 rounded-xl px-5 shadow-sm"><Plus/>Record load sale</Button></section>
        {!online && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><WifiOff className="mt-0.5 size-5 shrink-0"/><div><strong>You’re working offline.</strong><p className="mt-0.5 text-amber-800">Keep recording transactions. They will sync automatically when internet returns.</p></div></div>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{(['Globe','Smart','GCash'] as WalletName[]).map(name => <Card key={name} className="border-0 shadow-sm ring-1 ring-border"><CardContent className="flex items-center justify-between gap-4 py-1"><div><p className="text-sm font-semibold text-muted-foreground">{name} balance</p><p className={`mt-2 text-2xl font-black tracking-tight ${balances[name] < 500 ? 'text-rose-600' : ''}`}>{peso.format(balances[name])}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><button onClick={()=>openDialog('reload',name)} className="text-xs font-semibold text-primary hover:underline">+ Add reload</button>{name==='GCash'&&<button onClick={()=>openDialog('gcash_cash_in','GCash')} className="text-xs font-semibold text-primary hover:underline">GCash transaction</button>}</div></div><div className="grid h-14 w-20 shrink-0 place-items-center rounded-2xl bg-white p-2 ring-1 ring-border/60"><img src={walletLogos[name]} alt={`${name} logo`} className="max-h-full max-w-full object-contain"/></div></CardContent></Card>)}<Card className="border-0 shadow-sm ring-1 ring-border"><CardContent className="flex items-center justify-between gap-4 py-1"><div><p className="text-sm font-semibold text-muted-foreground">Business Cash</p><p className={`mt-2 text-2xl font-black tracking-tight ${businessCash < 0 ? 'text-rose-600' : ''}`}>{peso.format(businessCash)}</p><button onClick={()=>openDialog('cash_add')} className="mt-2 text-xs font-semibold text-primary hover:underline">+ Add cash / capital</button></div><div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><WalletCards className="size-7"/></div></CardContent></Card></section>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card className="border-0 shadow-sm ring-1 ring-border"><CardContent><p className="text-sm text-muted-foreground">Today’s amount to collect</p><p className="mt-1 text-2xl font-black">{peso.format(todaySales)}</p></CardContent></Card><button className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={()=>{setShowPayablesOnly(true);setView('clients')}}><Card className="h-full border-0 shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary/50"><CardContent><p className="text-sm text-muted-foreground">Total client payables</p><p className="mt-1 text-2xl font-black text-amber-700">{peso.format(totalPayables)}</p><p className="mt-2 text-xs font-semibold text-primary">View clients with payables →</p></CardContent></Card></button><Card className="border-0 shadow-sm ring-1 ring-border"><CardContent><p className="text-sm text-muted-foreground">Total loader funds</p><p className="mt-1 text-2xl font-black">{peso.format(totalLoaderFunds)}</p></CardContent></Card><Card className="border-0 bg-[#172B24] text-white shadow-sm ring-0"><CardContent><p className="text-sm text-white/65">Total Business Funds</p><p className="mt-1 text-2xl font-black">{peso.format(totalBusinessFunds)}</p><p className="mt-2 text-xs text-white/60">Loader funds + business cash + client payables</p></CardContent></Card></section>
        <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]"><Card className="border-0 shadow-sm ring-1 ring-border"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg font-bold">Recent transactions</CardTitle><p className="text-sm text-muted-foreground">Latest activity across all wallets</p></div><Button variant="ghost" onClick={()=>setView('history')}>View all</Button></CardHeader><CardContent className="space-y-1">{state.transactions.length ? state.transactions.slice(0,5).map(tx=><TransactionRow key={tx.id} tx={tx} customer={state.customers.find(c=>c.id===tx.customerId)?.name}/>) : <Empty title="No transactions yet" text="Record your first load sale, customer payment, or wallet reload."/>}</CardContent></Card><Card className="border-0 bg-[#172B24] text-white shadow-sm ring-0"><CardHeader><div className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Users/></div><CardTitle className="mt-3 text-lg font-bold text-white">Client payables</CardTitle></CardHeader><CardContent><p className="text-4xl font-black">{peso.format(totalPayables)}</p><p className="mt-2 text-sm text-white/65">{clients.filter(c=>c.balance>0).length} clients have unpaid balances</p><Button onClick={()=>setView('clients')} className="mt-7 h-10 w-full bg-white text-[#172B24] hover:bg-white/90">View client accounts</Button></CardContent></Card></section>
      </div>}
      {view === 'clients' && <div className="space-y-5"><section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">{showPayablesOnly?'Clients with payables':'Client accounts'}</h1>{showPayablesOnly&&<Button variant="ghost" size="sm" onClick={()=>setShowPayablesOnly(false)}>Show all clients</Button>}</div><p className="mt-1 text-muted-foreground">Click a client card to view their complete transaction history.</p><p className="mt-2 text-xs font-semibold text-amber-700">Each unpaid purchase earns 5% after every 30 days from its purchase date, rounded up to the next whole peso.</p></div><Button onClick={()=>openDialog('customer')}><Plus/>Add client</Button></div><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} className="h-11 pl-9" placeholder="Search client name…"/></div></section><div className="grid gap-3">{displayedClients.length ? displayedClients.map(client=><Card key={client.id} role="button" tabIndex={0} onClick={()=>setSelectedClientId(client.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedClientId(client.id)}}} className="cursor-pointer border-0 shadow-sm ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary/50"><CardContent className="grid grid-cols-[minmax(0,1fr)_minmax(132px,44%)] items-center gap-4 sm:grid-cols-[minmax(0,1fr)_170px]"><div className="min-w-0"><p className="truncate text-lg font-bold">{client.name}</p><p className="mt-1 text-xs font-semibold text-primary">View transactions →</p><div className="mt-4"><p className="text-xs text-muted-foreground">Amount payable</p><p className={`text-xl font-black ${client.balance>0?'text-amber-700':'text-emerald-700'}`}>{peso.format(client.balance)}</p></div></div><div className="grid gap-2 border-l pl-3 sm:pl-4"><Button variant="secondary" className="w-full" onClick={e=>{e.stopPropagation();resetForm();setForm(f=>({...f,customerId:client.id}));setDialog('payable')}}><Plus/>Add payable</Button><Button variant="outline" className="w-full" disabled={client.balance<=0} onClick={e=>{e.stopPropagation();resetForm();setForm(f=>({...f,customerId:client.id,amount:String(client.balance)}));setDialog('payment')}}>Record payment</Button></div></CardContent></Card>) : <Empty title={clientSearch?'No matching clients':showPayablesOnly?'No outstanding payables':'No clients yet'} text={clientSearch?'Try another client name.':showPayablesOnly?'All client accounts are fully paid.':'Add clients when you allow them to pay later.'}/>}</div></div>}
      {view === 'history' && <div className="space-y-5"><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">Transaction history</h1><p className="mt-1 text-muted-foreground">A complete record of sales, payments, and reloads.</p></div><Button variant="outline" onClick={exportCsv} disabled={!state.transactions.length}><Download/>Export CSV</Button></section><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} className="h-11 pl-9" placeholder="Search wallet, client, note, or type…"/></div><Card className="border-0 shadow-sm ring-1 ring-border"><CardContent className="divide-y p-2">{filteredTransactions.length ? filteredTransactions.map(tx=><TransactionRow key={tx.id} tx={tx} customer={state.customers.find(c=>c.id===tx.customerId)?.name}/>) : <Empty title="No matching transactions" text="Try another search or record a new transaction."/>}</CardContent></Card></div>}
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card px-3 py-2 sm:hidden"><div className="mx-auto flex max-w-sm justify-around">{([['overview',WalletCards,'Overview'],['clients',Users,'Clients'],['history',History,'History']] as const).map(([key,Icon,label])=><button key={key} onClick={()=>setView(key)} className={`flex min-w-20 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold ${view===key?'bg-primary/10 text-primary':'text-muted-foreground'}`}><Icon className="size-5"/>{label}</button>)}</div></nav>
    <Dialog open={dialog!==null} onOpenChange={open=>!open&&setDialog(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{dialog==='sale'?'Record load sale':dialog==='payment'?'Record client payment':dialog==='payable'?'Add existing payable':dialog==='reload'?'Add wallet reload':dialog==='cash_add'?'Add Business Cash':dialog==='adjustment'?'Adjust wallet balance':dialog?.startsWith('gcash_')?'Record GCash transaction':'Add client'}</DialogTitle><DialogDescription>{dialog==='sale'?'Enter the wallet deduction and the separate amount you will collect.':dialog==='payment'?'This reduces the client’s unpaid balance and adds the payment to Business Cash.':dialog==='payable'?'This updates the client balance without deducting from any loader wallet.':dialog==='reload'?'Move Business Cash into a wallet, or record new capital.':dialog==='cash_add'?'Record opening cash or additional capital added to the business.':dialog==='adjustment'?'Use this to set up or correct a wallet balance.':dialog?.startsWith('gcash_')?'Cash in and cash out move money between GCash and Business Cash. Personal use reduces the business.':'Create a client account for pay-later sales.'}</DialogDescription></DialogHeader>
      {dialog==='customer'?<div className="space-y-4"><Labelled label="Client name"><Input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Maria Santos"/></Labelled></div>:<div className="space-y-4">
        {dialog?.startsWith('gcash_')&&<Labelled label="GCash transaction type"><NativeSelect value={dialog} onChange={e=>setDialog(e.target.value as TxType)}><NativeSelectOption value="gcash_cash_in">Cash in</NativeSelectOption><NativeSelectOption value="gcash_cash_out">Cash out</NativeSelectOption><NativeSelectOption value="gcash_personal">Personal / store / online use</NativeSelectOption></NativeSelect></Labelled>}
        {dialog!=='payment'&&dialog!=='payable'&&dialog!=='cash_add'&&!dialog?.startsWith('gcash_')&&<Labelled label="Wallet"><NativeSelect value={form.wallet} onChange={e=>setForm({...form,wallet:e.target.value as WalletName})}><NativeSelectOption value="Globe">Globe</NativeSelectOption><NativeSelectOption value="Smart">Smart</NativeSelectOption><NativeSelectOption value="GCash">GCash</NativeSelectOption></NativeSelect></Labelled>}
        {dialog==='reload'&&<Labelled label="Money source"><NativeSelect value={form.fundingSource} onChange={e=>setForm({...form,fundingSource:e.target.value as 'cash'|'capital'})}><NativeSelectOption value="cash">Business Cash (transfer)</NativeSelectOption><NativeSelectOption value="capital">New capital (add funds)</NativeSelectOption></NativeSelect></Labelled>}
        {(dialog==='sale'||dialog==='payment'||dialog==='payable'||dialog==='gcash_cash_in'||dialog==='gcash_cash_out')&&<Labelled label={dialog==='payment'||dialog==='payable'?'Client':'Client (optional)'}><NativeSelect value={form.customerId} onChange={e=>setForm({...form,customerId:e.target.value})}><NativeSelectOption value="">{dialog==='payment'||dialog==='payable'?'Select client':'Walk-in customer'}</NativeSelectOption>{state.customers.map(c=><NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}</NativeSelect></Labelled>}
        <Labelled label={dialog==='sale'?'Wallet deduction':dialog==='gcash_cash_out'?'GCash amount received':dialog==='gcash_cash_in'?'GCash amount sent':dialog==='gcash_personal'?'GCash amount used':dialog==='cash_add'?'Cash added':'Amount'}><Input autoFocus type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00" inputMode="decimal"/></Labelled>
        {(dialog==='sale'||dialog==='gcash_cash_in'||dialog==='gcash_cash_out')&&<Labelled label={dialog==='gcash_cash_out'?'Cash given to customer':'Amount to collect'}><Input type="number" min="0" step="0.01" value={form.collectedAmount} onChange={e=>setForm({...form,collectedAmount:e.target.value})} placeholder="Defaults to the wallet amount" inputMode="decimal"/></Labelled>}
        {dialog==='gcash_cash_in'&&<Labelled label="Amount paid now"><Input type="number" min="0" step="0.01" value={form.paidAmount} onChange={e=>setForm({...form,paidAmount:e.target.value})} placeholder="Leave 0 if client will pay later" inputMode="decimal"/></Labelled>}
        {dialog!=='sale'&&<Labelled label="Note (optional)"><Textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder={dialog==='payable'?'e.g. Existing balance before using this app':dialog==='gcash_personal'?'e.g. Online purchase or store payment':'Reference, mobile number, or details'}/></Labelled>}
        {((dialog==='sale'&&Number(form.amount)>balances[form.wallet])||((dialog==='gcash_cash_in'||dialog==='gcash_personal')&&Number(form.amount)>balances.GCash))&&<p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><CircleAlert className="size-4 shrink-0"/>Insufficient {dialog?.startsWith('gcash_')?'GCash':form.wallet} balance.</p>}
        {(((dialog==='reload'&&form.fundingSource==='cash')||dialog==='gcash_cash_out')&&Number(dialog==='gcash_cash_out'?(form.collectedAmount||form.amount):form.amount)>businessCash)&&<p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><CircleAlert className="size-4 shrink-0"/>Insufficient Business Cash.</p>}
      </div>}
      <DialogFooter><Button variant="outline" onClick={()=>setDialog(null)}>Cancel</Button><Button onClick={dialog==='customer'?saveCustomer:saveTransaction}><Check/>Save record</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={selectedClientId!==null} onOpenChange={open=>!open&&setSelectedClientId(null)}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{selectedClient?.name ?? 'Client'} transactions</DialogTitle><DialogDescription>Complete account activity · Current payable: {peso.format(selectedClient?.balance ?? 0)}</DialogDescription></DialogHeader><div className="divide-y rounded-xl border p-2">{selectedClientTransactions.length?selectedClientTransactions.map(tx=><TransactionRow key={tx.id} tx={tx} customer={selectedClient?.name}/>):<Empty title="No transactions yet" text="This client has no recorded activity."/>}</div><DialogFooter><Button variant="outline" onClick={()=>setSelectedClientId(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function Labelled({label,children}:{label:string;children:React.ReactNode}) { return <label className="grid gap-1.5 text-sm font-semibold">{label}{children}</label> }
function Empty({title,text}:{title:string;text:string}) { return <div className="grid place-items-center px-4 py-10 text-center"><div className="grid size-11 place-items-center rounded-full bg-muted"><History className="size-5 text-muted-foreground"/></div><p className="mt-3 font-bold">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p></div> }
function TransactionRow({tx,customer}:{tx:Transaction;customer?:string}) {
  const collection = tx.collectedAmount ?? tx.amount;
  const config = tx.type==='sale'?{label:'Load sale',Icon:ArrowUpRight,tone:'bg-blue-50 text-blue-700',amount:peso.format(collection),walletDetail:`Wallet -${peso.format(tx.amount)}`}
    : tx.type==='gcash_cash_in'?{label:'GCash cash in',Icon:ArrowUpRight,tone:'bg-blue-50 text-blue-700',amount:peso.format(collection),walletDetail:`GCash -${peso.format(tx.amount)}`}
    : tx.type==='gcash_cash_out'?{label:'GCash cash out',Icon:ArrowDownLeft,tone:'bg-emerald-50 text-emerald-700',amount:`Cash -${peso.format(collection)}`,walletDetail:`GCash +${peso.format(tx.amount)}`}
    : tx.type==='gcash_personal'?{label:'Personal GCash use',Icon:ArrowUpRight,tone:'bg-slate-100 text-slate-700',amount:`-${peso.format(tx.amount)}`,walletDetail:''}
    : tx.type==='payment'?{label:'Client payment',Icon:ArrowDownLeft,tone:'bg-emerald-50 text-emerald-700',amount:peso.format(tx.amount),walletDetail:`Cash +${peso.format(tx.amount)}`}
    : tx.type==='cash_add'?{label:'Business cash added',Icon:Plus,tone:'bg-emerald-50 text-emerald-700',amount:`+${peso.format(tx.amount)}`,walletDetail:'New business capital'}
    : tx.type==='payable'?{label:'Existing payable added',Icon:Plus,tone:'bg-violet-50 text-violet-700',amount:`+${peso.format(tx.amount)}`,walletDetail:''}
    : tx.type==='interest'?{label:'30-day interest',Icon:RefreshCw,tone:'bg-rose-50 text-rose-700',amount:`+${peso.format(tx.amount)}`,walletDetail:''}
    : {label:tx.type==='reload'?'Wallet reload':'Balance adjustment',Icon:RefreshCw,tone:'bg-amber-50 text-amber-700',amount:`+${peso.format(tx.amount)}`,walletDetail:tx.type==='reload'&&tx.cashEffect&&tx.cashEffect<0?`Cash -${peso.format(Math.abs(tx.cashEffect))}`:''};
  const payable = ['sale','gcash_cash_in'].includes(tx.type) ? Math.max(0, collection-tx.paidAmount) : 0;
  return <div className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${config.tone}`}><config.Icon className="size-5"/></div><div className="min-w-0 flex-1"><p className="font-semibold">{config.label}</p><p className="truncate text-xs text-muted-foreground">{[customer,tx.wallet,config.walletDetail,tx.note].filter(Boolean).join(' · ')||'No details'} · {dt.format(new Date(tx.createdAt))}</p></div><div className="text-right"><p className="font-bold tabular-nums">{config.amount}</p>{payable>0&&<p className="text-xs text-amber-700">{peso.format(payable)} payable</p>}</div></div>
}
