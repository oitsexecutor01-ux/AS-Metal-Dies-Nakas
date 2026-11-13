import React, { useState } from 'react';
import { day, inr, phoneNumber } from '../lib/utils.jsx';
import { updateStore } from '../lib/store.js';

export function PromotionSettings({ promotions, notify }) {
  const [code,setCode]=useState(promotions?.coupon?.code ?? '');
  const [couponPercent,setCouponPercent]=useState(promotions?.coupon?.percent ?? '');
  const [bulkMin,setBulkMin]=useState(promotions?.bulk?.minUnits ?? '');
  const [bulkPercent,setBulkPercent]=useState(promotions?.bulk?.percent ?? '');
  const [saving,setSaving]=useState(false);

  async function save(event) {
    event.preventDefault();
    const normalizedCode=code.trim().toUpperCase();
    if(normalizedCode && (!/^[A-Z0-9_-]{2,24}$/.test(normalizedCode) || !(+couponPercent>0 && +couponPercent<=100))) {
      return notify('Enter a coupon code of 2–24 letters, numbers, hyphens or underscores, and a discount above 0%.');
    }
    if((bulkMin || bulkPercent) && (!Number.isSafeInteger(+bulkMin) || +bulkMin<2 || !(+bulkPercent>0 && +bulkPercent<=100))) {
      return notify('Enter a bulk minimum of at least 2 units and a discount above 0%.');
    }
    setSaving(true);
    try {
      await updateStore(data=>{
        data.shop.promotions={
          coupon:normalizedCode ? {code:normalizedCode,percent:+couponPercent} : null,
          bulk:bulkMin ? {minUnits:+bulkMin,percent:+bulkPercent} : null,
        };
      });
      setCode(normalizedCode);
      notify('Promotions saved.');
    } catch {
      notify('Could not save promotions. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <form className="panel form" onSubmit={save}>
    <h2>Checkout promotions</h2>
    <fieldset className="checkout-fields" disabled={saving}>
      <div className="form-grid">
        <label>Coupon code<input value={code} onChange={e=>setCode(e.target.value)} maxLength={24} placeholder="Leave blank to disable"/></label>
        <label>Coupon discount (%)<input type="number" min="0" max="100" step=".01" value={couponPercent} onChange={e=>setCouponPercent(e.target.value)}/></label>
        <label>Bulk minimum units<input type="number" min="2" step="1" value={bulkMin} onChange={e=>setBulkMin(e.target.value)}/></label>
        <label>Bulk discount (%)<input type="number" min="0" max="100" step=".01" value={bulkPercent} onChange={e=>setBulkPercent(e.target.value)}/></label>
      </div>
      <p className="muted">Bulk pricing applies to the total cart quantity. Checkout applies the higher eligible discount before GST. Clear both bulk fields to disable the bulk discount.</p>
      <button className="btn primary" type="submit">{saving?'Saving…':'Save promotions'}</button>
    </fieldset>
  </form>;
}

export function CustomerHistory({ data, onOpenOrder }) {
  const [search,setSearch]=useState('');
  const records=new Map(data.customers.map(customer=>[phoneNumber(customer.phone) || customer.id,{...customer,history:[]}]));
  for(const order of data.orders) {
    const phone=phoneNumber(order.customer?.phone);
    if(!phone) continue;
    if(!records.has(phone)) records.set(phone,{...order.customer,history:[]});
    records.get(phone).history.push(order);
  }
  const matches=[...records].filter(([,customer])=>
    [customer.name,customer.phone,customer.address,customer.landmark].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="panel form">
    <h2>Customer history</h2>
    <label>Search contacts<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone or address"/></label>
    {matches.map(([key,customer])=><details key={key} className="staff-history">
      <summary><strong>{customer.name}</strong> · {customer.phone||'No phone'} · {customer.history.length} records</summary>
      {customer.address&&<p>{customer.address}</p>}
      {customer.landmark&&<p><strong>Landmark:</strong> {customer.landmark}</p>}
      {customer.history.length ? <ul>{customer.history.map(order=><li key={order.id}>
        <button type="button" className="btn outline" onClick={()=>onOpenOrder(order.id)}>{order.id}</button>
        {' '}{order.type==='quote'?'Quote':'Order'} · {day(order.createdAt)} · {order.status}
      </li>)}</ul> : <p>No orders or quotes yet.</p>}
    </details>)}
    {!matches.length&&<p>No matching contacts.</p>}
  </section>;
}

export function BusinessReports({ data, onOpenOrder }) {
  const [period,setPeriod]=useState('30');
  const cutoff=period==='all'?0:Date.now()-Number(period)*86400000;
  const orders=data.orders.filter(o=>o.type==='order' && o.status!=='Cancelled');
  const sales=orders.filter(o=>new Date(o.createdAt).getTime()>=cutoff);
  const paid=sales.filter(o=>o.payment?.status==='Paid');
  const popularity=new Map();
  for(const order of sales) for(const item of order.items) {
    const key=item.productId || item.name;
    const previous=popularity.get(key);
    popularity.set(key,{name:item.name,units:(previous?.units??0)+Number(item.qty||0)});
  }
  const popular=[...popularity.values()].sort((a,b)=>b.units-a.units).slice(0,10);
  const lowStock=data.products.filter(p=>p.stock!=null && p.stock<=5).sort((a,b)=>a.stock-b.stock);
  const openOrders=orders.filter(o=>['Pending','Processing','Shipped'].includes(o.status));
  return <>
    <section className="panel form">
      <h2>Sales</h2>
      <label>Order period<select value={period} onChange={e=>setPeriod(e.target.value)}>
        <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option>
      </select></label>
      <p>{sales.length} orders · <strong>{inr(sales.reduce((sum,o)=>sum+Number(o.total||0),0))}</strong> in order value</p>
      <p>{paid.length} paid orders · <strong>{inr(paid.reduce((sum,o)=>sum+Number(o.total||0),0))}</strong> marked paid</p>
      <h2>Popular products by units ordered</h2>
      {popular.length?<ol>{popular.map((item,index)=><li key={index}>{item.name} · {item.units} units</li>)}</ol>:<p>No sales in this period.</p>}
    </section>
    <section className="panel"><h2>Low stock (5 units or fewer)</h2>
      {lowStock.length?<ul>{lowStock.map(product=><li key={product.id}>{product.name} · {product.stock} units</li>)}</ul>:<p>No low-stock products.</p>}
    </section>
    <section className="panel"><h2>Open orders ({openOrders.length})</h2>
      {openOrders.length?<ul className="staff-order-list">{openOrders.map(order=><li key={order.id}>
        <button type="button" className="btn outline" onClick={()=>onOpenOrder(order.id)}>{order.id}</button>
        {' '}{order.status} · Expected {day(order.deliveryDate)}
      </li>)}</ul>:<p>No open orders.</p>}
    </section>
  </>;
}
