import React, { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Layers3, Users, ClipboardList, SlidersHorizontal, ChartNoAxesCombined,
  LogOut, Menu, X, Plus, Edit3, Trash2, Save, FileText, MessageCircle,
  Wallet, Search, Download, Upload, Package, Clock, ArrowRight, ExternalLink,
  ShieldAlert, Database, ImagePlus, IndianRupee, Star, RefreshCw, Receipt, Printer,
  ArrowLeft, Phone, ChevronRight } from 'lucide-react';
import { updateStore, replaceStore, productPrice, makeId } from '../lib/store.js';
import { inr, day, phoneNumber, whatsappUrl, ProductArt, printInvoice, downloadJSON } from '../lib/utils.jsx';
import { downloadInvoicePDF, shareInvoiceWhatsApp } from '../lib/invoicePdf.js';

import { BusinessReports, CustomerHistory, PromotionSettings } from './StaffBusiness.jsx';
import StaffBilling from './StaffBilling.jsx';
import { toast } from 'react-toastify';
import { apiUrl } from '../lib/api.js';

const blankProduct={name:'',category:'Industrial Dies',metal:'Tool Steel D2',weight:'',makingCharge:'',fixedPrice:'',deliveryCharge:'',shape:'round',stock:'',description:'',dimensions:'',image:'',featured:false,quoteOnly:false};
const nav=[['dashboard','Dashboard',LayoutDashboard],['billing','Billing / POS',Receipt],['rates','Metal rates',ChartNoAxesCombined],['products','Products',Layers3],['users','Users',Users],['customers','Customers',Users],['orders','Orders & quotes',ClipboardList],['reports','Reports',ChartNoAxesCombined],['promotions','Promotions',Star],['settings','Settings',SlidersHorizontal]];
const staffTabs=nav.map(([id])=>id);
function staffTabFromPath(path){const tab=path.replace(/^\/staff\/?/,'').replace(/\/$/,'');return staffTabs.includes(tab)?tab:'dashboard';}
const statuses=['Pending','Processing','Shipped','Delivered','Cancelled'];
const toProductForm=p=>({...p,weight:String(p.weight||''),makingCharge:String(p.makingCharge||''),fixedPrice:String(p.fixedPrice||''),deliveryCharge:String(p.deliveryCharge??''),stock:p.stock===null?'':String(p.stock)});

async function shrinkImage(file){
  if(!file)return '';
  if(!file.type.startsWith('image/'))throw Error('Choose a valid image file.');
  return new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();
    reader.onerror=()=>reject(Error('Cannot read image.'));
    reader.onload=()=>{img.onerror=()=>reject(Error('Unsupported image.'));img.onload=()=>{
      const factor=Math.min(1,700/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.floor(img.width*factor));canvas.height=Math.max(1,Math.floor(img.height*factor));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL('image/jpeg',.72));
    };img.src=reader.result;};reader.readAsDataURL(file);
  });
}
const selectData=(key)=>(obj,event)=>({...obj,[key]:event.target.value});

