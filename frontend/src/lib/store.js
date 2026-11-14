import { useSyncExternalStore } from 'react';
import { apiUrl } from './api.js';

const KEY = 'as-metal-commerce-react-v1';
const iso = () => new Date().toISOString().slice(0, 10);
const uniq = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const seededMetals = [
  ['Mild Steel',70], ['Stainless Steel 304',230], ['Stainless Steel 316',320],
  ['Brass',520], ['Aluminium',240], ['Copper',850], ['Tool Steel D2',420],
  ['HCHCR Steel',380], ['EN8 Steel',95], ['Bronze',640]
];
const seededProducts = [
  ['Round Blanking Die','Tool Steel D2',1.2,600,'round'],
  ['Square Punch Die','HCHCR Steel',1.5,550,'square'],
  ['Hex Nut Die','EN8 Steel',2,700,'hex'],
  ['Slot Piercing Die','Tool Steel D2',1,650,'slot'],
  ['Star Emboss Die','Brass',0.8,900,'star'],
  ['Washer Die','HCHCR Steel',1.1,500,'round'],
  ['Progressive Die','Tool Steel D2',4.5,2500,'slot'],
  ['Nakas Name Plate','Brass',0.6,450,'square'],
  ['Logo Nakas Emboss','Copper',0.7,800,'star'],
  ['Wire Draw Die','Tool Steel D2',0.5,700,'round']
];

export function defaults() {
  return {
    version: 1,
    shop: { name: 'AS Metal Dies & Nakas', tagline: 'Precision Dies • Nakas • Metal Works',
      address: 'Update company address in Staff → Settings', phone: '', gstin: '', tax: 18,
      upi: '', cod: true, theme: 'light' },
    metals: seededMetals.map(([name,rate]) => ({id: uniq(), name, rate})),
    products: seededProducts.map(([name,metal,weight,makingCharge,shape]) => ({
      id: uniq(), name, metal, category:'Industrial Dies', weight, makingCharge,
      fixedPrice: 0, shape, description: '', image: '', stock: null, quoteOnly: false
    })),
    customers: [], orders: [], dailyRateDate: iso(),
    deliveryRules: [[10,3],[25,5],[50,8],[100,12]]
  };
}

// Convert the originally supplied localStorage formats if the old apps were run
// previously on the SAME origin. No credentials are migrated into this client UI.
function fromOldStaff(old) {
  const d = defaults();
  d.shop = { ...d.shop, name:old.shop?.name || d.shop.name,
    address:old.shop?.addr || d.shop.address, phone:old.shop?.phone || '',
    gstin:old.shop?.gst || '', tax:+old.shop?.tax || 18,
    upi:old.pay?.upi || '', cod:old.pay?.cod !== false };
  if (Array.isArray(old.metals)) d.metals = old.metals.map(m=>({id:uniq(),name:String(m.n),rate:+m.rate || 0}));
  if (Array.isArray(old.dies)) d.products = old.dies.map(p=>({
    id:uniq(), name:String(p.n || 'Untitled'), metal:String(p.m || 'General'),
    category:'Industrial Dies', weight:+p.w || 0, makingCharge:+p.mk || 0,
    fixedPrice:+p.fx || 0, shape:p.d || 'round', description:p.desc || '',
    image:p.img || '', stock:p.st==='' || p.st===undefined?null:+p.st,
    quoteOnly:false
  }));
  d.customers = (old.cust||[]).map(c=>({id:uniq(),name:c.name||'',phone:c.phone||'',address:c.addr||''}));
  d.orders = (old.ord||[]).map(o=>({id:String(o.id),type:'order',createdAt:o.date || iso(),
    customer:{name:o.cn||'',phone:o.ph||'',address:''},
    items:[{productId:null,name:o.die||'Product',qty:+o.q||1,unitPrice:+o.rt||0,
      subtotal:+o.sub||0}], notes:o.note||'', subtotal:+o.sub||0,
    tax:Math.max(0,(+o.tot||0)-(+o.sub||0)),total:+o.tot||0,
    status:o.st||'Pending',deliveryDate:o.dl||'',rating:+o.rating||0,
    payment:{method:o.pm||'Manual',status:o.pay||'Unpaid',reference:o.ref||''}
  }));
  d.deliveryRules=Array.isArray(old.rules)?old.rules:d.deliveryRules;
  d.dailyRateDate=old.rd||iso();
  return d;
}
function fromOldCustomer(old) {
  const d=defaults();
  d.shop.address=old.addr||d.shop.address;d.shop.phone=old.ph||'';
  d.products=(old.dies||[]).map(p=>({id:String(p.id),name:p.name,metal:p.metal,
    category:'Industrial Dies',weight:0,makingCharge:0,fixedPrice:+p.price||0,
    shape:p.shape||'round',description:'',image:'',stock:null,quoteOnly:false}));
  d.customers=(old.custs||[]).map(c=>({id:uniq(),name:c.name,phone:c.phone,address:c.addr}));
  d.orders=(old.orders||[]).map(o=>{const p=old.dies?.find(x=>String(x.id)===String(o.die));return{
    id:String(o.id),type:'order',createdAt:o.date||iso(),
    customer:{name:o.cust||'',phone:d.customers.find(c=>c.name===o.cust)?.phone||'',address:''},
    items:[{productId:String(o.die),name:p?.name||'Die',qty:+o.qty||1,
      unitPrice:+p?.price||0,subtotal:+o.total||0}],notes:o.note||'',
    subtotal:+o.total||0,tax:0,total:+o.total||0,status:o.status||'Pending',
    deliveryDate:o.deliver||'',rating:+o.rating||0,
    payment:{method:'Manual',status:'Unpaid',reference:''}
  }});
  return d;
}
export function normalize(data) {
  if(data?.products && data?.shop) {
    const d=defaults();
    return {...d,...data,shop:{...d.shop,...data.shop}, metals:data.metals||d.metals,
      products:data.products||d.products,customers:data.customers||[],orders:data.orders||[],
      deliveryRules:data.deliveryRules||d.deliveryRules};
  }
  if(data?.dies && data?.shop) return fromOldStaff(data);
  if(data?.dies && data?.custs) return fromOldCustomer(data);
  throw new Error('Unknown data format. Import a valid AS Commerce, old staff, or old customer JSON export.');
}
function loadLocal() {
  try { const saved=localStorage.getItem(KEY); if(saved) return normalize(JSON.parse(saved)); } catch { /* use defaults */ }
  for (const [key,mapper] of [['asdn1',fromOldStaff],['asdm2',fromOldCustomer]]) {
    try { const old=localStorage.getItem(key); if(old) return mapper(JSON.parse(old)); } catch { /* ignore */ }
  }
  return defaults();
}
let snapshot=loadLocal();
// Persist the seeded catalog immediately so different tabs share stable IDs.
try {if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,JSON.stringify(snapshot));}catch{}
const listeners=new Set();
const emit=()=>listeners.forEach(fn=>fn());
let writes = Promise.resolve();
let pendingWrites = 0;
let generation = 0;
let refreshing;

