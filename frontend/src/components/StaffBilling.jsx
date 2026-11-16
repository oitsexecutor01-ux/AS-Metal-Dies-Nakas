import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Receipt, Plus, Minus, Trash2, Printer, Download, MessageCircle, 
  Search, Eye, CheckCircle2, AlertCircle, RefreshCw, X, FileText, ArrowRight,
  Layers3, Tag
} from 'lucide-react';
import { updateStore, productPrice, makeId } from '../lib/store.js';
import { inr, day, phoneNumber, printInvoice } from '../lib/utils.jsx';
import { downloadInvoicePDF, shareInvoiceWhatsApp } from '../lib/invoicePdf.js';
import { toast } from 'react-toastify';

const blankCustomer = { name: '', phone: '', address: '', landmark: '', gstin: '' };

/**
 * Modern Interactive Product Search Box with live dropdown & quick chips
 */
function ProductSearchBox({ products = [], data, onSelectProduct }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products based on search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 10); // Show top 10 products when input is blank
    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const metal = (p.metal || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || metal.includes(q) || desc.includes(q);
    });
  }, [products, query]);

  function handleAdd(prod) {
    onSelectProduct(prod);
    setQuery('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        handleAdd(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  // First 5 products as quick-click shortcut chips
  const quickPicks = useMemo(() => products.slice(0, 6), [products]);

  return (
    <div className="product-search-wrapper" ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 18 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#172e46' }}>
        Search Catalog Products (Live Search):
      </label>

      {/* Main Search Input Bar */}
      <div 
        className="product-search-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: isOpen ? '2px solid #b9622d' : '1px solid #cbd5e1',
          boxShadow: isOpen ? '0 0 0 3px rgba(185, 98, 45, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
          borderRadius: 9,
          padding: '0 14px',
          height: 48,
          transition: 'border-color .15s, box-shadow .15s'
        }}
      >
        <Search size={19} color={isOpen ? '#b9622d' : '#64748b'} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search products (e.g. Hex, Round, D2)..."
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: '#172e46',
            background: 'transparent',
            height: '100%',
            padding: 0
          }}
        />

        {query && (
          <button
            type="button"
            className="unstyled"
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            style={{ color: '#8895a5', padding: 4, display: 'grid', placeItems: 'center', flexShrink: 0 }}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #e2e8f0', paddingLeft: 10, flexShrink: 0 }}>
          <span className="product-search-count" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {filtered.length} found
          </span>
          <button
            type="button"
            className="unstyled"
            onClick={() => setIsOpen(open => !open)}
            style={{ fontSize: 11, color: '#b9622d', fontWeight: 700, padding: '2px 4px' }}
          >
            {isOpen ? 'Close' : 'Browse'}
          </button>
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div
          className="product-search-dropdown"
          style={{
            position: 'absolute',
            zIndex: 70,
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #dce2e8',
            borderRadius: 10,
            boxShadow: '0 14px 35px rgba(15, 30, 50, 0.16)',
            maxHeight: 320,
            overflowY: 'auto'
          }}
        >
          {filtered.length > 0 ? (
            <div style={{ padding: '6px 0' }}>
              <div style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #f1f4f8', display: 'flex', justifyContent: 'space-between' }}>
                <span>{query.trim() ? `Matching Results for "${query}"` : 'Catalog Products (Click to Add)'}</span>
                <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 500 }}>Press Enter to add first</span>
              </div>
              {filtered.map((prod, index) => {
                const pr = productPrice(prod, data);
                return (
                  <div
                    key={prod.id}
                    onClick={() => handleAdd(prod)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: index < filtered.length - 1 ? '1px solid #f3f5f8' : 'none',
                      transition: 'background .12s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff8f3'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 7, background: '#f4f6fa', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {prod.image ? (
                          <img src={prod.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Layers3 size={18} color="#b9622d" />
                        )}
                      </div>
                      <div>
                        <strong style={{ fontSize: 13, color: '#172e46', display: 'block' }}>{prod.name}</strong>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{prod.metal || 'General Metal'}</span>
                          {prod.category && (
                            <span style={{ fontSize: 10, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                              {prod.category}
                            </span>
                          )}
                          {prod.stock !== null && (
                            <span style={{ fontSize: 10, color: prod.stock > 0 ? '#16a34a' : '#dc2626' }}>
                              {prod.stock > 0 ? `(${prod.stock} in stock)` : '(Out of stock)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#b9622d' }}>
                        {inr(pr)}
                      </span>
                      <button
                        type="button"
                        className="btn primary"
                        style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6 }}
                        onClick={e => { e.stopPropagation(); handleAdd(prod); }}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: 13 }}>No products match "<b>{query}</b>"</p>
              <small style={{ display: 'block', marginTop: 4, color: '#94a3b8' }}>
                You can add it as a custom line item below
              </small>
            </div>
          )}
        </div>
      )}

      {/* Quick-Pick Shortcut Chips */}
      {quickPicks.length > 0 && (
        <div className="billing-quick-picks">
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>Quick Add:</span>
          {quickPicks.map(p => {
            const pr = productPrice(p, data);
            return (
              <button
                key={p.id}
                type="button"
                className="unstyled billing-chip"
                onClick={() => handleAdd(p)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#f8fafc',
                  border: '1px solid #dce2e8',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 11,
                  color: '#334155',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'background .15s, border-color .15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fff8f3'; e.currentTarget.style.borderColor = '#b9622d'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#dce2e8'; }}
              >
                <Plus size={11} color="#b9622d" />
                <span>{p.name}</span>
                <b style={{ color: '#b9622d', fontWeight: 800 }}>({inr(pr)})</b>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StaffBilling({ data, onOpenOrder }) {
  const [viewMode, setViewMode] = useState('new'); // 'new' | 'history'
  const [customer, setCustomer] = useState(blankCustomer);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState([]);
  const [customItem, setCustomItem] = useState({ name: '', qty: 1, unitPrice: '' });
  
  // Pricing adjustments
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(data.shop.tax ?? 18);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [notes, setNotes] = useState('Counter Sale');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));

  // History search & modal
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('All');
  const [previewOrder, setPreviewOrder] = useState(null);

  // Combined customers list for autocomplete/selection
  const customerOptions = useMemo(() => {
    return [...(data.customers || [])];
  }, [data.customers]);

  // Handle selecting an existing customer
  function handleSelectCustomer(e) {
    const id = e.target.value;
    setSelectedCustomerId(id);
    if (!id) return;
    const c = customerOptions.find(item => item.id === id);
    if (c) {
      setCustomer({
        name: c.name || '',
        phone: c.phone || '',
        address: c.address || '',
        landmark: c.landmark || '',
        gstin: c.gstin || ''
      });
    }
  }

  // Add item from catalog
  function addProductDirectly(prod) {
    if (!prod) return;
    const price = productPrice(prod, data);
    setItems(curr => [
      ...curr,
      {
        id: makeId('ITM'),
        productId: prod.id,
        name: prod.name,
        qty: 1,
        unitPrice: price,
        subtotal: price,
        category: prod.category || '',
        metal: prod.metal || ''
      }
    ]);
    toast.success(`Added ${prod.name} (${inr(price)})`);
  }

  // Add custom manual item
  function addCustomLineItem(e) {
    e.preventDefault();
    if (!customItem.name.trim()) return toast.warn('Enter item name.');
    const price = Number(customItem.unitPrice);
    if (!Number.isFinite(price) || price < 0) return toast.warn('Enter a valid unit price.');
    const qty = Math.max(1, Number(customItem.qty) || 1);

    setItems(curr => [
      ...curr,
      {
        id: makeId('ITM'),
        productId: null,
        name: customItem.name.trim(),
        qty,
        unitPrice: price,
        subtotal: Math.round(qty * price * 100) / 100,
        category: 'Custom Work',
        metal: 'General'
      }
    ]);
    setCustomItem({ name: '', qty: 1, unitPrice: '' });
  }

  // Update item quantity or rate
  function updateItem(index, field, value) {
    setItems(curr => {
      const next = [...curr];
      const it = { ...next[index] };
      if (field === 'qty') {
        it.qty = Math.max(1, Number(value) || 1);
      } else if (field === 'unitPrice') {
        it.unitPrice = Math.max(0, Number(value) || 0);
      } else if (field === 'name') {
        it.name = value;
      }
      it.subtotal = Math.round(it.qty * it.unitPrice * 100) / 100;
      next[index] = it;
      return next;
    });
  }

  function removeItem(index) {
    setItems(curr => curr.filter((_, i) => i !== index));
  }

  // Live calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const d = Number(discount) || 0;
    return Math.min(subtotal, Math.max(0, d));
  }, [subtotal, discount]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  const taxAmount = useMemo(() => {
    const rate = Number(taxPercent) || 0;
    return Math.round(taxableAmount * (rate / 100) * 100) / 100;
  }, [taxableAmount, taxPercent]);

  const totalAmount = useMemo(() => {
    const delivery = Number(deliveryCharge) || 0;
    return Math.round((taxableAmount + taxAmount + delivery) * 100) / 100;
  }, [taxableAmount, taxAmount, deliveryCharge]);

  // Construct temporary order object for preview or actions
  function buildOrderObject(tempId) {
    return {
      id: tempId || makeId('INV'),
      type: 'order',
      createdAt: new Date().toISOString(),
      customer: {
        name: customer.name.trim() || 'Walk-in Customer',
        phone: phoneNumber(customer.phone) || customer.phone.trim(),
        address: customer.address.trim(),
        landmark: customer.landmark.trim(),
        gstin: customer.gstin.trim()
      },
      items: items.map(it => ({
        productId: it.productId || null,
        name: it.name,
        qty: Number(it.qty) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        subtotal: Number(it.subtotal) || 0
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      taxRate: Number(taxPercent) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      total: totalAmount,
      status: paymentStatus === 'Paid' ? 'Delivered' : 'Pending',
      deliveryDate: deliveryDate || new Date().toISOString(),
      notes: notes.trim() || 'Counter Sale',
      payment: {
        method: paymentMethod,
        status: paymentStatus
      }
    };
  }

  // Save the bill into store and optionally perform action
  async function handleSaveBill(action = 'none') {
    if (!items.length) {
      return toast.warn('Please add at least one line item to generate a bill.');
    }
    const invalidItem = items.find(it => !it.name.trim() || it.unitPrice <= 0);
    if (invalidItem) {
      return toast.warn(`Please enter a valid name and price for item "${invalidItem.name || 'Untitled'}"`);
    }

    const order = buildOrderObject();

    try {
      await updateStore(d => {
        // Add to orders list at front
        d.orders.unshift(order);

        // If customer has phone and name, save contact if not exists
        if (order.customer.phone && order.customer.name && order.customer.name !== 'Walk-in Customer') {
          const cleanPh = phoneNumber(order.customer.phone);
          const exists = d.customers.some(c => phoneNumber(c.phone) === cleanPh);
          if (!exists) {
            d.customers.push({
              id: makeId('CUS'),
              name: order.customer.name,
              phone: order.customer.phone,
              address: order.customer.address,
              landmark: order.customer.landmark,
              gstin: order.customer.gstin
            });
          }
        }
      });

      toast.success(`Bill #${order.id} generated and saved!`);

      // Trigger requested action
      if (action === 'print') {
        printInvoice(order, data.shop);
      } else if (action === 'pdf') {
        downloadInvoicePDF(order, data.shop);
      } else if (action === 'whatsapp') {
        await shareInvoiceWhatsApp(order, data.shop);
      }

      // Open preview modal
      setPreviewOrder(order);

      // Reset form
      handleResetForm();
    } catch (err) {
      toast.error('Could not save bill: ' + err.message);
    }
  }

  function handleResetForm() {
    setCustomer(blankCustomer);
    setSelectedCustomerId('');
    setItems([]);
    setCustomItem({ name: '', qty: 1, unitPrice: '' });
    setDiscount(0);
    setDeliveryCharge(0);
    setNotes('Counter Sale');
    setPaymentStatus('Paid');
    setPaymentMethod('Cash');
  }

  // Filtered orders for History view (orders of type 'order')
  const historyOrders = useMemo(() => {
    return (data.orders || [])
      .filter(o => o.type === 'order')
      .filter(o => {
        if (historyFilter === 'Paid') return o.payment?.status === 'Paid';
        if (historyFilter === 'Unpaid') return o.payment?.status !== 'Paid';
        return true;
      })
      .filter(o => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase();
        const cName = o.customer?.name?.toLowerCase() || '';
        const cPhone = o.customer?.phone?.toLowerCase() || '';
        const oId = o.id?.toLowerCase() || '';
        const itemNames = (o.items || []).map(i => i.name.toLowerCase()).join(' ');
        return oId.includes(q) || cName.includes(q) || cPhone.includes(q) || itemNames.includes(q);
      });
  }, [data.orders, historySearch, historyFilter]);

  // Quick stats
  const billingStats = useMemo(() => {
    const list = (data.orders || []).filter(o => o.type === 'order');
    const totalInvoiced = list.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalPaid = list.filter(o => o.payment?.status === 'Paid').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalUnpaid = list.filter(o => o.payment?.status !== 'Paid').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return { count: list.length, totalInvoiced, totalPaid, totalUnpaid };
  }, [data.orders]);

  return (
    <div className="billing-module">
      {/* Top Section */}
      <div className="page-title compact">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Billing & Invoicing (POS)</h1>
            <p>Generate customer bills, download official PDF invoices, print receipts and send directly to WhatsApp.</p>
          </div>
          <div className="billing-mode-tabs">
            <button 
              type="button" 
              className={`btn ${viewMode === 'new' ? 'primary' : 'outline'}`} 
              onClick={() => setViewMode('new')}
            >
              <Plus size={16}/> New Bill / POS
            </button>
            <button 
              type="button" 
              className={`btn ${viewMode === 'history' ? 'primary' : 'outline'}`} 
              onClick={() => setViewMode('history')}
            >
              <Receipt size={16}/> Invoices History ({billingStats.count})
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon"><Receipt size={20}/></div>
          <span>Total Invoices</span>
          <strong>{billingStats.count}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 size={20} color="#21834f"/></div>
          <span>Total Invoiced</span>
          <strong>{inr(billingStats.totalInvoiced)}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 size={20} color="#18864b"/></div>
          <span>Payments Collected</span>
          <strong>{inr(billingStats.totalPaid)}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AlertCircle size={20} color="#c44a46"/></div>
          <span>Outstanding / Unpaid</span>
          <strong>{inr(billingStats.totalUnpaid)}</strong>
        </div>
      </div>

      {/* View: NEW BILL */}
      {viewMode === 'new' && (
        <div className="billing-layout">
          {/* Customer & Details Panel */}
          <div className="panel form" style={{ marginBottom: 18 }}>
            <div className="panel-head billing-customer-head">
              <h2>Customer Information</h2>
              {customerOptions.length > 0 && (
                <div className="billing-customer-picker" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#687787', whiteSpace: 'nowrap' }}>Select saved:</span>
                  <select 
                    value={selectedCustomerId} 
                    onChange={handleSelectCustomer}
                    style={{ fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #dbe1e8', maxWidth: '100%' }}
                  >
                    <option value="">-- Choose saved customer --</option>
                    {customerOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-grid three">
              <label>Customer Name *
                <input 
                  required 
                  value={customer.name} 
                  onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} 
                  placeholder="e.g. Ramesh or Walk-in Customer"
                />
              </label>
              <label>Mobile Number (for WhatsApp) *
                <input 
                  type="tel" 
                  value={customer.phone} 
                  onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} 
                  placeholder="10-digit mobile number"
                />
              </label>
              <label>Customer GSTIN (optional)
                <input 
                  value={customer.gstin} 
                  onChange={e => setCustomer(c => ({ ...c, gstin: e.target.value }))} 
                  placeholder="e.g. 33AAAAA0000A1Z5"
                />
              </label>
            </div>
            <div className="form-grid">
              <label>Delivery Address
                <input 
                  value={customer.address} 
                  onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))} 
                  placeholder="Customer address or Counter pickup"
                />
              </label>
              <label>Landmark / Town
                <input 
                  value={customer.landmark} 
                  onChange={e => setCustomer(c => ({ ...c, landmark: e.target.value }))} 
                  placeholder="e.g. Near Bus Stand, Gandhipuram"
                />
              </label>
            </div>
          </div>

          {/* Add Line Items Panel */}
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <h2>Bill Line Items</h2>
              <span className="muted">{items.length} item{items.length === 1 ? '' : 's'} added</span>
            </div>

            {/* Interactive Product Search Box */}
            <ProductSearchBox 
              products={data.products} 
              data={data} 
              onSelectProduct={addProductDirectly} 
            />

            {/* Custom Item Form */}
            <form onSubmit={addCustomLineItem} className="billing-custom-item-form">
              <label style={{ margin: 0, fontSize: 12 }}>Custom item / job description:
                <input 
                  value={customItem.name} 
                  onChange={e => setCustomItem(x => ({ ...x, name: e.target.value }))}
                  placeholder="e.g. Custom Punch Die / Regrinding work"
                  style={{ marginTop: 4, padding: 8, fontSize: 13 }}
                />
              </label>
              <label style={{ margin: 0, fontSize: 12 }}>Quantity:
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, border: '1px solid #cbd5e1', borderRadius: 7, overflow: 'hidden', background: '#fff', height: 41 }}>
                  <button
                    type="button"
                    className="unstyled"
                    onClick={() => setCustomItem(x => ({ ...x, qty: Math.max(1, (Number(x.qty) || 1) - 1) }))}
                    disabled={Number(customItem.qty) <= 1}
                    style={{
                      width: 32,
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      background: Number(customItem.qty) <= 1 ? '#f8fafc' : '#f1f5f9',
                      color: Number(customItem.qty) <= 1 ? '#cbd5e1' : '#1e293b',
                      cursor: Number(customItem.qty) <= 1 ? 'not-allowed' : 'pointer',
                      borderRight: '1px solid #cbd5e1'
                    }}
                    title="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <input 
                    type="number" 
                    min="1" 
                    value={customItem.qty} 
                    onChange={e => setCustomItem(x => ({ ...x, qty: e.target.value }))}
                    style={{
                      flex: 1,
                      width: '100%',
                      minWidth: 36,
                      height: '100%',
                      textAlign: 'center',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1e293b',
                      background: '#fff'
                    }}
                  />
                  <button
                    type="button"
                    className="unstyled"
                    onClick={() => setCustomItem(x => ({ ...x, qty: (Number(x.qty) || 0) + 1 }))}
                    style={{
                      width: 32,
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      background: '#f1f5f9',
                      color: '#1e293b',
                      cursor: 'pointer',
                      borderLeft: '1px solid #cbd5e1'
                    }}
                    title="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </label>
              <label style={{ margin: 0, fontSize: 12 }}>Unit Rate (₹):
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={customItem.unitPrice} 
                  onChange={e => setCustomItem(x => ({ ...x, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  style={{ marginTop: 4, padding: 8, fontSize: 13 }}
                />
              </label>
              <button type="submit" className="btn outline" style={{ padding: '9px 14px', height: 41, fontSize: 12 }}>
                <Plus size={15}/> Add Custom Item
              </button>
            </form>

            {/* Items Table */}
            {items.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Item Description</th>
                      <th style={{ width: 140, textAlign: 'center' }}>Qty</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ width: 150, textAlign: 'right' }}>Subtotal (₹)</th>
                      <th style={{ width: 60, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <input 
                            value={item.name} 
                            onChange={e => updateItem(idx, 'name', e.target.value)}
                            style={{ border: '1px solid #dbe2e9', borderRadius: 6, padding: '5px 8px', width: '100%', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 7, overflow: 'hidden', background: '#fff', height: 32 }}>
                            <button
                              type="button"
                              className="unstyled"
                              onClick={() => updateItem(idx, 'qty', Math.max(1, (Number(item.qty) || 1) - 1))}
                              disabled={Number(item.qty) <= 1}
                              style={{
                                width: 28,
                                height: '100%',
                                display: 'grid',
                                placeItems: 'center',
                                background: Number(item.qty) <= 1 ? '#f8fafc' : '#f1f5f9',
                                color: Number(item.qty) <= 1 ? '#cbd5e1' : '#1e293b',
                                cursor: Number(item.qty) <= 1 ? 'not-allowed' : 'pointer',
                                borderRight: '1px solid #cbd5e1'
                              }}
                              title="Decrease quantity"
                            >
                              <Minus size={13} />
                            </button>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.qty} 
                              onChange={e => updateItem(idx, 'qty', e.target.value)}
                              style={{ border: 'none', outline: 'none', padding: 0, width: 44, height: '100%', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#fff' }}
                            />
                            <button
                              type="button"
                              className="unstyled"
                              onClick={() => updateItem(idx, 'qty', (Number(item.qty) || 0) + 1)}
                              style={{
                                width: 28,
                                height: '100%',
                                display: 'grid',
                                placeItems: 'center',
                                background: '#f1f5f9',
                                color: '#1e293b',
                                cursor: 'pointer',
                                borderLeft: '1px solid #cbd5e1'
                              }}
                              title="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={item.unitPrice} 
                            onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                            style={{ border: '1px solid #dbe2e9', borderRadius: 6, padding: '5px 8px', width: 100, textAlign: 'right', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#172e46' }}>
                          {inr(item.subtotal)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button" 
                            className="unstyled danger" 
                            onClick={() => removeItem(idx)}
                            title="Remove line item"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-minor" style={{ border: '1px dashed #dbe1e8', borderRadius: 8, padding: '30px 20px' }}>
                <p style={{ margin: 0, color: '#7a8795' }}>No items added yet. Use the product search box above or enter a custom item.</p>
              </div>
            )}
          </div>

          {/* Pricing, Payment & Actions Row */}
          <div className="billing-bottom-grid">
            {/* Payment & Terms Panel */}
            <div className="panel form" style={{ margin: 0 }}>
              <h2>Payment & Dispatch Details</h2>
              <div className="form-grid">
                <label>Payment Method
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </label>
                <label>Payment Status
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                    <option value="Paid">Paid (Confirmed)</option>
                    <option value="Unpaid">Unpaid / Credit</option>
                  </select>
                </label>
              </div>

              <div className="form-grid">
                <label>Invoice Date
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}/>
                </label>
                <label>Notes / Terms on Bill
                  <input 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="e.g. Counter sale, materials checked"
                  />
                </label>
              </div>

              {data.shop.upi && (
                <p className="inline-note" style={{ margin: '10px 0 0' }}>
                  <b>Store UPI ID:</b> {data.shop.upi} (will be printed on the invoice for customer reference)
                </p>
              )}
            </div>

            {/* Bill Summary Panel */}
            <div className="panel" style={{ margin: 0, background: '#fbfcfd', border: '1px solid #dbe2e9' }}>
              <div className="panel-head" style={{ borderBottom: '1px solid #e7ecf2', paddingBottom: 10, marginBottom: 14 }}>
                <h2>Bill Summary</h2>
                <span className="count-pill">{items.length} items</span>
              </div>

              <div style={{ display: 'grid', gap: 11, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5e6d7d' }}>
                  <span>Items Subtotal:</span>
                  <strong style={{ color: '#172e46' }}>{inr(subtotal)}</strong>
                </div>

                {/* Discount input */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5e6d7d' }}>Discount (₹):</span>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={discount} 
                    onChange={e => setDiscount(e.target.value)}
                    style={{ width: 110, padding: '5px 8px', borderRadius: 6, border: '1px solid #dce2e8', textAlign: 'right', fontSize: 13 }}
                  />
                </div>

                {/* GST Rate input */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5e6d7d' }}>GST Rate (%):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select 
                      value={taxPercent} 
                      onChange={e => setTaxPercent(e.target.value)}
                      style={{ width: 110, padding: '5px 8px', borderRadius: 6, border: '1px solid #dce2e8', fontSize: 13 }}
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5e6d7d' }}>
                  <span>Calculated GST:</span>
                  <strong style={{ color: '#172e46' }}>{inr(taxAmount)}</strong>
                </div>

                {/* Delivery input */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#5e6d7d' }}>Delivery / Transport (₹):</span>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={deliveryCharge} 
                    onChange={e => setDeliveryCharge(e.target.value)}
                    style={{ width: 110, padding: '5px 8px', borderRadius: 6, border: '1px solid #dce2e8', textAlign: 'right', fontSize: 13 }}
                  />
                </div>

                {/* Grand Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px dashed #d5dce4', paddingTop: 14, marginTop: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#10253e' }}>Grand Total:</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#b9622d' }}>{inr(totalAmount)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
                <button 
                  type="button" 
                  className="btn primary full" 
                  style={{ padding: '12px 14px', fontSize: 14 }}
                  onClick={() => handleSaveBill('print')}
                  disabled={!items.length}
                >
                  <Printer size={18}/> Save &amp; Print Bill
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button 
                    type="button" 
                    className="btn outline" 
                    style={{ fontSize: 12, padding: '10px 8px' }}
                    onClick={() => handleSaveBill('pdf')}
                    disabled={!items.length}
                    title="Download A4 PDF invoice to device"
                  >
                    <Download size={15}/> Download PDF
                  </button>
                  <button 
                    type="button" 
                    className="btn outline" 
                    style={{ fontSize: 12, padding: '10px 8px', color: '#15803d', borderColor: '#bbf7d0' }}
                    onClick={() => handleSaveBill('whatsapp')}
                    disabled={!items.length}
                    title="Send PDF directly to WhatsApp"
                  >
                    <MessageCircle size={15}/> WhatsApp (PDF)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                  <button 
                    type="button" 
                    className="unstyled muted" 
                    style={{ fontSize: 12, textDecoration: 'underline' }}
                    onClick={handleResetForm}
                  >
                    Clear Form
                  </button>
                  <button 
                    type="button" 
                    className="unstyled" 
                    style={{ fontSize: 12, fontWeight: 700, color: '#10253e' }}
                    onClick={() => handleSaveBill('none')}
                    disabled={!items.length}
                  >
                    Save Record Only →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View: BILLS HISTORY */}
      {viewMode === 'history' && (
        <div className="panel">
          <div className="catalog-controls" style={{ marginBottom: 18 }}>
            <label className="search-field">
              <Search size={17}/>
              <input 
                placeholder="Search by Bill ID, Customer name, Phone, or Item..." 
                value={historySearch} 
                onChange={e => setHistorySearch(e.target.value)}
              />
            </label>
            <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
              <option value="All">All Invoices</option>
              <option value="Paid">Paid Only</option>
              <option value="Unpaid">Unpaid Only</option>
            </select>
          </div>

          {historyOrders.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice / Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th>Payment</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyOrders.map(order => {
                    const isPaid = order.payment?.status === 'Paid';
                    return (
                      <tr key={order.id}>
                        <td>
                          <b>#{order.id}</b>
                          <small>{day(order.createdAt)}</small>
                        </td>
                        <td>
                          <strong>{order.customer?.name || 'Walk-in'}</strong>
                          <small>{order.customer?.phone || 'No phone'}</small>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: '#445161' }}>
                            {(order.items || []).map(i => `${i.name} × ${i.qty}`).join(', ') || 'Custom Bill'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#172e46' }}>
                          {inr(order.total)}
                        </td>
                        <td>
                          <span className={`tag ${isPaid ? 'good' : ''}`}>
                            {order.payment?.status || 'Unpaid'} · {order.payment?.method || 'Cash'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'center' }}>
                            <button 
                              type="button" 
                              className="btn icon-btn outline" 
                              onClick={() => printInvoice(order, data.shop)}
                              title="Print Invoice"
                            >
                              <Printer size={15}/>
                            </button>
                            <button 
                              type="button" 
                              className="btn icon-btn outline" 
                              onClick={() => downloadInvoicePDF(order, data.shop)}
                              title="Download PDF"
                            >
                              <Download size={15}/>
                            </button>
                            <button 
                              type="button" 
                              className="btn icon-btn outline" 
                              style={{ color: '#15803d' }}
                              onClick={() => shareInvoiceWhatsApp(order, data.shop)}
                              title="Send on WhatsApp"
                            >
                              <MessageCircle size={15}/>
                            </button>
                            <button 
                              type="button" 
                              className="btn outline" 
                              style={{ fontSize: 11, padding: '6px 9px' }}
                              onClick={() => setPreviewOrder(order)}
                            >
                              <Eye size={14}/> View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-minor" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#7b8793' }}>No bills match your search or filter.</p>
            </div>
          )}
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewOrder && (
        <div className="customer-auth-backdrop" role="presentation" onClick={() => setPreviewOrder(null)}>
          <div 
            className="panel" 
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()} 
            style={{ width: 'min(100%, 650px)', maxHeight: '90vh', overflowY: 'auto', padding: 26, background: '#fff', borderRadius: 14, boxShadow: '0 25px 60px rgba(0,0,0,0.35)', position: 'relative' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf0f4', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="brand-mark" style={{ width: 34, height: 34, fontSize: 14, borderRadius: 8 }}>AS</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Invoice #{previewOrder.id}</h2>
                  <small style={{ color: '#7a8795' }}>Generated on {day(previewOrder.createdAt)}</small>
                </div>
              </div>
              <button 
                type="button" 
                className="unstyled" 
                onClick={() => setPreviewOrder(null)} 
                style={{ padding: 6, borderRadius: 6, color: '#687787' }}
                aria-label="Close"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Invoice Details Body */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13, marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#b9622d', fontWeight: 800 }}>CUSTOMER DETAILS</span>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{previewOrder.customer?.name || 'Walk-in Customer'}</div>
                  <div style={{ color: '#637385' }}>{previewOrder.customer?.phone || 'No phone'}</div>
                  {previewOrder.customer?.address && <div style={{ color: '#637385', fontSize: 12 }}>{previewOrder.customer.address}</div>}
                  {previewOrder.customer?.gstin && <div style={{ color: '#637385', fontSize: 12 }}>GSTIN: {previewOrder.customer.gstin}</div>}
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#b9622d', fontWeight: 800 }}>PAYMENT DETAILS</span>
                  <div style={{ marginTop: 4 }}>
                    <span className={`tag ${previewOrder.payment?.status === 'Paid' ? 'good' : ''}`}>
                      {previewOrder.payment?.status || 'Unpaid'}
                    </span>
                  </div>
                  <div style={{ color: '#637385', marginTop: 4 }}>Method: {previewOrder.payment?.method || 'Cash'}</div>
                  {data.shop.upi && <div style={{ color: '#637385', fontSize: 12 }}>UPI: {data.shop.upi}</div>}
                </div>
              </div>

              {/* Items Table in Preview */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
                <thead>
                  <tr style={{ background: '#10253e', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Qty</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 90 }}>Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 100 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewOrder.items || []).map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e9ef' }}>
                      <td style={{ padding: '8px 10px' }}>{it.name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{inr(it.unitPrice)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{inr(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary in Preview */}
              <div style={{ display: 'grid', gap: 6, marginTop: 14, paddingTop: 10, borderTop: '1px solid #dce2e8', fontSize: 13, textAlign: 'right' }}>
                <div>Subtotal: <strong>{inr(previewOrder.subtotal)}</strong></div>
                {previewOrder.discount > 0 && <div style={{ color: '#16a34a' }}>Discount: -<strong>{inr(previewOrder.discount)}</strong></div>}
                {previewOrder.tax > 0 && <div>GST / Tax: <strong>{inr(previewOrder.tax)}</strong></div>}
                {previewOrder.deliveryCharge > 0 && <div>Delivery: <strong>{inr(previewOrder.deliveryCharge)}</strong></div>}
                <div style={{ fontSize: 17, fontWeight: 900, color: '#b9622d', borderTop: '2px solid #cbd5e1', paddingTop: 6 }}>
                  Grand Total: {inr(previewOrder.total)}
                </div>
              </div>
            </div>

            {/* Action Buttons in Modal */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn primary" 
                onClick={() => printInvoice(previewOrder, data.shop)}
              >
                <Printer size={16}/> Print Invoice
              </button>
              <button 
                type="button" 
                className="btn outline" 
                onClick={() => downloadInvoicePDF(previewOrder, data.shop)}
              >
                <Download size={16}/> Download PDF
              </button>
              <button 
                type="button" 
                className="btn outline" 
                style={{ color: '#15803d', borderColor: '#bbf7d0' }}
                onClick={() => shareInvoiceWhatsApp(previewOrder, data.shop)}
              >
                <MessageCircle size={16}/> Send on WhatsApp
              </button>
              <button 
                type="button" 
                className="btn outline" 
                onClick={() => setPreviewOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
