import React from 'react';
import { Box, Hexagon, CircleDot, Layers3, Wrench } from 'lucide-react';
import { toast } from 'react-toastify';

export const inr = n => `₹${Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2})}`;
export const day = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'Not set';
export const phoneNumber = p => {const n=String(p||'').replace(/\D/g,'');return n.length===10?'91'+n:n;};
export const whatsappUrl=(phone,text)=>`https://wa.me/${phoneNumber(phone)}?text=${encodeURIComponent(text)}`;
export const plural=(count,item)=>`${count} ${item}${count===1?'':'s'}`;
export function downloadJSON(object,file='as-commerce-data.json') {
  const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export function ProductArt({product,size=120}){
  if(product.image) return <img className="product-photo" src={product.image} alt={product.name} />;
  const shape=product.shape || 'round';
  const icon={round:<CircleDot size={size*.49} strokeWidth={1.2}/>,square:<Box size={size*.49} strokeWidth={1.2}/>,hex:<Hexagon size={size*.49} strokeWidth={1.2}/>,slot:<Layers3 size={size*.49} strokeWidth={1.2}/>,star:<Wrench size={size*.49} strokeWidth={1.2}/>}[shape];
  return <div className="product-art" aria-label={product.name}>{icon||<Box size={size*.49} strokeWidth={1.2}/>}<span>AS / PRECISION</span></div>;
}
const escapeHTML=(v='')=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function invoiceHTML(order,shop){
  const items=order.items.map(i=>`<tr><td>${escapeHTML(i.name)}</td><td>${escapeHTML(i.qty)}</td><td>${inr(i.unitPrice)}</td><td>${inr(i.subtotal)}</td></tr>`).join('');
  const delivery=order.deliveryCharge==null?'':`<br>Delivery: ${order.deliveryCharge>0?inr(order.deliveryCharge):order.deliveryChargePending?'To be confirmed':'Free'}${order.deliveryChargePending&&order.deliveryCharge>0?' (remaining charges to be confirmed)':''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHTML(order.id)}</title>
    <style>body{font:14px Arial,sans-serif;margin:40px;color:#172438}h1{letter-spacing:1px}h3{color:#284d77}.head{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #bd6b34;margin-bottom:22px}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{border-bottom:1px solid #ddd;text-align:left;padding:12px 6px}th{background:#f4f6fa}.total{text-align:right;font-size:18px;font-weight:bold}small{color:#687384}@media print{button{display:none}}</style></head><body>
    <div class="head"><div><h1>${escapeHTML(shop.name)}</h1><p>${escapeHTML(shop.address)}<br>${escapeHTML(shop.phone)}<br>${shop.gstin?'GSTIN: '+escapeHTML(shop.gstin):''}</p></div><h3>INVOICE</h3></div>
    <p><b>Invoice:</b> ${escapeHTML(order.id)}<br><b>Date:</b> ${day(order.createdAt)}<br><b>Customer:</b> ${escapeHTML(order.customer.name)}<br><b>Phone:</b> ${escapeHTML(order.customer.phone)}<br><b>Address:</b> ${escapeHTML(order.customer.address)}${order.customer.landmark?`<br><b>Landmark:</b> ${escapeHTML(order.customer.landmark)}`:''}<br><b>Expected delivery:</b> ${day(order.deliveryDate)}<br><b>Payment:</b> ${escapeHTML(order.payment?.status||'Unpaid')} — ${escapeHTML(order.payment?.method||'')}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table>
    <p class="total">Subtotal: ${inr(order.subtotal)}<br>${order.discount>0?'Discount: − '+inr(order.discount)+'<br>':''}GST: ${inr(order.tax)}${delivery}<br>${order.deliveryChargePending?'Total so far':'Total'}: ${inr(order.total)}</p>
    <p><small>${escapeHTML(order.notes||'')}</small></p><p>Thank you for your business.</p><button onclick="window.print()">Print / Save PDF</button></body></html>`;
}
export function downloadInvoice(order,shop) {
  if(order?.type!=='order') return;
  const url=URL.createObjectURL(new Blob([invoiceHTML(order,shop)],{type:'text/html;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='invoice-'+order.id+'.html';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export function printInvoice(order,shop){
  if(order?.type!=='order') return;
  const doc=invoiceHTML(order,shop);
  const w=window.open('','_blank');if(!w){toast.error('Allow popups for this site to print an invoice.');return;}
  w.document.open();w.document.write(doc);w.document.close();
  setTimeout(()=>{if(!w.closed)w.print();},300);
}

export function readAttachment(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read the attachment.'));
    reader.onload=()=>resolve({name:file.name,type:file.type,base64:reader.result.split(',')[1]});
    reader.readAsDataURL(file);
  });
}

