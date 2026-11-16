import React, { useState } from 'react';
import { day, inr, phoneNumber } from '../lib/utils.jsx';
import { updateStore } from '../lib/store.js';
import { Calendar, Clock, IndianRupee, Layers3, ShoppingBag, Wallet, AlertCircle } from 'lucide-react';

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

function getLocalDateStr(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

function isSameDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function BusinessReports({ data, onOpenOrder }) {
  const [period, setPeriod] = useState('this_month');
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr());
  const [rangeStart, setRangeStart] = useState(getLocalDateStr());
  const [rangeEnd, setRangeEnd] = useState(getLocalDateStr());

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const todayEnd = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999).getTime();

  let filterFn = () => true;
  let activePeriodLabel = 'All time';

  switch (period) {
    case 'today': {
      filterFn = (orderDate) => isSameDay(orderDate, now);
      activePeriodLabel = `Today · ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      break;
    }
    case 'weekly': {
      const s = new Date(currentYear, currentMonth, currentDate - 6, 0, 0, 0, 0);
      filterFn = (orderDate, orderTime) => orderTime >= s.getTime() && orderTime <= todayEnd;
      activePeriodLabel = `Weekly (Last 7 days) · ${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      break;
    }
    case 'this_month': {
      filterFn = (orderDate) => orderDate.getFullYear() === currentYear && orderDate.getMonth() === currentMonth;
      activePeriodLabel = `This month · ${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
      break;
    }
    case 'last_month': {
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevDate = new Date(prevYear, prevMonth, 1);
      filterFn = (orderDate) => orderDate.getFullYear() === prevYear && orderDate.getMonth() === prevMonth;
      activePeriodLabel = `Last month · ${prevDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
      break;
    }
    case 'last_3_months': {
      const s = new Date(currentYear, currentMonth - 3, currentDate, 0, 0, 0, 0);
      filterFn = (orderDate, orderTime) => orderTime >= s.getTime() && orderTime <= todayEnd;
      activePeriodLabel = `Last 3 months · ${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      break;
    }
    case 'last_6_months': {
      const s = new Date(currentYear, currentMonth - 6, currentDate, 0, 0, 0, 0);
      filterFn = (orderDate, orderTime) => orderTime >= s.getTime() && orderTime <= todayEnd;
      activePeriodLabel = `Last 6 months · ${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      break;
    }
    case 'this_year': {
      filterFn = (orderDate) => orderDate.getFullYear() === currentYear;
      activePeriodLabel = `This year · ${currentYear}`;
      break;
    }
    case 'last_year': {
      filterFn = (orderDate) => orderDate.getFullYear() === currentYear - 1;
      activePeriodLabel = `Last year · ${currentYear - 1}`;
      break;
    }
    case 'last_5_years': {
      const s = new Date(currentYear - 5, currentMonth, currentDate, 0, 0, 0, 0);
      filterFn = (orderDate, orderTime) => orderTime >= s.getTime() && orderTime <= todayEnd;
      activePeriodLabel = `Last 5 years · ${currentYear - 5} – ${currentYear}`;
      break;
    }
    case 'date': {
      if (selectedDate) {
        const [sy, sm, sd] = selectedDate.split('-').map(Number);
        const target = new Date(sy, sm - 1, sd);
        filterFn = (orderDate) => isSameDay(orderDate, target);
        activePeriodLabel = `Date: ${target.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}`;
      } else {
        filterFn = (orderDate) => isSameDay(orderDate, now);
        activePeriodLabel = `Date: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      }
      break;
    }
    case 'range': {
      const s = rangeStart ? new Date(rangeStart + 'T00:00:00').getTime() : 0;
      const e = rangeEnd ? new Date(rangeEnd + 'T23:59:59.999').getTime() : Infinity;
      const sLabel = rangeStart ? new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
      const eLabel = rangeEnd ? new Date(rangeEnd + 'T23:59:59.999').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';
      filterFn = (orderDate, orderTime) => orderTime >= s && orderTime <= e;
      activePeriodLabel = `Custom range · ${sLabel} – ${eLabel}`;
      break;
    }
    case '30': {
      const s = Date.now() - 30 * 86400000;
      filterFn = (orderDate, orderTime) => orderTime >= s;
      activePeriodLabel = 'Last 30 days';
      break;
    }
    case '90': {
      const s = Date.now() - 90 * 86400000;
      filterFn = (orderDate, orderTime) => orderTime >= s;
      activePeriodLabel = 'Last 90 days';
      break;
    }
    case 'all':
    default: {
      filterFn = () => true;
      activePeriodLabel = 'All time';
      break;
    }
  }

  const orders = data.orders.filter(o => o.type === 'order' && o.status !== 'Cancelled');
  const sales = orders.filter(o => {
    const d = new Date(o.createdAt);
    const t = d.getTime();
    if (isNaN(t)) return false;
    return filterFn(d, t);
  });

  const totalSalesAmount = sales.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paid = sales.filter(o => o.payment?.status === 'Paid');
  const paidAmount = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const unpaid = sales.filter(o => o.payment?.status !== 'Paid');
  const unpaidAmount = unpaid.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalUnits = sales.reduce(
    (sum, o) => sum + (o.items || []).reduce((isum, item) => isum + Number(item.qty || 0), 0),
    0
  );

  const popularity = new Map();
  for (const order of sales) {
    for (const item of (order.items || [])) {
      const key = item.productId || item.name;
      const previous = popularity.get(key);
      const qty = Number(item.qty || 0);
      const subtotal = Number(item.subtotal || (item.unitPrice ? item.unitPrice * qty : 0));
      popularity.set(key, {
        name: item.name,
        units: (previous?.units ?? 0) + qty,
        amount: (previous?.amount ?? 0) + subtotal,
      });
    }
  }
  const popular = [...popularity.values()].sort((a, b) => b.units - a.units).slice(0, 10);
  const lowStock = data.products.filter(p => p.stock != null && p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const openOrders = orders.filter(o => ['Pending', 'Processing', 'Shipped'].includes(o.status));

  return (
    <>
      {/* ROW 1: TWO CONTAINERS IN ONE ROW (Sales & Filters + Popular Products) */}
      <div className="reports-two-col">
        {/* Container 1: Sales Summary & Date Filters */}
        <section className="panel form" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <span className="eyebrow dark" style={{ margin: '0 0 4px' }}>BUSINESS METRICS</span>
              <h2 style={{ margin: 0, fontSize: 22 }}>Sales & Performance</h2>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0f4f9', padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#1a3353' }}>
              <Clock size={14} style={{ color: '#b9622d' }} />
              <span>{activePeriodLabel}</span>
            </div>
          </div>

          {/* Filter Controls Bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e5e9f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
              <label style={{ margin: 0, fontWeight: 700, fontSize: 12, color: '#334155' }}>
                Order Period
                <select 
                  value={period} 
                  onChange={e => setPeriod(e.target.value)}
                  style={{ width: '100%', marginTop: 5, padding: '9px 11px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
                >
                  <option value="today">Today</option>
                  <option value="weekly">Weekly (Last 7 days)</option>
                  <option value="this_month">This month</option>
                  <option value="last_month">Last month</option>
                  <option value="last_3_months">Last 3 months</option>
                  <option value="last_6_months">Last 6 months</option>
                  <option value="this_year">This year</option>
                  <option value="last_year">Last year</option>
                  <option value="last_5_years">Last 5 years</option>
                  <option value="all">All time</option>
                  <option value="date">📅 Specific Date (Date-wise filter)</option>
                  <option value="range">📆 Custom Date Range</option>
                </select>
              </label>

              {period === 'date' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#b9622d' }}>Choose Date:</span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={e => setSelectedDate(e.target.value)}
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #b9622d', background: '#fff', fontSize: 13, fontWeight: 700, color: '#10253e' }}
                    />
                    <button type="button" className="btn outline" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => setSelectedDate(getLocalDateStr())}>
                      Today
                    </button>
                    <button type="button" className="btn outline" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      setSelectedDate(getLocalDateStr(yest));
                    }}>
                      Yesterday
                    </button>
                  </div>
                </div>
              )}

              {period === 'range' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', gridColumn: 'span 2' }}>
                  <label style={{ flex: 1, minWidth: 120, margin: 0, fontWeight: 700, fontSize: 11, color: '#334155' }}>
                    From Date
                    <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={{ width: '100%', marginTop: 5, padding: '7px 9px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12 }} />
                  </label>
                  <label style={{ flex: 1, minWidth: 120, margin: 0, fontWeight: 700, fontSize: 11, color: '#334155' }}>
                    To Date
                    <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={{ width: '100%', marginTop: 5, padding: '7px 9px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12 }} />
                  </label>
                </div>
              )}

              {period !== 'date' && period !== 'range' && (
                <div>
                  <button type="button" className="btn outline" style={{ padding: '8px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, borderColor: '#cbd5e1' }} onClick={() => setPeriod('date')}>
                    <Calendar size={14} style={{ color: '#b9622d' }} />
                    Filter by Specific Date
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4 Summary Stat Cards in 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 'auto' }}>
            <div className="stat-card" style={{ margin: 0, padding: '16px' }}>
              <div className="stat-icon" style={{ background: '#eef4ff', color: '#2563eb', width: 36, height: 36 }}><ShoppingBag size={18}/></div>
              <span style={{ fontSize: 11, marginTop: 10 }}>Total Orders</span>
              <strong style={{ fontSize: 20, marginTop: 4 }}>{sales.length} <small style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>({totalUnits} units)</small></strong>
            </div>

            <div className="stat-card" style={{ margin: 0, padding: '16px' }}>
              <div className="stat-icon" style={{ background: '#fff2e8', color: '#b9622d', width: 36, height: 36 }}><IndianRupee size={18}/></div>
              <span style={{ fontSize: 11, marginTop: 10 }}>Total Sales</span>
              <strong style={{ fontSize: 20, marginTop: 4, color: '#172e46' }}>{inr(totalSalesAmount)}</strong>
            </div>

            <div className="stat-card" style={{ margin: 0, padding: '16px' }}>
              <div className="stat-icon" style={{ background: '#eaf7ee', color: '#18864b', width: 36, height: 36 }}><Wallet size={18}/></div>
              <span style={{ fontSize: 11, marginTop: 10 }}>Paid Revenue ({paid.length})</span>
              <strong style={{ fontSize: 20, marginTop: 4, color: '#18864b' }}>{inr(paidAmount)}</strong>
            </div>

            <div className="stat-card" style={{ margin: 0, padding: '16px' }}>
              <div className="stat-icon" style={{ background: '#fff7ed', color: '#d97706', width: 36, height: 36 }}><AlertCircle size={18}/></div>
              <span style={{ fontSize: 11, marginTop: 10 }}>Pending ({unpaid.length})</span>
              <strong style={{ fontSize: 20, marginTop: 4, color: unpaidAmount > 0 ? '#b45309' : '#64748b' }}>{inr(unpaidAmount)}</strong>
            </div>
          </div>
        </section>

        {/* Container 2: Popular Products by Units Ordered */}
        <section className="panel" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span className="eyebrow dark" style={{ margin: '0 0 4px' }}>TOP DEMAND</span>
              <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers3 size={20} style={{ color: '#b9622d' }} />
                Popular Products
              </h2>
            </div>
            <small style={{ color: '#64748b', fontWeight: 600 }}>By units ordered</small>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
            {popular.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {popular.map((item, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#f8fafc', border: '1px solid #e7ecf2', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: index === 0 ? '#b9622d' : index < 3 ? '#e2e8f0' : '#f1f5f9', color: index === 0 ? '#fff' : '#475569', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                        {index + 1}
                      </span>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{item.name}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', fontSize: 13, color: '#b9622d' }}>{item.units} units</strong>
                      {item.amount > 0 && <small style={{ color: '#64748b', fontSize: 11 }}>{inr(item.amount)}</small>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 16px', background: '#f8fafc', borderRadius: 8, color: '#64748b' }}>
                <p style={{ margin: 0, fontSize: 13 }}>No product sales recorded in this period.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ROW 2: TWO CONTAINERS IN ONE ROW (Low Stock + Open Orders) */}
      <div className="reports-two-col">
        {/* Container 3: Low stock */}
        <section className="panel" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} style={{ color: '#d97706' }} />
              Low Stock (5 units or fewer)
            </h2>
            <span className="count-pill" style={{ background: lowStock.length ? '#fef3c7' : '#e2e8f0', color: lowStock.length ? '#b45309' : '#64748b' }}>
              {lowStock.length} items
            </span>
          </div>

          <div style={{ flex: 1 }}>
            {lowStock.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lowStock.map(product => (
                  <li key={product.id} style={{ padding: '5px 0', fontSize: 13 }}>
                    <strong>{product.name}</strong> · <span style={{ color: '#c44a46', fontWeight: 700 }}>{product.stock} units left</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', fontSize: 13, margin: '10px 0 0' }}>No low-stock products. All inventory levels healthy.</p>
            )}
          </div>
        </section>

        {/* Container 4: Open orders */}
        <section className="panel" style={{ padding: '24px', margin: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: '#b9622d' }} />
              Open Orders ({openOrders.length})
            </h2>
            <span className="count-pill" style={{ background: openOrders.length ? '#e0f2fe' : '#e2e8f0', color: openOrders.length ? '#0369a1' : '#64748b' }}>
              {openOrders.length} pending
            </span>
          </div>

          <div style={{ flex: 1 }}>
            {openOrders.length ? (
              <ul className="staff-order-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {openOrders.map(order => (
                  <li key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" className="btn outline" style={{ padding: '3px 8px', fontSize: 11, fontWeight: 700 }} onClick={() => onOpenOrder && onOpenOrder(order.id)}>
                        #{order.id}
                      </button>
                      <span className={`tag ${order.status === 'Delivered' ? 'good' : ''}`} style={{ fontSize: 11 }}>
                        {order.status}
                      </span>
                    </div>
                    <small style={{ color: '#64748b', fontSize: 12 }}>Expected {day(order.deliveryDate)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', fontSize: 13, margin: '10px 0 0' }}>No open orders.</p>
            )}
          </div>
        </section>
      </div>

      {/* ROW 3: Orders in this Period Breakdown (Full width data table) */}
      <section className="panel" style={{ padding: '24px', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 3px', fontSize: 17 }}>Orders in this Period ({sales.length})</h3>
            <small style={{ color: '#64748b', fontWeight: 600 }}>{activePeriodLabel}</small>
          </div>
          <span className="count-pill">{sales.length} orders</span>
        </div>

        {sales.length ? (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(order => (
                  <tr key={order.id}>
                    <td>
                      <button 
                        type="button" 
                        className="btn outline" 
                        style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
                        onClick={() => onOpenOrder && onOpenOrder(order.id)}
                      >
                        #{order.id}
                      </button>
                    </td>
                    <td>
                      <strong>{order.customer?.name || 'Walk-in Customer'}</strong>
                      {order.customer?.phone && <small style={{ color: '#7a8594' }}>{order.customer.phone}</small>}
                    </td>
                    <td>
                      <small style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(order.items || []).map(i => `${i.name} × ${i.qty}`).join(', ')}
                      </small>
                    </td>
                    <td><strong>{inr(order.total)}</strong></td>
                    <td>
                      <span className={`tag ${order.payment?.status === 'Paid' ? 'good' : ''}`}>
                        {order.payment?.status || 'Unpaid'}
                      </span>
                    </td>
                    <td>
                      <small>{day(order.createdAt)} {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="btn outline" 
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => onOpenOrder && onOpenOrder(order.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px', background: '#f8fafc', borderRadius: 9, color: '#64748b' }}>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>No orders found for this selected period / date.</p>
            <small>Try selecting a different date or choose "All time" to view past orders.</small>
          </div>
        )}
      </section>
    </>
  );
}