export default function StaffApp({data}) {
  const [unlocked,setUnlocked]=useState(()=>sessionStorage.getItem('as-staff-demo')==='1');
  const [tab,setTab]=useState(()=>staffTabFromPath(window.location.pathname));
  const [mobile,setMobile]=useState(false);
  const [editProduct,setEditProduct]=useState(null);
  const [productForm,setProductForm]=useState(blankProduct);
  const [imageUploading,setImageUploading]=useState(false);
  const [metalForm,setMetalForm]=useState({name:'',rate:''});
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',address:''});
  const [settings,setSettings]=useState(data.shop);
  const [rules,setRules]=useState(data.deliveryRules.map(r=>r.join(':')).join(', '));
  const [rateValues,setRateValues]=useState(()=>Object.fromEntries(data.metals.map(m=>[m.id,String(m.rate)])));
  const [rateDate,setRateDate]=useState(data.dailyRateDate);
  const [orderFilter,setOrderFilter]=useState('All');
  const [orderSearch,setOrderSearch]=useState('');
  const [selectedOrderId,setSelectedOrderId]=useState(null);
  const [quoteAmounts,setQuoteAmounts]=useState({});
  const [registeredUsers,setRegisteredUsers]=useState([]);
  const [selectedUserId,setSelectedUserId]=useState('');
  const [userSearch,setUserSearch]=useState('');
  const [usersLoading,setUsersLoading]=useState(false);
  const [usersError,setUsersError]=useState('');
  const currency=n=>inr(n);

  useEffect(()=>setSettings(data.shop),[data.shop]);
  useEffect(()=>setRateValues(Object.fromEntries(data.metals.map(m=>[m.id,String(m.rate)]))),[data.metals]);
  useEffect(()=>setRateDate(data.dailyRateDate),[data.dailyRateDate]);
  useEffect(()=>setRules(data.deliveryRules.map(r=>r.join(':')).join(', ')),[data.deliveryRules]);
  useEffect(()=>{
    if(tab!=='users')return;
    let active=true;setUsersLoading(true);setUsersError('');
    fetch(apiUrl('/api/staff/customers'),{credentials:'include',cache:'no-store'}).then(async response=>{
      const result=await response.json();if(!response.ok)throw Error(result.error||'Could not load registered users.');
      if(active){setRegisteredUsers(Array.isArray(result)?result:[]);setSelectedUserId(current=>result.some(user=>user.id===current)?current:result[0]?.id||'');}
    }).catch(error=>{if(active)setUsersError(error.message);}).finally(()=>{if(active)setUsersLoading(false);});
    return()=>{active=false;};
  },[tab]);
  const visibleUsers=registeredUsers.filter(user=>`${user.name} ${user.phone}`.toLowerCase().includes(userSearch.toLowerCase()));
  const selectedUser=registeredUsers.find(user=>user.id===selectedUserId);
  const stats=useMemo(()=>({
    products:data.products.length,customers:data.customers.length,
    orders:data.orders.filter(o=>o.type==='order').length,
    quotes:data.orders.filter(o=>o.type==='quote').length,
    collected:data.orders.filter(o=>o.type==='order'&&o.payment?.status==='Paid').reduce((v,o)=>v+o.total,0),
    outstanding:data.orders.filter(o=>o.type==='order'&&o.payment?.status!=='Paid'&&o.status!=='Cancelled').reduce((v,o)=>v+o.total,0)
  }),[data]);
  const filteredOrders=data.orders.filter(o=>{
    const match=orderFilter==='All'||(orderFilter==='Quotes' ? o.type==='quote':o.status===orderFilter);
    return match&&`${o.id} ${o.customer?.name} ${o.customer?.phone} ${o.items.map(i=>i.name).join(' ')}`.toLowerCase().includes(orderSearch.toLowerCase());
  });
  const selectedOrder=data.orders.find(o=>o.id===selectedOrderId);
  const navigate=(value)=>{setTab(value);const path=value==='dashboard'?'/staff/':`/staff/${value}`;if(window.location.pathname!==path)window.history.pushState({},'',path);setMobile(false);setOrderSearch('');setOrderFilter('All');setSelectedOrderId(null);window.scrollTo(0,0);};
  useEffect(()=>{const sync=()=>setTab(staffTabFromPath(window.location.pathname));window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  function openOrder(id){navigate('orders');setSelectedOrderId(id);window.scrollTo(0,0);}
  function loginDemo(){sessionStorage.setItem('as-staff-demo','1');setUnlocked(true);}
  function logout(){sessionStorage.removeItem('as-staff-demo');setUnlocked(false);navigate('dashboard');}
  function alertMsg(s){toast(s);}
  function saveRates(e){e.preventDefault();updateStore(d=>{
    d.metals.forEach(m=>{m.rate=+rateValues[m.id]||0;});d.dailyRateDate=rateDate;
  });alertMsg('Metal rates updated; variable product prices are recalculated automatically.');}
  function addMetal(e){e.preventDefault();if(!metalForm.name.trim())return;
    if(data.metals.some(m=>m.name.toLowerCase()===metalForm.name.trim().toLowerCase()))return alertMsg('This metal already exists.');
    updateStore(d=>d.metals.push({id:makeId('MET'),name:metalForm.name.trim(),rate:+metalForm.rate||0}));
    setMetalForm({name:'',rate:''});alertMsg('Metal added.');}
  function deleteMetal(id){if(!confirm('Delete this metal rate? Products referring to it may become incorrectly priced.'))return;
    updateStore(d=>{d.metals=d.metals.filter(x=>x.id!==id);});}
  function startEditProduct(p){setEditProduct(p.id);setProductForm(toProductForm(p));window.scrollTo({top:0,behavior:'smooth'});}
  function cancelProductEdit(){setEditProduct(null);setProductForm(blankProduct);}
  function saveProduct(e){e.preventDefault();if(!productForm.name.trim())return;
    if(!productForm.quoteOnly && !(+productForm.fixedPrice>0) &&
       (!productForm.metal || (!productForm.weight && !productForm.makingCharge)))return alertMsg('Enter fixed price or metal, weight and making charge.');
    const deliveryCharge=productForm.deliveryCharge===''?null:Number(productForm.deliveryCharge);
    if(deliveryCharge!==null && (!Number.isFinite(deliveryCharge) || deliveryCharge<0)) {
      return alertMsg('Enter a delivery charge of ₹0 or more.');
    }
    const product={id:editProduct || makeId('PRD'),name:productForm.name.trim(),
      category:productForm.category.trim()||'Other', metal:productForm.metal.trim()||'General',
      weight:+productForm.weight||0,makingCharge:+productForm.makingCharge||0,
      fixedPrice:+productForm.fixedPrice||0,deliveryCharge,stock:productForm.stock===''?null:Math.max(0,+productForm.stock||0),
      description:productForm.description.trim(),dimensions:(productForm.dimensions||'').trim(),featured:!!productForm.featured,shape:productForm.shape,image:productForm.image||'',
      quoteOnly:!!productForm.quoteOnly};
    updateStore(d=>{const ix=d.products.findIndex(p=>p.id===product.id);if(ix>=0)d.products[ix]={...d.products[ix],...product};else d.products.push(product);});
    cancelProductEdit();alertMsg('Product saved.');}
  function deleteProduct(id){if(!confirm('Delete product from catalog? Existing orders keep their item names.'))return;
    updateStore(d=>{d.products=d.products.filter(p=>p.id!==id);});}
  async function updateImage(file){if(!file)return;setImageUploading(true);try {
    const image=await shrinkImage(file);
    const response=await fetch(apiUrl('/api/product-images'),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Image upload failed.');
    setProductForm(f=>({...f,image:result.url}));alertMsg('Image uploaded to Cloudinary.');
  }catch(e){alertMsg(e.message);}finally{setImageUploading(false);}}
  function addCustomer(e){e.preventDefault();if(!newCustomer.name.trim())return;
    updateStore(d=>d.customers.push({id:makeId('CUS'),name:newCustomer.name.trim(),phone:phoneNumber(newCustomer.phone),address:newCustomer.address.trim()}));
    setNewCustomer({name:'',phone:'',address:''});alertMsg('Customer saved.');}
  function removeCustomer(id){if(!confirm('Remove this customer from the saved contacts list?'))return;
    updateStore(d=>{d.customers=d.customers.filter(c=>c.id!==id);});}
  async function orderStatus(id,status) {
    try {
      await updateStore(d=>{
        const order=d.orders.find(o=>o.id===id && o.type==='order');
        if(!order) throw new Error('This order is no longer available.');
        order.status=status;
      });
      alertMsg('Order status updated.');
    } catch(error) {alertMsg(error.message);}
  }
  function setPaid(id,paid){updateStore(d=>{const o=d.orders.find(x=>x.id===id);if(o)o.payment.status=paid?'Paid':'Unpaid';});}
  async function setQuotePrice(id, value) {
    const amount=Number(value);
    if(!Number.isFinite(amount)||amount<=0) return alertMsg('Enter a quotation amount above zero.');
    try {
      await updateStore(d=>{
        const quote=d.orders.find(o=>o.id===id && o.type==='quote' && o.status!=='Accepted');
        if(!quote) throw new Error('This quotation can no longer be repriced.');
        quote.quotedAmount=Math.round(amount*100)/100;
        quote.status='Quoted';
      });
      setQuoteAmounts(amounts=>{const next={...amounts};delete next[id];return next;});
      alertMsg('Quotation saved. Use WhatsApp to send the amount to the customer.');
    } catch(error) {alertMsg(error.message);}
  }
  async function recordQuoteAcceptance(id,amount) {
    try {
      await updateStore(d=>{
        const quote=d.orders.find(o=>o.id===id && o.type==='quote' && o.status==='Quoted' && o.quotedAmount===amount);
        if(!quote) throw new Error('The quotation changed. Review its latest price.');
        quote.status='Accepted';
        quote.acceptedAt=new Date().toISOString();
      });
      alertMsg('Customer acceptance recorded.');
    } catch(error) {alertMsg(error.message);}
  }
  function contactCustomer(order){const phone=phoneNumber(order.customer?.phone);if(!phone)return alertMsg('Customer phone number missing.');
    const body=order.type==='quote'?
      `Hello ${order.customer.name}, regarding your quotation ${order.id}${order.quotedAmount?' for '+currency(order.quotedAmount):''}. Please contact us to proceed.`:
      `Hello ${order.customer.name}, your order ${order.id} is ${order.status}. Total ${currency(order.total)}, payment ${order.payment?.status||'Unpaid'}.`;
    window.open(whatsappUrl(phone,body),'_blank','noopener,noreferrer');}
  async function saveSettings(e){e.preventDefault();const parsed=rules.split(',').map(x=>x.trim().split(':').map(Number)).filter(x=>x.length===2&&x.every(n=>Number.isFinite(n)&&n>0));
    if(!parsed.length)return alertMsg('Delivery rules must be in the format 10:3, 25:5.');
    try {
      const {promotions,...business}=settings;
      await updateStore(d=>{d.shop={...d.shop,...business,tax:+settings.tax||0};d.deliveryRules=parsed;});
      alertMsg('Business settings saved.');
    } catch(error) {alertMsg(error.message);}
  }
  async function importFile(e){const file=e.target.files?.[0];if(!file)return;
    if(!confirm('Import and REPLACE all current data with this backup? Export a backup first.')){e.target.value='';return;}
    try {const data=JSON.parse(await file.text());replaceStore(data);setEditProduct(null);setProductForm(blankProduct);alertMsg('Data imported successfully.');}
    catch(err){alertMsg(`Import failed: ${err.message}`);}finally{e.target.value='';}}

  if(!unlocked) return <div className="staff-login-page"><div className="staff-login-card">
    <div className="brand-mark large">AS</div><h1>{data.shop.name}</h1><p>Staff management panel</p><div className="demo-warning"><ShieldAlert size={23}/><div><strong>Local React demonstration</strong><p>The original app checked its password in browser JavaScript, which is not secure. This conversion intentionally does not embed your provided credentials. Connect a secure server-side authentication system before publishing.</p></div></div>
    <button className="btn primary full" onClick={loginDemo}>Open staff demo <ArrowRight size={18}/></button><a href="/" className="back-link">Go to customer storefront</a></div></div>;

  return <div className="staff-layout">
    <aside className={mobile?'staff-sidebar open':'staff-sidebar'}>
      <div className="sidebar-brand"><div className="brand-mark">AS</div><div><strong>{data.shop.name}</strong><small>Staff control center</small></div><button className="mobile-menu sidebar-close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav">{nav.map(([id,label,Icon])=><button key={id} className={id===tab?'active':''} onClick={()=>navigate(id)}><Icon size={19}/>{label}{id===tab&&<span>›</span>}</button>)}</nav>
      <div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ExternalLink size={17}/> Customer storefront</a><button onClick={logout}><LogOut size={17}/> Exit demo</button></div>
    </aside>
    {mobile&&<button className="sidebar-backdrop" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
    <div className="staff-main"><header className="staff-topbar"><button className="mobile-menu" onClick={()=>setMobile(true)} aria-label="Open menu"><Menu/></button><div><span className="staff-breadcrumb">AS / Staff panel</span><h2>{nav.find(n=>n[0]===tab)?.[1]}</h2></div><span className="staff-demo-label">Local demo</span></header>
      <main className="staff-content">
        {tab==='dashboard'&&<>
          <div className="dashboard-intro"><div><p className="eyebrow dark">OPERATIONS OVERVIEW</p><h1>Business dashboard</h1><p>Manage products, rates, enquiries, orders and customer records.</p></div><div style={{display:'flex',gap:9,flexWrap:'wrap'}}><button className="btn primary" onClick={()=>navigate('billing')}><Receipt size={17}/> Billing / POS</button><button className="btn outline" onClick={()=>navigate('products')}><Plus size={17}/> Add product</button></div></div>
          <div className="stat-grid"><Stat label="Catalog products" value={stats.products} icon={<Layers3/>}/><Stat label="Saved customers" value={stats.customers} icon={<Users/>}/><Stat label="Orders" value={stats.orders} icon={<ClipboardList/>}/><Stat label="Quotation requests" value={stats.quotes} icon={<MessageCircle/>}/><Stat label="Payments marked paid" value={currency(stats.collected)} icon={<Wallet/>}/><Stat label="Outstanding / unpaid" value={currency(stats.outstanding)} icon={<IndianRupee/>}/></div>
          <div className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p>The latest orders and quotation requests</p></div><button className="btn outline" onClick={()=>navigate('orders')}>See all <ArrowRight size={16}/></button></div>
            {data.orders.length?data.orders.slice(0,5).map(o=><div className="activity-row" key={o.id} onClick={()=>openOrder(o.id)} style={{cursor:'pointer'}} title="View order details"><div className="activity-icon">{o.type==='quote'?<MessageCircle/>:<Package/>}</div><div><b>{o.customer?.name||'Customer'}</b><small>{o.id} · {o.type==='quote'?'Quotation request':'Purchase order'}</small></div><span className={`tag ${o.status==='Delivered'?'good':''}`}>{o.status}</span><strong>{o.type==='quote'?'Quote':currency(o.total)}</strong></div>):<div className="empty-minor">No customer activity yet. New orders placed in the customer storefront will appear here.</div>}</div>
          <div className="quick-grid"><button className="quick-card" onClick={()=>navigate('billing')}><Receipt/><strong>Billing &amp; Invoices</strong><span>Create on-the-spot bills, print receipts &amp; send WhatsApp PDF.</span></button><button className="quick-card" onClick={()=>navigate('rates')}><ChartNoAxesCombined/><strong>Update metal rates</strong><span>Changes recalculate variable product prices.</span></button><button className="quick-card" onClick={()=>navigate('products')}><Layers3/><strong>Manage catalog</strong><span>Add product photos, prices, stock and descriptions.</span></button></div>
        </>}

        {tab==='billing'&&<StaffBilling data={data} onOpenOrder={openOrder}/>}

        {tab==='rates'&&<><div className="page-title compact"><h1>Metal rates</h1><p>Set the rate per kilogram. Variable-priced products use <b>metal rate × weight + making charge</b>.</p></div>
          <form className="panel" onSubmit={saveRates}><div className="panel-head"><h2>Daily metal pricing</h2><label className="inline-label">Effective date <input type="date" value={rateDate} onChange={e=>setRateDate(e.target.value)}/></label></div>
            <div className="rates-grid">{data.metals.map(m=><label className="rate-editor" key={m.id}><span>{m.name}</span><div><span>₹</span><input type="number" min="0" step="0.01" value={rateValues[m.id]??m.rate} onChange={e=>setRateValues(x=>({...x,[m.id]:e.target.value}))}/><small>/kg</small><button type="button" className="unstyled danger" title="Delete metal" onClick={()=>deleteMetal(m.id)}><Trash2 size={17}/></button></div></label>)}</div>
            <button type="submit" className="btn primary"><Save size={17}/> Save daily rates</button></form>
          <form className="panel form" onSubmit={addMetal}><h2>Add metal / material</h2><div className="form-grid"><label>Material name<input required value={metalForm.name} onChange={e=>setMetalForm(x=>({...x,name:e.target.value}))}/></label><label>Rate per kg (₹)<input type="number" min="0" step="0.01" value={metalForm.rate} onChange={e=>setMetalForm(x=>({...x,rate:e.target.value}))}/></label></div><button type="submit" className="btn outline"><Plus size={17}/> Add material</button></form>
        </>}

        {tab==='products'&&<><div className="page-title compact"><h1>Catalog & inventory</h1><p>Manage images, category, descriptions, fixed or metal-based pricing, and stock.</p></div>
          <form className="panel form" onSubmit={saveProduct}><div className="panel-head"><h2>{editProduct?'Edit product':'Add new product'}</h2>{editProduct&&<button type="button" className="btn outline" onClick={cancelProductEdit}>Cancel editing</button>}</div>
            <div className="form-grid"><label>Product name *<input required value={productForm.name} onChange={e=>setProductForm(selectData('name')(productForm,e))} placeholder="Example: Round Blanking Die"/></label><label>Category<input value={productForm.category} onChange={e=>setProductForm(selectData('category')(productForm,e))} placeholder="Industrial Dies"/></label></div>
            <div className="form-grid"><label>Metal / material<select value={productForm.metal} onChange={e=>setProductForm(selectData('metal')(productForm,e))}><option value="General">General</option>{data.metals.map(m=><option key={m.id}>{m.name}</option>)}</select></label><label>Shape icon<select value={productForm.shape} onChange={e=>setProductForm(selectData('shape')(productForm,e))}>{['round','square','hex','slot','star'].map(x=><option key={x}>{x}</option>)}</select></label></div>
            <div className="form-grid three"><label>Fixed price (₹)<input type="number" min="0" step="0.01" value={productForm.fixedPrice} onChange={e=>setProductForm(selectData('fixedPrice')(productForm,e))}/></label><label>Weight (kg)<input type="number" min="0" step="0.01" value={productForm.weight} onChange={e=>setProductForm(selectData('weight')(productForm,e))}/></label><label>Making charge (₹)<input type="number" min="0" step="0.01" value={productForm.makingCharge} onChange={e=>setProductForm(selectData('makingCharge')(productForm,e))}/></label></div>
            <p className="inline-note">If fixed price is greater than zero it is used. Otherwise the price is calculated from material rate, weight and making charge.</p>
            <label>Delivery charge per unit (₹)
              <input type="number" min="0" step="0.01" value={productForm.deliveryCharge}
                onChange={e=>setProductForm(selectData('deliveryCharge')(productForm,e))}
                placeholder="Leave blank if not set"/>
            </label>
            <div className="form-grid"><label>Stock quantity (empty = unlimited)<input type="number" min="0" value={productForm.stock} onChange={e=>setProductForm(selectData('stock')(productForm,e))}/></label><label>Product image {imageUploading&&<small>Uploading to Cloudinary…</small>}<input type="file" accept="image/*" disabled={imageUploading} onChange={e=>updateImage(e.target.files?.[0])}/></label></div>
            {productForm.image&&<div className="image-preview"><img src={productForm.image} alt="Product preview"/><button type="button" className="btn outline" onClick={()=>setProductForm(x=>({...x,image:''}))}>Remove photo</button></div>}
            <label>Dimensions<input value={productForm.dimensions??''} onChange={e=>setProductForm(x=>({...x,dimensions:e.target.value}))} placeholder="Example: 60 × 40 × 20 mm"/></label>
            <label className="check-row"><input type="checkbox" checked={!!productForm.featured} onChange={e=>setProductForm(x=>({...x,featured:e.target.checked}))}/> Feature on the storefront</label>
            <label>Description<textarea rows={3} value={productForm.description} onChange={e=>setProductForm(selectData('description')(productForm,e))}/></label>
            <label className="check-row"><input type="checkbox" checked={productForm.quoteOnly} onChange={e=>setProductForm(x=>({...x,quoteOnly:e.target.checked}))}/> Quotation only (disable direct purchase)</label>
            <button type="submit" className="btn primary" disabled={imageUploading}><Save size={17}/>{editProduct?'Update product':'Save product'}</button>
          </form>
          <div className="panel"><div className="panel-head"><h2>All products ({data.products.length})</h2><span className="muted">Previewed on customer storefront</span></div>
            <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category / metal</th><th>Live price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{data.products.map(p=><tr key={p.id}><td><div className="table-product"><div className="mini-art"><ProductArt product={p} size={54}/></div><span><b>{p.name}</b><small>{p.description||'No description'}</small></span></div></td><td>{p.category}<small>{p.metal}</small></td><td><b>{p.quoteOnly?'Quote':currency(productPrice(p,data))}</b></td><td>{p.stock===null?'Unlimited':p.stock===0?'Out of stock':p.stock}</td><td><div className="table-actions"><button className="btn outline" onClick={()=>startEditProduct(p)}><Edit3 size={15}/> Edit</button><button className="btn icon-btn danger-outline" onClick={()=>deleteProduct(p.id)} title="Delete"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
          </div>
        </>}

        {tab==='reports'&&<BusinessReports data={data} onOpenOrder={openOrder}/>}
        {tab==='promotions'&&<PromotionSettings promotions={data.shop.promotions} notify={alertMsg}/>}

        {tab==='users'&&<><div className="page-title compact"><h1>Registered users</h1><p>Customer accounts created through storefront sign up. Select a user to view their orders and delivery details.</p></div>
          <div className="panel"><label className="search-field"><Search size={17}/><input placeholder="Search by name or phone" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/></label></div>
          {usersError&&<div className="panel inline-note">{usersError}</div>}
          {usersLoading?<div className="panel empty-minor">Loading registered users…</div>:<div className="staff-users-layout">
            <section className="panel registered-user-list"><div className="panel-head"><h2>Users ({registeredUsers.length})</h2></div>{visibleUsers.length?visibleUsers.map(user=><button type="button" className={`registered-user-row${selectedUserId===user.id?' active':''}`} key={user.id} onClick={()=>setSelectedUserId(user.id)}><span className="registered-user-avatar"><Users size={17}/></span><span><b>{user.name}</b><small>{user.phone}</small></span><span className="user-order-count">{user.orders.filter(order=>order.type==='order').length} orders</span></button>):<p className="muted">{registeredUsers.length?'No users match your search.':'No storefront accounts have signed up yet.'}</p>}</section>
            <section className="registered-user-details">{selectedUser?<><div className="panel"><div className="user-detail-heading"><div><span className="eyebrow dark">REGISTERED ACCOUNT</span><h2>{selectedUser.name}</h2><p>{selectedUser.phone} · Joined {day(selectedUser.createdAt)}</p></div><span className="count-pill">{selectedUser.orders.filter(order=>order.type==='order').length} orders</span></div></div>
              <div className="panel"><h2>Orders & quotations ({selectedUser.orders.length})</h2>{selectedUser.orders.length?selectedUser.orders.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(order=><article className="registered-user-order" key={order.id}><div className="order-top"><div><span className="muted">{order.type==='quote'?'QUOTATION':'PURCHASE ORDER'} · {day(order.createdAt)}</span><h3>#{order.id}</h3></div><span className={`tag ${order.status==='Delivered'?'good':''}`}>{order.status}</span></div><div className="order-detail-grid"><div><small>Products</small><strong>{(order.items||[]).map(item=>`${item.name} × ${item.qty}`).join(', ')||'—'}</strong></div><div><small>Amount</small><strong>{order.type==='quote'?(order.quotedAmount?currency(order.quotedAmount):'Pending quote'):currency(order.total)}</strong></div><div><small>Payment</small><strong>{order.type==='quote'?'Not applicable':`${order.payment?.status||'Unpaid'} · ${order.payment?.method||''}`}</strong></div></div>{order.customer?.address&&<p className="order-note"><b>Delivery:</b> {order.customer.address}{order.customer.landmark?` · Landmark: ${order.customer.landmark}`:''}</p>}{order.notes&&<p className="order-note"><b>Notes:</b> {order.notes}</p>}</article>):<p className="muted">No orders or quotations are linked to this account yet.</p>}</div>
            </>:<div className="panel empty-minor">Select a user to view account details.</div>}</section>
          </div>}
        </>}

        {tab==='customers'&&<><div className="page-title compact"><h1>Customers</h1><p>Contacts saved from orders and added by staff.</p></div><form className="panel form" onSubmit={addCustomer}><h2>Add customer</h2><div className="form-grid three"><label>Name *<input required value={newCustomer.name} onChange={e=>setNewCustomer(x=>({...x,name:e.target.value}))}/></label><label>Phone<input type="tel" value={newCustomer.phone} onChange={e=>setNewCustomer(x=>({...x,phone:e.target.value}))}/></label><label>Address<input value={newCustomer.address} onChange={e=>setNewCustomer(x=>({...x,address:e.target.value}))}/></label></div><button className="btn primary" type="submit"><Plus size={17}/> Save customer</button></form>
          <CustomerHistory data={data} onOpenOrder={openOrder}/>
          <div className="panel"><h2>Customer records ({data.customers.length})</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Actions</th></tr></thead><tbody>{data.customers.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td>{c.phone||'-'}</td><td>{c.address||'-'}</td><td><div className="table-actions">{c.phone&&<a href={whatsappUrl(c.phone,`Hello ${c.name}, this is ${data.shop.name}.`)} target="_blank" rel="noreferrer" className="btn outline"><MessageCircle size={15}/> WhatsApp</a>}<button className="btn icon-btn danger-outline" onClick={()=>removeCustomer(c.id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>{!data.customers.length&&<p className="muted">No customers saved.</p>}</div>
        </>}

        {tab==='orders'&&<>{selectedOrderId?(selectedOrder?(
          <div className="order-detail-page">
            <div className="order-detail-header-bar">
              <button className="btn outline" onClick={()=>{setSelectedOrderId(null);window.scrollTo({top:0,behavior:'smooth'});}}>
                <ArrowLeft size={16}/> Back to orders
              </button>
              <div className="order-detail-header-info">
                <span className="muted">{selectedOrder.type==='quote'?(selectedOrder.quoteKind==='bulk'?'BULK PRICING REQUEST':'CUSTOM QUOTATION'):'PURCHASE ORDER'} · {day(selectedOrder.createdAt)}</span>
                <h2>#{selectedOrder.id}</h2>
              </div>
              <span className={`tag ${selectedOrder.status==='Delivered'?'good':''}`}>{selectedOrder.status}</span>
            </div>

            <div className="panel">
              <div className="panel-head"><h2>Customer &amp; delivery details</h2></div>
              <div className="order-detail-grid">
                <div><small>Customer name</small><strong>{selectedOrder.customer?.name||'Walk-in / Customer'}</strong></div>
                <div><small>Mobile number</small><strong>{selectedOrder.customer?.phone?<a href={`tel:${selectedOrder.customer.phone}`} style={{textDecoration:'underline'}}>{selectedOrder.customer.phone}</a>:'—'}</strong></div>
                <div><small>Order type</small><strong>{selectedOrder.type==='quote'?'Quotation Request':'Purchase Order'}</strong></div>
                <div><small>Expected delivery</small><strong>{day(selectedOrder.deliveryDate)}</strong></div>
              </div>
              {selectedOrder.customer?.address&&<div className="order-note" style={{marginTop:12}}><strong>Delivery address:</strong> {selectedOrder.customer.address}</div>}
              {selectedOrder.customer?.landmark&&<div className="order-note" style={{marginTop:8}}><strong>Landmark:</strong> {selectedOrder.customer.landmark}</div>}
              {selectedOrder.dimensions&&<div className="order-note" style={{marginTop:8}}><strong>Dimensions / material:</strong> {selectedOrder.dimensions}</div>}
              {selectedOrder.notes&&<div className="order-note" style={{marginTop:8}}><strong>Customer notes:</strong> {selectedOrder.notes}</div>}
            </div>

            <div className="panel">
              <div className="panel-head"><h2>Ordered items &amp; billing</h2></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item,idx)=><tr key={idx}>
                      <td><b>{item.name}</b></td>
                      <td>{item.qty}</td>
                      <td>{item.unitPrice?currency(item.unitPrice):'—'}</td>
                      <td><b>{item.subtotal?currency(item.subtotal):'—'}</b></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
                <div style={{minWidth:260,display:'grid',gap:8,fontSize:13}}>
                  <div style={{display:'flex',justifyContent:'space-between',color:'#687788'}}><span>Subtotal</span><span>{currency(selectedOrder.subtotal||0)}</span></div>
                  {(selectedOrder.tax>0)&&<div style={{display:'flex',justifyContent:'space-between',color:'#687788'}}><span>GST</span><span>{currency(selectedOrder.tax)}</span></div>}
                  <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #e2e8f0',paddingTop:8,fontWeight:800,fontSize:16,color:'#14253a'}}>
                    <span>Total amount</span>
                    <span>{selectedOrder.type==='quote'?(selectedOrder.quotedAmount?currency(selectedOrder.quotedAmount):'Pending quote'):currency(selectedOrder.total)}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',color:'#687788',fontSize:12}}>
                    <span>Payment</span>
                    <b>{selectedOrder.type==='quote'?'Not applicable':`${selectedOrder.payment?.status||'Unpaid'} · ${selectedOrder.payment?.method||''}`}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><h2>Manage status &amp; actions</h2></div>
              {selectedOrder.type==='quote'&&selectedOrder.attachment?.id&&<div className="order-actions" style={{marginBottom:14}}>
                <a className="btn outline" href={apiUrl(`/api/quote-attachments/${encodeURIComponent(selectedOrder.attachment.id)}`)} target="_blank" rel="noreferrer">
                  <Download size={16}/> {selectedOrder.attachment.name || 'Download drawing'}
                </a>
              </div>}
              {selectedOrder.type==='quote'?(selectedOrder.status==='Accepted'?<p className="order-note">Customer acceptance recorded {day(selectedOrder.acceptedAt)}.</p>:
                <form className="quote-inline" onSubmit={e=>{e.preventDefault();setQuotePrice(selectedOrder.id,quoteAmounts[selectedOrder.id]??selectedOrder.quotedAmount);}}>
                  <label>Quotation total (₹)<input required type="number" min="0.01" step="0.01" value={quoteAmounts[selectedOrder.id]??selectedOrder.quotedAmount??''} onChange={e=>setQuoteAmounts(a=>({...a,[selectedOrder.id]:e.target.value}))}/></label>
                  <button className="btn primary" type="submit">Save quotation</button>
                  {selectedOrder.status==='Quoted'&&selectedOrder.quotedAmount>0&&<button className="btn outline" type="button" onClick={()=>recordQuoteAcceptance(selectedOrder.id,selectedOrder.quotedAmount)}>Record customer acceptance</button>}
                </form>):
                <div className="order-inline" style={{marginTop:0,marginBottom:16}}><label>Order status <select value={selectedOrder.status} onChange={e=>orderStatus(selectedOrder.id,e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><button className="btn outline" onClick={()=>setPaid(selectedOrder.id,selectedOrder.payment?.status!=='Paid')}><Wallet size={15}/>{selectedOrder.payment?.status==='Paid'?'Mark unpaid':'Mark payment paid'}</button></div>}
              <div className="order-actions" style={{borderTop:'1px solid #edf0f3',paddingTop:16}}>
                <button className="btn outline" onClick={()=>contactCustomer(selectedOrder)}><MessageCircle size={16}/> {selectedOrder.type==='quote'&&selectedOrder.quotedAmount?'Send quote on WhatsApp':'WhatsApp'}</button>
                {selectedOrder.type==='order'&&<>
                  <button className="btn outline" onClick={()=>printInvoice(selectedOrder,data.shop)} title="Print invoice receipt"><Printer size={16}/> Print</button>
                  <button className="btn outline" onClick={()=>downloadInvoicePDF(selectedOrder,data.shop)} title="Download official A4 PDF invoice"><Download size={16}/> PDF</button>
                  <button className="btn outline" style={{color:'#15803d',borderColor:'#bbf7d0'}} onClick={()=>shareInvoiceWhatsApp(selectedOrder,data.shop)} title="Send invoice PDF directly to WhatsApp"><MessageCircle size={16}/> WhatsApp (PDF)</button>
                </>}
              </div>
            </div>
          </div>
        ):(
          <div className="panel empty-minor">
            <p>Order #{selectedOrderId} was not found.</p>
            <button className="btn outline" onClick={()=>{setSelectedOrderId(null);window.scrollTo({top:0,behavior:'smooth'});}}><ArrowLeft size={16}/> Back to orders</button>
          </div>
        )):(
          <>
            <div className="page-title compact"><h1>Orders &amp; quotations</h1><p>View transactions, update statuses, confirm manual payments and reply to enquiries.</p></div>
            <div className="panel"><div className="catalog-controls"><label className="search-field"><Search size={17}/><input placeholder="Order ID, customer or product" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/></label><select value={orderFilter} onChange={e=>setOrderFilter(e.target.value)}><option>All</option><option>Quotes</option>{statuses.map(s=><option key={s}>{s}</option>)}<option>Quotation Requested</option><option>Quoted</option><option>Accepted</option></select></div></div>
            {filteredOrders.length?(
              <div className="order-simple-list">
                {filteredOrders.map(o=>(
                  <article className="order-simple-card" key={o.id} onClick={()=>{setSelectedOrderId(o.id);window.scrollTo({top:0,behavior:'smooth'});}} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelectedOrderId(o.id);}}>
                    <div className="order-simple-header">
                      <span className="order-simple-id"><strong>#{o.id}</strong><small className="muted">· {day(o.createdAt)}</small></span>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {o.type==='quote'&&<span className="tag" style={{background:'#eef2f6',color:'#475569'}}>Quote</span>}
                        <span className={`tag ${o.status==='Delivered'?'good':''}`}>{o.status}</span>
                      </div>
                    </div>
                    <div className="order-simple-body">
                      <div className="order-simple-customer">
                        <small className="order-simple-label">Customer</small>
                        <b>{o.customer?.name||'Walk-in / Customer'}</b>
                        <span><Phone size={13}/> {o.customer?.phone||'No phone'}</span>
                      </div>
                      <div className="order-simple-products">
                        <small className="order-simple-label">Ordered Product</small>
                        <strong>{(o.items||[]).map(i=>`${i.name}${i.qty>1?` × ${i.qty}`:''}`).join(', ')||'No products listed'}</strong>
                      </div>
                      <div className="order-simple-price">
                        <small className="order-simple-label">Price</small>
                        <strong>{o.type==='quote'?(o.quotedAmount?currency(o.quotedAmount):'Pending quote'):currency(o.total)}</strong>
                      </div>
                      <div className="order-simple-action">
                        <span>Full details</span><ChevronRight size={16}/>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ):<div className="panel empty-minor">No orders found for this filter.</div>}
          </>
        )}</>}

        {tab==='settings'&&<><div className="page-title compact"><h1>Business settings</h1><p>Store details, invoice details, delivery rules, and local data backups.</p></div>
          <form className="panel form" onSubmit={saveSettings}><h2>Storefront & invoice details</h2><div className="form-grid"><label>Business name<input value={settings.name||''} onChange={e=>setSettings(s=>({...s,name:e.target.value}))}/></label><label>Phone / WhatsApp<input value={settings.phone||''} onChange={e=>setSettings(s=>({...s,phone:e.target.value}))}/></label></div><label>Tagline<input value={settings.tagline||''} onChange={e=>setSettings(s=>({...s,tagline:e.target.value}))}/></label><label>Business address<textarea rows={2} value={settings.address||''} onChange={e=>setSettings(s=>({...s,address:e.target.value}))}/></label><div className="form-grid"><label>GSTIN<input value={settings.gstin||''} onChange={e=>setSettings(s=>({...s,gstin:e.target.value}))}/></label><label>GST %<input type="number" min="0" max="100" step="0.01" value={settings.tax} onChange={e=>setSettings(s=>({...s,tax:e.target.value}))}/></label></div>
            <label>Contact email<input type="email" value={settings.email??''} onChange={e=>setSettings(s=>({...s,email:e.target.value}))}/></label>
            <label>Shipping policy<textarea rows={3} value={settings.shippingPolicy??''} onChange={e=>setSettings(s=>({...s,shippingPolicy:e.target.value}))}/></label>
            <label>Return policy<textarea rows={3} value={settings.returnPolicy??''} onChange={e=>setSettings(s=>({...s,returnPolicy:e.target.value}))}/></label>
            <label>FAQ<textarea rows={5} value={settings.faq??''} onChange={e=>setSettings(s=>({...s,faq:e.target.value}))} placeholder="Enter each question and answer on separate lines"/></label>
            <label>UPI ID (manual payment instructions)<input value={settings.upi||''} onChange={e=>setSettings(s=>({...s,upi:e.target.value}))}/></label><label className="check-row"><input type="checkbox" checked={settings.cod!==false} onChange={e=>setSettings(s=>({...s,cod:e.target.checked}))}/> Allow cash on delivery / manual collection</label>
            <label>Delivery rules (maximum qty:days, comma-separated)<input value={rules} onChange={e=>setRules(e.target.value)} placeholder="10:3, 25:5, 50:8, 100:12"/></label><p className="inline-note">Example: 10:3 means quantities up to 10 have an estimated 3-day delivery timeline.</p><button type="submit" className="btn primary"><Save size={17}/> Save settings</button>
          </form>
          <div className="panel"><h2>Data import / export</h2><p>Back up your product catalog, rates, customers and orders. You may also import data exported from the original staff app.</p><div className="action-row"><button className="btn outline" onClick={()=>downloadJSON(data,`AS-Commerce-backup-${new Date().toISOString().slice(0,10)}.json`)}><Download size={17}/> Export all data</button><label className="btn outline file-button"><Upload size={17}/> Import JSON<input hidden type="file" accept=".json,application/json" onChange={importFile}/></label><button className="btn outline" onClick={()=>downloadJSON({shop:data.shop,metals:data.metals,products:data.products},'AS-products.json')}><Download size={17}/> Export catalog</button></div><p className="inline-note">Importing replaces the shared commerce data in MongoDB. Exports are backups.</p></div>
          <div className="panel security-panel"><ShieldAlert size={25}/><div><h2>Security before launch</h2><p>The app now shares its data through MongoDB, but staff access is not authenticated yet. Restrict the backend to a trusted network until server-side authentication and authorization, per-customer order access, stock locking, and server-verified payments are implemented.</p></div></div>
        </>}
      </main>
    </div>
  </div>;
}
function Stat({label,value,icon}){return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>}