function applySnapshot(next, broadcast = false) {
  if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); }
  catch (error) { console.warn('Commerce data cache could not be updated', error); }
  emit();
  if (broadcast) channel?.postMessage('refresh');
}
async function readRemote() {
  const response = await fetch(apiUrl('/api/state'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Loading data failed (${response.status})`);
  return response.json();
}
async function persist(next) {
  const response = await fetch(apiUrl('/api/state'), {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
  if (!response.ok) throw new Error(`Saving data failed (${response.status})`);
}
// Other browsers/devices do not receive localStorage or BroadcastChannel events.
// Poll the shared API, and discard reads overtaken by a local write.
export function refreshCommerceStore() {
  if (pendingWrites) return Promise.resolve();
  if (refreshing) return refreshing;
  const started = generation;
  refreshing = (async()=>{
    const remote = await readRemote();
    if (remote && !pendingWrites && started === generation) applySnapshot(normalize(remote));
  })().finally(()=>{ refreshing = undefined; });
  return refreshing;
}
const refreshInBackground = ()=>{ refreshCommerceStore().catch(error=>console.warn('Commerce refresh failed', error)); };
let channel;
try {
  channel = new BroadcastChannel('as-metal-commerce');
  channel.onmessage = e=>{ if (e.data === 'refresh') refreshInBackground(); };
} catch {/* not supported */}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e=>{ if (e.key === KEY) refreshInBackground(); });
  window.addEventListener('focus', refreshInBackground);
  window.addEventListener('online', refreshInBackground);
}
let refreshTimer;
function subscribe(listener) {
  listeners.add(listener);
  if (!refreshTimer) refreshTimer = setInterval(refreshInBackground, 3000);
  return ()=>{
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(refreshTimer); refreshTimer = undefined; }
  };
}
export function useCommerceStore() {return useSyncExternalStore(subscribe,()=>snapshot);}
export const commerceReady = (async()=>{
  const remote = await readRemote();
  if (remote) applySnapshot(normalize(remote));
  else await persist(snapshot);
})();
function queueWrite(createNext) {
  pendingWrites++;
  generation++;
  const save = writes.catch(()=>{}).then(async()=>{
    const next = await createNext();
    await persist(next);
    applySnapshot(next, true);
  }).finally(()=>{ pendingWrites--; });
  writes = save;
  save.catch(error=>{
    console.error('Could not save commerce data to MongoDB API', error);
    window.dispatchEvent(new CustomEvent('commerce-save-error', {detail:error}));
  });
  return save;
}
export function updateStore(editor) {
  return queueWrite(async()=>{
    // A staff tab may be older than the most recent customer order.
    const remote = await readRemote();
    const next = structuredClone(remote ? normalize(remote) : snapshot);
    editor(next);
    return next;
  });
}
export function replaceStore(data) {
  const next = normalize(data);
  return queueWrite(()=>next);
}
export function makeId(prefix='AS'){return `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random()*900+100)}`;}
export function productPrice(product,data) {
  if(+product.fixedPrice>0)return +product.fixedPrice;
  const rate=+(data.metals.find(m=>m.name===product.metal)?.rate || 0);
  return Math.max(0,Math.round(rate*(+product.weight||0)+(+product.makingCharge||0)));
}
export function deliveryDays(qty,data){
  const rules=[...(data.deliveryRules||[])].sort((a,b)=>a[0]-b[0]);
  return rules.find(([q])=>qty<=q)?.[1] || Math.max(14,rules.at(-1)?.[1]||14);
}
export function deliveryDate(qty,data){const date=new Date();date.setDate(date.getDate()+deliveryDays(qty,data));return date.toISOString().slice(0,10);}
