import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShoppingCart, Menu, X, ArrowRight, ChevronRight, Truck, ShieldCheck,
  PackageCheck, ClipboardList, Phone, Mail, Plus, Minus, Trash2, MessageCircle,
  FileText, Star, CheckCircle2, Layers3, BadgeIndianRupee, Filter, Boxes,
  Heart, Scale, SlidersHorizontal, History, UserRound, Copy, MapPin, LogIn, LogOut } from 'lucide-react';
import { updateStore, refreshCommerceStore, productPrice, deliveryDate, makeId } from '../lib/store.js';
import { inr, day, phoneNumber, whatsappUrl, ProductArt, printInvoice, downloadInvoice, readAttachment } from '../lib/utils.jsx';
import { cartPromotion } from '../lib/promotions.js';
import { cartDeliveryCharges } from '../lib/deliveryCharges.js';
import { toast } from 'react-toastify';
import FuseButton from './FuseButton.jsx';
import { ProductReviews, ReviewForm } from './ProductReviews.jsx';
import { apiUrl } from '../lib/api.js';

const CART_KEY='as-metal-commerce-cart-v1';
const recentKey='as-commerce-recent-products';
const orderSteps=['Pending','Processing','Shipped','Delivered'];
const customerRoutes={shop:'/',products:'/products',history:'/order-history',orders:'/track-order',profile:'/profile',about:'/about',contact:'/contact',wishlist:'/wishlist',compare:'/compare',cart:'/cart',quote:'/quote'};
function customerPageFromPath(path){const route=path.replace(/\/$/,'')||'/';if(/^\/product\/[^/]+$/.test(route))return 'product';if(route==='/product'||route==='/products')return 'products';return Object.keys(customerRoutes).find(page=>customerRoutes[page]===route)||'shop';}

function readRecentlyViewed() {
  try {
    const ids=JSON.parse(localStorage.getItem(recentKey));
    return Array.isArray(ids) ? ids.filter(id=>typeof id==='string').slice(0,8) : [];
  } catch {
    return [];
  }
}

let razorpayScriptPromise;
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) razorpayScriptPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://checkout.razorpay.com/v1/checkout.js';
    script.async=true;
    script.onload=resolve;
    script.onerror=()=>{razorpayScriptPromise=null;reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'));};
    document.head.appendChild(script);
  });
  return razorpayScriptPromise;
}

function ProductSuggestions({ title, products, data, onSelect }) {
  if(!products.length) return null;
  const listRef=useRef(null);
  const featured=title==='Featured products';
  useEffect(()=>{
    if(!featured)return;
    const timer=setInterval(()=>{
      const list=listRef.current;
      const first=list?.querySelector('button');
      if(!list||!first||list.matches(':hover,:focus-within')||document.hidden)return;
      if(list.scrollLeft+list.clientWidth>=list.scrollWidth-8)list.scrollTo({left:0,behavior:'smooth'});
      else list.scrollBy({left:first.getBoundingClientRect().width+(parseFloat(getComputedStyle(list).gap)||12),behavior:'smooth'});
    },3000);
    return()=>clearInterval(timer);
  },[featured,products.length]);
  return <section className={`panel product-suggestions${featured?' featured-carousel':''}`}>
    <div className="suggestion-heading"><h2>{title}</h2></div>
    <div className="suggestion-grid" ref={listRef}>
      {products.map(product=><button type="button" key={product.id} onClick={()=>onSelect(product)}>
        <div className="suggestion-image"><ProductArt product={product} size={85}/></div>
        <strong>{product.name}</strong>
        <span>{product.quoteOnly?'Price on request':inr(productPrice(product,data))}</span>
      </button>)}
    </div>
  </section>;
}
function getCart(){try{return JSON.parse(localStorage.getItem(CART_KEY))||[]}catch{return []}}
const emptyContact={name:'',phone:'',address:'',landmark:'',pin:'',notes:''};
const bulkMinimum=10;
const customDesign='custom-design';
const emptyQuote={kind:'custom',productId:'',designName:'',quantity:'1',dimensions:'',notes:'',name:'',phone:'',address:''};
const validPhone=phone=>/^91\d{10}$/.test(phoneNumber(phone));
const quoteFileTypes=['application/pdf','image/png','image/jpeg'];

export default function CustomerApp({data}){
  const [page,setPage]=useState(()=>customerPageFromPath(window.location.pathname));
  const [customerAuth,setCustomerAuth]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState('login');
  const [authForm,setAuthForm]=useState({name:'',phone:'',password:''});
  const [authError,setAuthError]=useState('');
  const [authBusy,setAuthBusy]=useState(false);
  const [pendingAuthAction,setPendingAuthAction]=useState(null);
  const [cart,setCart]=useState(getCart);
  const [couponInput,setCouponInput]=useState('');
  const [appliedCoupon,setAppliedCoupon]=useState('');
  const [savedForLater,setSavedForLater]=useState(()=>{try{return JSON.parse(localStorage.getItem('as-commerce-saved-cart-v1'))||[]}catch{return []}});
  const [savedAddresses,setSavedAddresses]=useState(()=>{try{return JSON.parse(localStorage.getItem('as-commerce-addresses-v1'))||[]}catch{return []}});
  const [editingAddressIndex,setEditingAddressIndex]=useState(null);
  const [addressDraft,setAddressDraft]=useState(null);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('All Products');
  const [metal,setMetal]=useState('All metals');
  const [availability,setAvailability]=useState('all');
  const [minPrice,setMinPrice]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [sortBy,setSortBy]=useState('featured');
  const [productPage,setProductPage]=useState(1);
  const [productPageSize,setProductPageSize]=useState(()=>window.matchMedia('(min-width: 761px)').matches?8:6);
  const [wishlist,setWishlist]=useState(()=>{try{return JSON.parse(localStorage.getItem('as-commerce-wishlist-v1'))||[]}catch{return []}});
  const [compare,setCompare]=useState(()=>{try{return JSON.parse(localStorage.getItem('as-commerce-compare-v1'))||[]}catch{return []}});
  const [compareSearch,setCompareSearch]=useState('');
  const [compareQuery,setCompareQuery]=useState('');
  const [detailProductId,setDetailProductId]=useState(()=>{const match=window.location.pathname.match(/^\/product\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):'';});
  const [recentIds,setRecentIds]=useState(readRecentlyViewed);
  const [activeImage,setActiveImage]=useState(0);
  const [menu,setMenu]=useState(false);
  const [contact,setContact]=useState(()=>savedAddresses[0]?{
    ...emptyContact,
    name:savedAddresses[0].name||'',
    phone:savedAddresses[0].phone||'',
    address:savedAddresses[0].address||'',
    landmark:savedAddresses[0].landmark||'',
    pin:savedAddresses[0].pin||'',
  }:emptyContact);
  const [payment,setPayment]=useState('Cash on delivery');
  const [lookup,setLookup]=useState('');
  const [lookupReference,setLookupReference]=useState('');
  const [quote,setQuote]=useState(emptyQuote);
  const [quoteFile,setQuoteFile]=useState(null);
  const [fileError,setFileError]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [locating,setLocating]=useState(false);
  const submissionLock=useRef(false);
  const [success,setSuccess]=useState(null);
  const shop=data.shop;
  function setNotice(message){if(!message){toast.dismiss();return;}toast(message);}
  const categories=['All Products',...new Set(data.products.map(p=>p.category||'Other'))];
  const metals=[...new Set(data.products.map(p=>p.metal).filter(Boolean))];
  const products=useMemo(()=>{
    const found=data.products.filter(p=>{
      const price=productPrice(p,data);
      return (category==='All Products'||p.category===category)&&
        (metal==='All metals'||p.metal===metal)&&
        `${p.name} ${p.metal} ${p.category} ${p.description}`.toLowerCase().includes(search.toLowerCase())&&
        (!minPrice||p.quoteOnly||price>=+minPrice)&&(!maxPrice||p.quoteOnly||price<=+maxPrice)&&
        (availability==='all'||(availability==='ready'&&!p.quoteOnly&&p.stock!==0)||(availability==='custom'&&p.quoteOnly)||(availability==='stock'&&!p.quoteOnly&&p.stock>0));
    });
    if(sortBy==='price-low')found.sort((a,b)=>productPrice(a,data)-productPrice(b,data));
    if(sortBy==='price-high')found.sort((a,b)=>productPrice(b,data)-productPrice(a,data));
    if(sortBy==='name')found.sort((a,b)=>a.name.localeCompare(b.name));
    return found;
  },[data,category,metal,search,minPrice,maxPrice,availability,sortBy]);
  const totalProductPages=Math.ceil(products.length/productPageSize);
  const visibleProducts=products.slice((productPage-1)*productPageSize,productPage*productPageSize);
  useEffect(()=>{
    const media=window.matchMedia('(min-width: 761px)');
    const updatePageSize=()=>setProductPageSize(media.matches?8:6);
    media.addEventListener('change',updatePageSize);
    return()=>media.removeEventListener('change',updatePageSize);
  },[]);
  useEffect(()=>{setProductPage(1);},[productPageSize]);
  useEffect(()=>{setProductPage(1);},[search,category,metal,minPrice,maxPrice,availability,sortBy]);
  const detailProduct=data.products.find(p=>p.id===detailProductId);
  const recentProducts=recentIds.map(id=>data.products.find(p=>p.id===id))
    .filter(p=>p && (page!=='product' || p.id!==detailProduct?.id)).slice(0,4);
  const relatedProducts=detailProduct ? data.products.filter(p=>p.id!==detailProduct.id &&
    ((p.category && p.category===detailProduct.category) || (p.metal && p.metal===detailProduct.metal)))
    .sort((a,b)=>Number(b.metal===detailProduct.metal)-Number(a.metal===detailProduct.metal))
    .slice(0,4) : [];
  const compareProducts=compare.map(id=>data.products.find(p=>p.id===id)).filter(Boolean);
  const comparePickerProducts=data.products.filter(product=>!compareQuery||
    `${product.name} ${product.category||''} ${product.metal||''} ${product.description||''}`.toLowerCase().includes(compareQuery.toLowerCase()));
  const cartLines=cart.map(line=>{const product=data.products.find(p=>p.id===line.id);
    return product ? {product,quantity:line.quantity,price:productPrice(product,data)} : null;
  }).filter(Boolean);
  const subtotal=cartLines.reduce((a,l)=>a+l.quantity*l.price,0);
  const itemCount=cartLines.reduce((a,l)=>a+l.quantity,0);
  const promotion=cartPromotion(subtotal,itemCount,shop.promotions,appliedCoupon);
  const tax=Math.round((subtotal-promotion.discount)*(+shop.tax||0))/100;
  const delivery=cartDeliveryCharges(cartLines);
  const total=Math.round((subtotal-promotion.discount+tax+delivery.amount)*100)/100;
  const featuredProducts=data.products.filter(product=>product.featured).slice(0,4);

  function applyCoupon(event) {
    event.preventDefault();
    const code=couponInput.trim().toUpperCase();
    if(!code || shop.promotions?.coupon?.code!==code) {
      toast.error('Enter a valid coupon code.');
      return;
    }
    setAppliedCoupon(code);
    toast.success('Coupon applied.');
  }

  useEffect(()=>{localStorage.setItem(CART_KEY,JSON.stringify(cart));},[cart]);
  useEffect(()=>{localStorage.setItem('as-commerce-saved-cart-v1',JSON.stringify(savedForLater));},[savedForLater]);
  useEffect(()=>{localStorage.setItem('as-commerce-addresses-v1',JSON.stringify(savedAddresses));},[savedAddresses]);
  useEffect(()=>{localStorage.setItem('as-commerce-wishlist-v1',JSON.stringify(wishlist));},[wishlist]);
  useEffect(()=>{localStorage.setItem('as-commerce-compare-v1',JSON.stringify(compare));},[compare]);
  useEffect(()=>{if(!shop.cod && payment==='Cash on delivery')setPayment('Razorpay');},[shop.cod,payment]);
  useEffect(()=>{
    let mounted=true;
    fetch(apiUrl('/api/customer/me'),{credentials:'include',cache:'no-store'})
      .then(response=>response.ok?response.json():{customer:null})
      .then(result=>{if(mounted&&result.customer){setCustomerAuth(result.customer);setContact(old=>({...old,name:old.name||result.customer.name,phone:old.phone||result.customer.phone}));}})
      .catch(()=>{})
      .finally(()=>{if(mounted)setAuthChecked(true);});
    return()=>{mounted=false;};
  },[]);
  function startCustomerAuth(action){
    setPendingAuthAction(action);
    setAuthForm(old=>({...old,name:contact.name||customerAuth?.name||old.name,phone:contact.phone||customerAuth?.phone||savedAddresses[0]?.phone||old.phone,password:''}));
    setAuthError('');
    setAuthOpen(true);
  }
  async function submitCustomerAuth(event){
    event.preventDefault();
    if(authBusy)return;
    setAuthBusy(true);setAuthError('');
    try{
      const response=await fetch(apiUrl(`/api/customer/${authMode==='signup'?'signup':'login'}`),{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(authMode==='signup'?authForm:{phone:authForm.phone,password:authForm.password}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Could not sign in. Please try again.');
      setCustomerAuth(result.customer);
      setContact(old=>({...old,name:old.name||result.customer.name,phone:old.phone||result.customer.phone}));
      setAuthOpen(false);setAuthForm(old=>({...old,password:''}));
      const action=pendingAuthAction;setPendingAuthAction(null);
      if(action?.type==='cart')go('cart');
      if(action?.type==='add'){
        const product=data.products.find(item=>item.id===action.productId);
        if(product)addCart(product);
      }
    }catch(error){setAuthError(error.message||'Could not sign in. Please try again.');}
    finally{setAuthBusy(false);}
  }
  async function logoutCustomer(){
    try{await fetch(apiUrl('/api/customer/logout'),{method:'POST',credentials:'include'});}catch{}
    setCustomerAuth(null);setAuthOpen(false);setPendingAuthAction(null);setNotice('You are signed out. Log in to use your cart.');go('products');
  }
  const go=(p)=>{if(p==='cart'&&!customerAuth){startCustomerAuth({type:'cart'});return;}setPage(p);if(p==='products'){setSearch('');setCategory('All Products');setMetal('All metals');setAvailability('all');setMinPrice('');setMaxPrice('');setSortBy('featured');}const path=p==='product'&&detailProductId?`/product/${encodeURIComponent(detailProductId)}`:(customerRoutes[p]||'/');if(window.location.pathname!==path)window.history.pushState({},'',path);setMenu(false);setSuccess(null);window.scrollTo({top:0,behavior:'smooth'});};
  useEffect(()=>{if(authChecked&&page==='cart'&&!customerAuth)startCustomerAuth({type:'cart'});},[authChecked,page,customerAuth]);
  useEffect(()=>{const sync=()=>{const path=window.location.pathname;const productMatch=path.match(/^\/product\/([^/]+)\/?$/);if(productMatch){setDetailProductId(decodeURIComponent(productMatch[1]));setPage('product');}else setPage(customerPageFromPath(path));};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  useEffect(()=>{
    try { localStorage.setItem(recentKey,JSON.stringify(recentIds)); } catch { /* Storage may be unavailable. */ }
  },[recentIds]);
  function openProduct(product) {
    setRecentIds(ids=>[product.id,...ids.filter(id=>id!==product.id)].slice(0,8));
    setDetailProductId(product.id);
    setActiveImage(0);
    go('product');
    window.history.replaceState({},'',`/product/${encodeURIComponent(product.id)}`);
  }
  function toggleWishlist(id){setWishlist(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);}
  function toggleCompare(id){setCompare(old=>old.includes(id)?old.filter(x=>x!==id):old.length>=5?(setNotice('Compare up to 5 products at a time.'),old):[...old,id]);}
  function addCart(product){
    if(product.quoteOnly){openQuote(product.id);return;}
    if(product.stock!==null&&product.stock<=0){setNotice('This product is currently out of stock.');return;}
    setCart(old=>{const has=old.find(c=>c.id===product.id);
      if(has && product.stock!==null && has.quantity>=product.stock){setNotice('Only the available stock can be added.');return old;}
      return has ? old.map(c=>c.id===product.id?{...c,quantity:c.quantity+1}:c) : [...old,{id:product.id,quantity:1}];
    });
    setNotice(`${product.name} added to cart.`);
  }
  function addCartReversibly(product){
    if(!customerAuth){startCustomerAuth({type:'add',productId:product.id});return;}
    if(product.quoteOnly){openQuote(product.id);return;}
    if(product.stock!==null&&product.stock<=0){setNotice('This product is currently out of stock.');return;}
    const previous=cart;
    const existing=cart.find(line=>line.id===product.id);
    if(existing&&product.stock!==null&&existing.quantity>=product.stock){setNotice('Only the available stock can be added.');return;}
    addCart(product);
    return ()=>{setCart(previous);setNotice(`${product.name} removed from cart.`);};
  }
  function cartAction(product){
    if(customerAuth)return <FuseButton disabled={product.stock===0} onCommit={()=>addCartReversibly(product)}/>;
    return <button type="button" className="btn primary" disabled={!authChecked||product.stock===0}
      onClick={()=>startCustomerAuth({type:'add',productId:product.id})}><ShoppingCart size={16}/>Add to cart</button>;
  }
  function changeQty(id,diff){const p=data.products.find(p=>p.id===id);
    setCart(old=>old.map(l=>l.id===id?{...l,quantity:Math.max(0,Math.min(p?.stock ?? Infinity,l.quantity+diff))}:l).filter(x=>x.quantity>0));
  }
  function openQuote(id='',kind='custom',quantity=1) {
    setQuote({...emptyQuote,kind,productId:id,quantity:String(quantity),
      name:contact.name,phone:contact.phone,address:contact.address});
    setQuoteFile(null);
    setFileError('');
    setNotice('');
    go('quote');
  }
  function chooseQuoteFile(event) {
    const file=event.target.files[0] || null;
    const invalid=file && (!quoteFileTypes.includes(file.type) || file.size>3*1024*1024 || !file.size);
    setQuoteFile(invalid ? null : file);
    setFileError(invalid ? 'Choose a PDF, PNG or JPEG file up to 3 MB.' : '');
  }
  function finishSubmission(record) {
    setLookup(record.customer.phone);
    setLookupReference(record.id);
    setSuccess(record);
    setNotice('');
    setPage('success');window.history.pushState({},'','/order-success');
    window.scrollTo(0,0);
  }
  function editSavedAddress(index) {
    setEditingAddressIndex(index);
    setAddressDraft({...savedAddresses[index]});
    setNotice('');
  }
  function saveEditedAddress(event) {
    event.preventDefault();
    if(!addressDraft?.name?.trim()||!validPhone(addressDraft.phone)||!addressDraft.address?.trim()||!/^[1-9]\d{5}$/.test(String(addressDraft.pin||'').trim())) {
      setNotice('Enter a name, valid Indian mobile number, delivery address and six-digit PIN code.');
      return;
    }
    const previous=savedAddresses[editingAddressIndex];
    const updated={...addressDraft,name:addressDraft.name.trim(),phone:phoneNumber(addressDraft.phone),address:addressDraft.address.trim(),landmark:(addressDraft.landmark||'').trim(),pin:String(addressDraft.pin).trim()};
    setSavedAddresses(old=>old.map((address,index)=>index===editingAddressIndex?updated:address));
    setContact(old=>old.phone===previous.phone&&old.address===previous.address&&old.pin===previous.pin?{...old,...updated}:old);
    setEditingAddressIndex(null);
    setAddressDraft(null);
    setNotice('Delivery address updated.');
  }
  async function useCurrentLocation() {
    if(!navigator.geolocation) {setNotice('Current location is not supported by this browser.');return;}
    setLocating(true);setNotice('Requesting your location…');
    try {
      const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:60000}));
      const {latitude,longitude}=position.coords;
      const response=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`,{headers:{'Accept-Language':'en'}});
      if(!response.ok)throw Error('Could not look up the address for this location.');
      const result=await response.json();
      const parts=result.address||{};
      const locality=parts.suburb||parts.neighbourhood||parts.village||parts.town||parts.city_district||parts.city||'';
      const address=[parts.house_number,parts.road,locality,parts.city||parts.town||parts.village,parts.state].filter((value,index,array)=>value&&array.indexOf(value)===index);
      if(!address.length)throw Error('Could not find a street address here. Please enter it manually.');
      setContact(old=>({...old,address:address.join(', '),pin:/^[1-9]\d{5}$/.test(parts.postcode||'')?parts.postcode:old.pin,landmark:old.landmark||parts.suburb||parts.neighbourhood||''}));
      setNotice(parts.postcode?'Location added. Please check the address before placing your order.':'Location added. Please check the address and enter your six-digit PIN code.');
    } catch(error) {
      const message=error.code===1?'Location permission was denied. Allow location access in your browser settings and try again.':error.code===2?'Your current location could not be determined. Try again or enter the address manually.':error.code===3?'Location request timed out. Try again.':error.message||'Could not get your current location.';
      setNotice(message);
    } finally {setLocating(false);}
  }
  async function startRazorpayCheckout(customer){
    submissionLock.current=true;
    setSubmitting(true);
    try{
      const createResponse=await fetch(apiUrl('/api/payments/razorpay/order'),{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          items:cartLines.map(({product,quantity})=>({id:product.id,quantity})),
          customer:{name:customer.name,phone:customer.phone,address:contact.address,landmark:contact.landmark,pin:contact.pin},
          notes:contact.notes,couponCode:appliedCoupon,
        }),
      });
      const created=await createResponse.json().catch(()=>({}));
      if(!createResponse.ok)throw new Error(created.error||'Could not start Razorpay checkout.');
      if(created.amount!==Math.round(total*100))throw new Error('Your total changed. Review the updated cart before paying.');
      await loadRazorpayCheckout();
      await new Promise((resolve,reject)=>{
        let verifying=false;
        const checkout=new window.Razorpay({
          key:created.keyId,amount:created.amount,currency:created.currency,
          name:shop.name,description:`Payment for ${itemCount} item${itemCount===1?'':'s'}`,
          order_id:created.razorpayOrderId,
          prefill:{name:customer.name,contact:customer.phone.replace(/^91/, '')},
          theme:{color:'#b9622d'},
          handler:async response=>{
            verifying=true;
            try{
              const verifyResponse=await fetch(apiUrl('/api/payments/razorpay/verify'),{
                method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(response),
              });
              const verified=await verifyResponse.json().catch(()=>({}));
              if(!verifyResponse.ok)throw new Error(verified.error||'Could not verify the Razorpay payment.');
              const order=verified.order;
              setSavedAddresses(old=>[
                {name:customer.name,phone:customer.phone,address:contact.address.trim(),landmark:contact.landmark.trim(),pin:contact.pin.trim()},
                ...old.filter(address=>!(address.phone===customer.phone&&address.address===contact.address.trim()&&address.pin===contact.pin.trim())),
              ]);
              setCart([]);setAppliedCoupon('');setCouponInput('');
              refreshCommerceStore().catch(console.error);
              finishSubmission(order);
              resolve();
            }catch(error){reject(error);}
          },
          modal:{ondismiss:()=>{if(!verifying)reject(new Error('Payment cancelled. Your order was not placed.'));}},
        });
        checkout.on('payment.failed',response=>reject(new Error(response.error?.description||'Payment failed. You can try again.')));
        checkout.open();
      });
    }catch(error){
      if(error.message?.toLowerCase().includes('cancelled'))toast.info(error.message);
      else setNotice(error.message||'Could not complete the online payment.');
    }finally{submissionLock.current=false;setSubmitting(false);}
  }
  async function checkout(event) {
    event.preventDefault();
    if(submissionLock.current || !cartLines.length) return;
    if(!contact.name.trim() || !validPhone(contact.phone) || !contact.address.trim() || !/^[1-9]\d{5}$/.test(contact.pin.trim())) {
      setNotice('Enter your name, a valid Indian mobile number, delivery address and six-digit PIN code.');
      return;
    }
    const customer={name:contact.name.trim(),phone:phoneNumber(contact.phone),
      address:contact.address.trim()+', PIN '+contact.pin.trim(),landmark:contact.landmark.trim(),pin:contact.pin.trim()};
    if(payment==='Razorpay'){
      await startRazorpayCheckout(customer);
      return;
    }
    const order={id:makeId(),type:'order',createdAt:new Date().toISOString(),
      customer,items:cartLines.map(({product,quantity,price})=>({
        productId:product.id,name:product.name,qty:quantity,unitPrice:price,subtotal:price*quantity,
      })),
      notes:contact.notes.trim(),subtotal,discount:promotion.discount,discountLabel:promotion.label,
      couponCode:promotion.couponCode,tax,taxRate:+shop.tax||0,total,
      deliveryCharge:delivery.amount,deliveryChargePending:delivery.pending,
      deliveryDate:deliveryDate(itemCount,data),status:'Pending',rating:0,
      payment:{method:payment,status:'Unpaid',reference:''}};
    submissionLock.current=true;
    setSubmitting(true);
    try {
      await updateStore(d=>{
        const currentProducts=order.items.map(item=>d.products.find(p=>p.id===item.productId));
        if(currentProducts.some((p,index)=>!p || p.quoteOnly || (p.stock!=null && p.stock<order.items[index].qty))) {
          throw new Error('Stock changed. Review your cart and try again.');
        }
        if ((+d.shop.tax||0)!==order.taxRate ||
            currentProducts.some((p,index)=>productPrice(p,d)!==order.items[index].unitPrice)) {
          throw new Error('Prices or GST changed. Review your updated cart and try again.');
        }
        const currentDelivery=cartDeliveryCharges(currentProducts.map((product,index)=>({
          product,quantity:order.items[index].qty,
        })));
        if(currentDelivery.amount!==order.deliveryCharge || currentDelivery.pending!==order.deliveryChargePending) {
          throw new Error('Delivery charges changed. Review your updated cart and try again.');
        }
        const currentPromotion=cartPromotion(subtotal,itemCount,d.shop.promotions,appliedCoupon);
        if(currentPromotion.discount!==order.discount || currentPromotion.label!==order.discountLabel) {
          throw new Error('Promotions changed. Review your updated cart total and try again.');
        }
        if (!d.shop.cod && payment==='Cash on delivery') {
          throw new Error('Cash on delivery is no longer available. Review the payment options.');
        }
        order.deliveryDate=deliveryDate(itemCount,d);
        d.orders.unshift(order);
        const found=d.customers.find(c=>phoneNumber(c.phone)===customer.phone);
        if(found) Object.assign(found,customer);
        else d.customers.push({id:makeId('CUS'),...customer});
        currentProducts.forEach((p,index)=>{if(p.stock!=null) p.stock-=order.items[index].qty;});
      });
      setSavedAddresses(old=>[
        {name:customer.name,phone:customer.phone,address:contact.address.trim(),landmark:contact.landmark.trim(),pin:contact.pin.trim()},
        ...old.filter(a=>!(a.phone===customer.phone&&a.address===contact.address.trim()&&a.pin===contact.pin.trim())),
      ]);
      setCart([]);
      setAppliedCoupon('');
      setCouponInput('');
      finishSubmission(order);
    } catch (error) {
      refreshCommerceStore().catch(console.error);
      setNotice(error.message || 'Could not save your order. Please try again.');
    } finally {
      submissionLock.current=false;
      setSubmitting(false);
    }
  }
  async function sendQuote(event) {
    event.preventDefault();
    if(submissionLock.current || fileError) return;
    const isBulk=quote.kind==='bulk';
    const product=data.products.find(p=>p.id===quote.productId);
    const name=product?.name || (!isBulk && quote.productId===customDesign ? quote.designName.trim() : '');
    const quantity=Number(quote.quantity);
    if(!name || !quote.name.trim() || !validPhone(quote.phone) || (!isBulk && !quote.notes.trim()) ||
        !Number.isSafeInteger(quantity) || quantity<(isBulk ? bulkMinimum : 1)) {
      setNotice(isBulk ? 'Select a product and enter a valid phone number and bulk quantity.' :
        'Enter a design, your name, a valid Indian mobile number and the design requirements.');
      return;
    }
    const request={id:makeId(isBulk?'BULK':'QUOTE'),type:'quote',quoteKind:quote.kind,createdAt:new Date().toISOString(),
      customer:{name:quote.name.trim(),phone:phoneNumber(quote.phone),address:quote.address.trim()},
      items:[{productId:product?.id ?? null,name,qty:quantity,unitPrice:0,subtotal:0}],
      dimensions:quote.dimensions.trim(),notes:quote.notes.trim(),subtotal:0,tax:0,total:0,
      deliveryDate:'',status:'Quotation Requested',rating:0,
      payment:{method:'Quotation',status:'Not applicable',reference:''}};
    submissionLock.current=true;
    setSubmitting(true);
    try {
      const file=quoteFile ? await readAttachment(quoteFile) : null;
      const response=await fetch(apiUrl('/api/quotes'),{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({quote:request,file}),
      });
      if(!response.ok) {
        const body=await response.json().catch(()=>null);
        throw new Error(body?.error || 'Could not save your request. Please try again.');
      }
      const saved=await response.json();
      refreshCommerceStore().catch(console.error);
      finishSubmission(saved);
      setQuote(emptyQuote);
      setQuoteFile(null);
    } catch (error) {
      setNotice(error.message || 'Could not save your request. Please try again.');
    } finally {
      submissionLock.current=false;
      setSubmitting(false);
    }
  }
  function rate(id,value){updateStore(d=>{const o=d.orders.find(x=>x.id===id);if(o&&o.status==='Delivered')o.rating=value;});}
  const reference=lookupReference.trim().replace(/^#/,'').toUpperCase();
  const historyOrders=validPhone(lookup)?data.orders.filter(order=>
    phoneNumber(order.customer?.phone)===phoneNumber(lookup))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)):[];
  const foundOrders=validPhone(lookup)&&Boolean(reference) ? data.orders.filter(order=>
    phoneNumber(order.customer?.phone)===phoneNumber(lookup) &&
    order.id.toUpperCase()===reference) : [];
  async function copyOrderId(id){
    try{await navigator.clipboard.writeText(id);setNotice('Order ID copied.');}
    catch{setNotice('Could not copy the order ID. Please select and copy it manually.');}
  }
  return <div className="customer-app">
    <div className="top-note"><span>Precision engineered • Made for industries</span><span className="hide-mobile">Customer storefront / React demo</span></div>
    <header className="customer-header">
      <div className="container header-row">
        <button className="brand unstyled" onClick={()=>go('shop')} aria-label="Home">
          <img src="/icon-192.png" alt={shop.name} className="brand-mark" width="42" height="42" /><span><strong>{shop.name}</strong><small>{shop.tagline}</small></span>
        </button>
        <nav className={menu?'nav-links open':'nav-links'}>
          <button className={page==='products'?'active':''} onClick={()=>go('products')}>Products</button>
          <button className={page==='quote'?'active':''} onClick={()=>openQuote()}>Custom quotation</button>
          <button className={page==='history'?'active':''} onClick={()=>{if(savedAddresses.length&&!lookup)setLookup(savedAddresses[0].phone);go('history');}}>Order history</button>
          <button className={page==='orders'?'active':''} onClick={()=>go('orders')}>Track order</button>
          <button className={page==='about'?'active':''} onClick={()=>go('about')}>About</button>
          <button className={page==='contact'?'active':''} onClick={()=>go('contact')}>Contact</button>
          <button className={`nav-auth-action ${customerAuth?'auth-logout':'auth-login'}`} onClick={()=>{setMenu(false);customerAuth?logoutCustomer():startCustomerAuth({type:'none'});}} aria-label={customerAuth?'Log out':'Log in'} title={customerAuth?'Log out':'Log in'}>{customerAuth?<LogOut size={19}/>:<LogIn size={19}/>}</button>
        </nav>
        <div className="header-actions">
          <button className="store-tool" onClick={()=>go('wishlist')} title="Wishlist"><Heart size={18}/><span>{wishlist.length}</span></button>
          <button className="store-tool" onClick={()=>go('compare')} title="Compare products"><Scale size={18}/><span>{compare.length}</span></button>
          <button className="cart-button" onClick={()=>go('cart')} title="Cart"><ShoppingCart size={20}/><span>{itemCount}</span></button>
          <button className="mobile-menu" onClick={()=>setMenu(x=>!x)} aria-label="Toggle navigation">{menu?<X/>:<Menu/>}</button>
        </div>
      </div>
    </header>

    {(page==='shop'||page==='products')&&<>
      {page==='shop'&&<section className="hero"><div className="container hero-inner"><div>
        <span className="eyebrow">PRECISION. STRENGTH. RELIABILITY.</span>
        <h1>Industrial-grade dies &amp; metal solutions.</h1>
        <p>Browse precision products, compare metal-based pricing, and place an order or request a custom quotation.</p>
        <div className="hero-actions"><button className="btn primary" onClick={()=>document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'})}>Explore catalog <ArrowRight size={18}/></button><button className="btn ghost-light" onClick={()=>openQuote()}>Request custom die</button></div>
      </div><div className="hero-figure" aria-hidden="true"><Layers3 size={152} strokeWidth={.7}/><div>AS <span>PRECISION WORKS</span></div></div></div></section>}
      {page==='shop'&&<section className="benefits"><div className="container benefit-grid"><div><Layers3/><span><b>Industrial Products</b><small>Dies, nakas & metal works</small></span></div><div><BadgeIndianRupee/><span><b>Transparent Prices</b><small>Price based on updated metal rates</small></span></div><div><Truck/><span><b>Order Tracking</b><small>Estimated delivery and status</small></span></div></div></section>}
      {page==='shop'&&featuredProducts.length>0&&<div className="container featured-products">
        <ProductSuggestions title="Featured products" products={featuredProducts} data={data} onSelect={openProduct}/>
      </div>}
      <section className="container catalog" id="catalog"><div className="section-heading"><div><p className="eyebrow dark">OUR COLLECTION</p><h2>Product catalog</h2><p>Shop ready products or request a quotation for custom designs.</p></div><span className="count-pill">{products.length} products</span></div>
        <div className="catalog-controls"><label className="search-field"><Search size={19}/><input placeholder="Search products, metals or designs" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="category-filter"><Filter size={18}/><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="category-filter"><select aria-label="Filter by metal" value={metal} onChange={e=>setMetal(e.target.value)}><option>All metals</option>{metals.map(m=><option key={m}>{m}</option>)}</select></label></div>
        <div className="advanced-filters"><span><SlidersHorizontal size={16}/> Refine</span><label>Min price <input type="number" min="0" value={minPrice} onChange={e=>setMinPrice(e.target.value)} placeholder="₹0"/></label><label>Max price <input type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="No limit"/></label><label>Product type <select value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">All products</option><option value="ready">Ready to order</option><option value="stock">In stock</option><option value="custom">Custom quotation</option></select></label><label className="sort-filter">Sort by <select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label></div>
        <div className="product-grid">{visibleProducts.map(p=><article className="product-card" key={p.id}>
          <div className="product-media" role="button" tabIndex={0} aria-label={`View details for ${p.name}`} onClick={()=>openProduct(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProduct(p);}}}><ProductArt product={p}/>{p.stock===0&&<span className="stock-label">Out of stock</span>}{p.quoteOnly&&<span className="stock-label alt">Custom quotation</span>}<div className="product-tools"><button className={wishlist.includes(p.id)?'selected':''} onClick={e=>{e.stopPropagation();toggleWishlist(p.id);}} aria-label="Toggle wishlist"><Heart size={17} fill={wishlist.includes(p.id)?'currentColor':'none'}/></button><button className={compare.includes(p.id)?'selected':''} onClick={e=>{e.stopPropagation();toggleCompare(p.id);}} aria-label="Compare product"><Scale size={17}/></button></div></div>
          <div className="product-info"><span className="product-category">{p.category||'Industrial Dies'} · {p.metal}</span><h3>{p.name}</h3><p className="clamp-two">{p.description || 'Precision metalwork product suitable for industrial requirements.'}</p>
            <div className="product-price">{p.quoteOnly?'Price on request':inr(productPrice(p,data))}<small>{p.quoteOnly?'': ' / unit • excl. GST'}</small></div>
            <div className="product-card-actions"><button className="btn outline" onClick={()=>openProduct(p)}>View details <ChevronRight size={16}/></button>{p.quoteOnly?<button className="btn primary" onClick={()=>openQuote(p.id)}>Request quote <ChevronRight size={16}/></button>:cartAction(p)}</div>
          </div></article>)}
        </div>{products.length>productPageSize&&<nav className="product-pagination" aria-label="Product pages"><button type="button" className="btn outline" disabled={productPage<=1} onClick={()=>{setProductPage(n=>n-1);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'});}}>Previous</button><div>{Array.from({length:totalProductPages},(_,i)=><button type="button" key={i+1} className={productPage===i+1?'active':''} aria-current={productPage===i+1?'page':undefined} onClick={()=>{setProductPage(i+1);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'});}}>{i+1}</button>)}</div><button type="button" className="btn outline" disabled={productPage>=totalProductPages} onClick={()=>{setProductPage(n=>n+1);document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'});}}>Next</button></nav>}{!products.length&&<div className="empty-state"><Boxes size={42}/><h3>No matching products</h3><p>Try a different keyword or metal category.</p></div>}
        {!!wishlist.length&&<div className="wishlist-section"><div className="section-heading"><div><p className="eyebrow dark">SAVED FOR LATER</p><h2>Wishlist</h2></div><span className="count-pill">{wishlist.length} saved</span></div><div className="wishlist-row">{data.products.filter(p=>wishlist.includes(p.id)).map(p=><button className="wishlist-item" key={p.id} onClick={()=>openProduct(p)}><ProductArt product={p} size={56}/><span><b>{p.name}</b><small>{p.quoteOnly?'Price on request':inr(productPrice(p,data))}</small></span><Heart size={16} fill="#b9622d" color="#b9622d"/></button>)}</div></div>}
        <div className="comparison-section" id="comparison"><div className="section-heading"><div><p className="eyebrow dark">PRODUCT COMPARISON</p><h2>Compare products</h2></div><span className="count-pill">{compare.length}/5 selected</span></div><p className="muted">Choose up to 5 products. <button className="back-to-shop" onClick={()=>go('compare')}>Open compare page →</button></p></div>
      </section>
      {page==='shop'&&<section className="container rate-section"><div className="rate-card"><div><p className="eyebrow dark">DAILY METAL RATES</p><h2>Material pricing reference</h2><p>Indicative internal price inputs last updated {day(data.dailyRateDate)}. Finished product pricing also includes making charges.</p></div><div className="rate-list">{data.metals.slice(0,6).map(m=><div key={m.id}><span>{m.name}</span><b>{inr(m.rate)} / kg</b></div>)}</div></div></section>}
    </>}

    {page==='shop'&&recentProducts.length>0&&<div className="container"><ProductSuggestions title="Recently viewed" products={recentProducts} data={data} onSelect={openProduct}/></div>}
    {page==='wishlist'&&<main className="container page-body"><div className="page-title"><span className="eyebrow dark">SAVED FOR LATER</span><h1>My wishlist</h1><p>{wishlist.length} saved products</p></div>{wishlist.length?<div className="product-grid">{data.products.filter(p=>wishlist.includes(p.id)).map(p=><article className="product-card" key={p.id}><div className="product-media"><ProductArt product={p}/></div><div className="product-info"><span className="product-category">{p.category||'Industrial Dies'} · {p.metal}</span><h3>{p.name}</h3><div className="product-price">{p.quoteOnly?'Price on request':inr(productPrice(p,data))}</div><div className="product-card-actions"><button className="btn outline" onClick={()=>openProduct(p)}>View details</button><button className="btn outline" onClick={()=>toggleWishlist(p.id)}>Remove</button></div></div></article>)}</div>:<div className="panel empty-minor">Your wishlist is empty. Browse products and tap the heart to save one.</div>}</main>}
    {page==='compare'&&<main className="container page-body">
      <div className="page-title"><span className="eyebrow dark">PRODUCT COMPARISON</span><h1>Compare products</h1><p>Select up to 5 products. Selected products show full details below.</p></div>
      <div className="panel">
        <div className="section-heading"><div><h2>Choose products</h2></div><span className="count-pill">{compareProducts.length}/5 selected</span></div>
        <form className="compare-search-form" onSubmit={event=>{event.preventDefault();setCompareQuery(compareSearch.trim());}}>
          <label className="search-field"><Search size={18}/><input aria-label="Search products to compare" placeholder="Search products, metals or categories" value={compareSearch} onChange={event=>setCompareSearch(event.target.value)}/></label>
          <button type="submit" className="btn primary"><Search size={16}/> Search</button>
          {compareQuery&&<button type="button" className="btn outline" onClick={()=>{setCompareSearch('');setCompareQuery('');}}>Clear</button>}
        </form>
        <div className="compare-picker">{comparePickerProducts.map(p=><div className="compare-picker-row" key={p.id}><div><strong>{p.name}</strong><span>{p.quoteOnly?'Price on request':inr(productPrice(p,data))}</span></div><button type="button" className={`btn ${compare.includes(p.id)?'primary':'outline'}`} onClick={()=>toggleCompare(p.id)} aria-label={`${compare.includes(p.id)?'Remove':'Add'} ${p.name} ${compare.includes(p.id)?'from':'to'} comparison`}>{compare.includes(p.id)?<X size={17}/>:<Plus size={17}/>} {compare.includes(p.id)?'Remove':'Add'}</button></div>)}</div>
        {!comparePickerProducts.length&&<p className="muted">No products match “{compareQuery}”.</p>}
      </div>
      <div className="panel"><div className="section-heading"><div><p className="eyebrow dark">SELECTED PRODUCTS</p><h2>Comparison</h2></div></div>{compareProducts.length?<div className="compare-scroll"><table className="compare-table"><thead><tr><th>Specification</th>{compareProducts.map(p=><th key={p.id}><button className="compare-remove" onClick={()=>toggleCompare(p.id)} aria-label={`Remove ${p.name}`}><X size={14}/></button><ProductArt product={p} size={68}/><b>{p.name}</b></th>)}</tr></thead><tbody>{[['Price',p=>p.quoteOnly?'Price on request':inr(productPrice(p,data))],['Category',p=>p.category||'Industrial Dies'],['Metal / material',p=>p.metal||'Not specified'],['Weight',p=>p.weight?`${p.weight} kg`:'Not specified'],['Dimensions',p=>p.dimensions||p.specifications?.dimensions||'Not specified'],['Making charge',p=>p.makingCharge?inr(p.makingCharge):'Included in listed price'],['Material rate',p=>p.metal?`${inr(data.metals.find(m=>m.name===p.metal)?.rate||0)} / kg`:'Not specified'],['Availability',p=>p.quoteOnly?'Custom quotation':p.stock===null?'Check availability':p.stock>0?`${p.stock} in stock`:'Out of stock'],['Description',p=>p.description||'Not provided'],...compareProducts.flatMap(p=>Object.entries(p.specifications||{}).map(([key])=>[key,product=>String(product.specifications?.[key]??'Not provided')]))].map(([label,value])=><tr key={label}><th>{label}</th>{compareProducts.map(p=><td key={p.id}>{value(p)}</td>)}</tr>)}</tbody></table></div>:<p className="muted">Press + next to products above to compare them here.</p>}</div>
    </main>}

    {page==='product'&&detailProduct&&(()=>{const p=detailProduct;const images=[p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean);const stockText=p.quoteOnly?'Made to order':p.stock==null?'Availability confirmed after enquiry':p.stock>0?`${p.stock} available`:'Currently out of stock';const specs=p.specifications&&typeof p.specifications==='object'?p.specifications:{};return <main className="container page-body product-detail-page"><button className="back-to-shop" onClick={()=>go('shop')}>← Back to products</button><div className="product-detail panel"><div><div className="detail-main-image">{images.length?<img src={images[activeImage]||images[0]} alt={p.name}/>:<ProductArt product={p} size={300}/>}</div>{images.length>1&&<div className="detail-thumbnails">{images.map((src,i)=><button className={i===activeImage?'active':''} key={`${src}-${i}`} onClick={()=>setActiveImage(i)}><img src={src} alt={`${p.name} view ${i+1}`}/></button>)}</div>}</div><div className="detail-copy"><span className="product-category">{p.category||'Industrial Dies'} · {p.metal||'Metal not specified'}</span><h1>{p.name}</h1><p>{p.description||'Precision metalwork product suitable for industrial requirements.'}</p><div className="detail-price">{p.quoteOnly?'Price on request':inr(productPrice(p,data))}<small>{p.quoteOnly?'':' / unit · excl. GST'}</small></div><div className={`detail-stock ${p.stock===0?'out':''}`}><PackageCheck size={18}/>{stockText}</div><div className="delivery-estimate"><Truck size={18}/><span>Estimated dispatch / delivery<br/><b>{p.quoteOnly?'Confirmed after quotation':day(deliveryDate(1,data))}</b></span></div><div className="detail-actions">{p.quoteOnly?<button className="btn primary" onClick={()=>openQuote(p.id)}>Request a quote <ArrowRight size={17}/></button>:cartAction(p)}<button className={`btn outline ${wishlist.includes(p.id)?'wish-on':''}`} onClick={()=>toggleWishlist(p.id)}><Heart size={17} fill={wishlist.includes(p.id)?'currentColor':'none'}/>{wishlist.includes(p.id)?'Saved':'Wishlist'}</button><button className={`btn outline ${compare.includes(p.id)?'wish-on':''}`} onClick={()=>toggleCompare(p.id)}><Scale size={17}/>{compare.includes(p.id)?'Compared':'Compare'}</button></div>{validPhone(shop.phone)&&<a className="btn outline product-whatsapp" href={whatsappUrl(shop.phone,'Hello, I have a question about '+p.name+' (product '+p.id+').')} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Ask on WhatsApp</a>}<div className="bulk-offer"><div><strong>Need {bulkMinimum} or more?</strong><p>Ask for pricing based on your quantity.</p></div><button className="btn outline" onClick={()=>openQuote(p.id,'bulk',bulkMinimum)}>Request bulk price</button></div><h2>Product specifications</h2><div className="spec-list">{[['Metal',p.metal||'Not specified'],['Category',p.category||'Industrial Dies'],['Dimensions',p.dimensions||specs.dimensions||'Contact us for dimensions'],['Weight',p.weight?`${p.weight} kg`:'Not specified'],['Material rate',p.metal?`${inr(data.metals.find(m=>m.name===p.metal)?.rate||0)} / kg`:'Not specified'],['Making charge',p.makingCharge?inr(p.makingCharge):'Included in listed price'],['Stock',stockText],...Object.entries(specs).filter(([k])=>k!=='dimensions').map(([k,v])=>[k,v])].map(([label,value])=><div key={label}><span>{label}</span><b>{String(value)}</b></div>)}</div><p className="delivery-note"><ShieldCheck size={16}/> Final delivery timing and shipping charges are confirmed with your order.</p></div></div>
      <ProductReviews key={p.id} productId={p.id} customer={customerAuth} onSignIn={()=>startCustomerAuth({type:'none'})}/>
      <ProductSuggestions title="Related products" products={relatedProducts} data={data} onSelect={openProduct}/>
      <ProductSuggestions title="Recently viewed" products={recentProducts} data={data} onSelect={openProduct}/>
    </main>})()}

    {page==='cart'&&customerAuth&&<main className="container page-body"><div className="page-title"><span className="eyebrow dark">YOUR SELECTION</span><h1>Shopping cart & checkout</h1><p>Confirm quantities and enter your delivery information.</p></div>
      {!cartLines.length?<div className="empty-state"><ShoppingCart size={46}/><h2>Your cart is empty</h2><p>Explore the catalog to add products.</p><button className="btn primary" onClick={()=>go('shop')}>Browse products</button></div>:
      <div className="checkout-layout"><div>
        <div className="panel cart-items-panel"><h2>Items in your cart <span className="cart-item-count">{itemCount} item{itemCount===1?'':'s'}</span></h2>{cartLines.map(({product,quantity,price})=><div className="cart-line" key={product.id}>
          <div className="cart-thumb"><ProductArt product={product} size={70}/></div><div className="cart-line-main"><h3>{product.name}</h3><p>{product.metal}</p><b>{inr(price)}</b><div className="quantity-controls"><button onClick={()=>changeQty(product.id,-1)} aria-label="Decrease quantity"><Minus size={14}/></button>{quantity}<button onClick={()=>changeQty(product.id,1)} aria-label="Increase quantity"><Plus size={14}/></button></div><div className="cart-item-actions"><button onClick={()=>{setSavedForLater(old=>old.some(x=>x.id===product.id)?old:[...old,{id:product.id,quantity}]);setCart(old=>old.filter(x=>x.id!==product.id));}}>Save for later</button><button className="danger" onClick={()=>setCart(x=>x.filter(l=>l.id!==product.id))}>Remove</button><button className="bulk-cart-link" onClick={()=>openQuote(product.id,'bulk',Math.max(bulkMinimum,quantity))}>Request bulk price</button></div></div>
          <div className="cart-line-end"><strong>{inr(price*quantity)}</strong></div>
        </div>)}</div>
        {!!savedForLater.length&&<div className="panel saved-cart-panel"><h2>Saved for later ({savedForLater.length})</h2>{savedForLater.map(line=>{const product=data.products.find(p=>p.id===line.id);if(!product)return null;return <div className="cart-line" key={line.id}><div className="cart-thumb"><ProductArt product={product} size={60}/></div><div className="cart-line-main"><h3>{product.name}</h3><b>{inr(productPrice(product,data))}</b><div className="cart-item-actions"><button onClick={()=>{setCart(old=>old.some(x=>x.id===line.id)?old:old.concat(line));setSavedForLater(old=>old.filter(x=>x.id!==line.id));}}>Move to cart</button><button className="danger" onClick={()=>setSavedForLater(old=>old.filter(x=>x.id!==line.id))}>Remove</button></div></div></div>})}</div>}
        <form id="checkout-form" className="panel form" onSubmit={checkout}><h2>Delivery details</h2><fieldset disabled={submitting} className="checkout-fields">
          {!!savedAddresses.length&&<label>Use a saved delivery address<select value="" onChange={e=>{const address=savedAddresses[Number(e.target.value)];if(address)setContact(old=>({...old,name:address.name,phone:address.phone,address:address.address,landmark:address.landmark||'',pin:address.pin}))}}><option value="">Choose saved address</option>{savedAddresses.map((address,index)=><option value={index} key={`${address.phone}-${address.pin}-${index}`}>{address.name} · {address.address}{address.landmark?` · ${address.landmark}`:''}, {address.pin}</option>)}</select></label>}
          <div className="form-grid"><label>Full name *<input required value={contact.name} onChange={e=>setContact(x=>({...x,name:e.target.value}))} placeholder="Customer or company name"/></label><label>Phone number *<input required type="tel" value={contact.phone} onChange={e=>setContact(x=>({...x,phone:e.target.value}))} placeholder="10-digit mobile number"/></label></div>
          <div className="location-action"><button type="button" className="btn outline" onClick={useCurrentLocation} disabled={locating}><MapPin size={16}/>{locating?'Finding location…':'Use current location'}</button><small>Your coordinates go to OpenStreetMap to find the address. Please verify it before ordering.</small></div>
          <label>Delivery address *<textarea rows={3} required value={contact.address} onChange={e=>setContact(x=>({...x,address:e.target.value}))} placeholder="Street, area, city and state" autoComplete="street-address"/></label>
          <label>Landmark (optional)<input value={contact.landmark} onChange={e=>setContact(x=>({...x,landmark:e.target.value}))} placeholder="Nearby shop, school or landmark" autoComplete="address-line2"/></label>
          <label>Delivery PIN code *<input required inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" autoComplete="postal-code" value={contact.pin} onChange={e=>setContact(x=>({...x,pin:e.target.value}))} placeholder="6-digit PIN code"/></label>
          <label>Order specifications / notes<textarea rows={3} value={contact.notes} onChange={e=>setContact(x=>({...x,notes:e.target.value}))} placeholder="Any measurements, quantities or instructions"/></label>
          <h3>Payment option</h3><div className="payment-options">{shop.cod&&<label><input type="radio" name="payment" checked={payment==='Cash on delivery'} onChange={()=>setPayment('Cash on delivery')}/> Cash on delivery (COD)</label>}<label><input type="radio" name="payment" checked={payment==='Razorpay'} onChange={()=>setPayment('Razorpay')}/> Online payment with Razorpay</label><label><input type="radio" name="payment" checked={payment==='Manual UPI'} onChange={()=>setPayment('Manual UPI')}/> Manual UPI transfer (staff confirms)</label></div>
          {payment==='Razorpay'&&<p className="inline-note">Pay securely by card, UPI or net banking through Razorpay Checkout. Payment is verified before your order is confirmed.</p>}
          {payment==='Manual UPI'&&<p className="inline-note">{shop.upi?<>UPI ID: <b>{shop.upi}</b>. Make a transfer only after the business confirms your order.</>:'UPI details will be provided by staff.'} This is not an integrated payment gateway.</p>}
          </fieldset>
        </form>
      </div><aside className="panel summary-panel"><h2>Price details</h2><div><span>Price ({itemCount} item{itemCount===1?'':'s'})</span><b>{inr(subtotal)}</b></div><div><span>{promotion.label || 'Discount'}</span><b className="discount-value">− {inr(promotion.discount)}</b></div><div><span>Delivery charges</span><b className={!delivery.pending&&delivery.amount===0?'free-delivery':undefined}>
        {delivery.amount>0?inr(delivery.amount):delivery.pending?'To be confirmed':'FREE'}
      </b></div>
      {delivery.pending&&delivery.amount>0&&<small>Delivery charges for some items are still to be confirmed.</small>}{+shop.tax>0&&<div><span>GST ({shop.tax}%)</span><b>{inr(tax)}</b></div>}<div className="summary-total"><span>{delivery.pending?'Total so far':'Total amount'}</span><b>{inr(total)}</b></div>{promotion.discount>0&&<div className="savings-badge">You save {inr(promotion.discount)}</div>}
        {shop.promotions?.bulk&&<small>Bulk offer: {shop.promotions.bulk.percent}% off from {shop.promotions.bulk.minUnits} units.</small>}
        <form className="form coupon-form" onSubmit={applyCoupon}>
          <label>Coupon code<input value={couponInput} onChange={e=>setCouponInput(e.target.value)} maxLength={24}/></label>
          <button type="submit" className="btn outline" disabled={submitting}>Apply coupon</button>
          {appliedCoupon&&<button type="button" className="btn outline" disabled={submitting} onClick={()=>{setAppliedCoupon('');setCouponInput('');toast.info('Coupon removed.');}}>Remove coupon</button>}
        </form><small>Estimated production/delivery: {day(deliveryDate(itemCount,data))}</small><button form="checkout-form" className="btn primary full place-order-button" type="submit" disabled={submitting}>{submitting?'Placing order…':'PLACE ORDER'} <ArrowRight size={17}/></button><button className="btn outline full" onClick={()=>go('shop')}>Continue shopping</button></aside></div>}
    </main>}

    {page==='quote'&&<main className="container page-body small-page">
      <div className="page-title">
        <h1>{quote.kind==='bulk'?'Request bulk pricing':'Request a custom quotation'}</h1>
        <p>{quote.kind==='bulk'?'Get a separate price for orders of '+bulkMinimum+' units or more.':'Share your dimensions, requirements and an optional drawing or photo.'}</p>
      </div>
      <form className="panel form quote-form" onSubmit={sendQuote}>
        <fieldset className="checkout-fields" disabled={submitting}>
          <label>Request type
            <select value={quote.kind} onChange={e=>{const kind=e.target.value;setQuote(q=>({...q,kind,
              productId:kind==='bulk'&&q.productId===customDesign?'':q.productId,
              quantity:kind==='bulk'?String(Math.max(bulkMinimum,Number(q.quantity)||0)):q.quantity,
            }));}}>
              <option value="custom">Custom quotation</option>
              <option value="bulk">Bulk pricing</option>
            </select>
          </label>
          <div className="form-grid">
            <label>Product / die design *
              <select required value={quote.productId} onChange={e=>setQuote(q=>({...q,productId:e.target.value}))}>
                <option value="">Select a product</option>
                {data.products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
                {quote.kind==='custom'&&<option value={customDesign}>New custom design</option>}
              </select>
            </label>
            <label>Required quantity *
              <input required type="number" min={quote.kind==='bulk'?bulkMinimum:1} step="1"
                value={quote.quantity} onChange={e=>setQuote(q=>({...q,quantity:e.target.value}))}/>
            </label>
          </div>
          {quote.productId===customDesign&&<label>Design name *<input required value={quote.designName} onChange={e=>setQuote(q=>({...q,designName:e.target.value}))}/></label>}
          <label>Dimensions / material<input value={quote.dimensions} onChange={e=>setQuote(q=>({...q,dimensions:e.target.value}))} placeholder="Example: 20 mm round die, tool steel"/></label>
          <label>{quote.kind==='custom'?'Specifications *':'Order notes'}<textarea required={quote.kind==='custom'} rows={4} value={quote.notes} onChange={e=>setQuote(q=>({...q,notes:e.target.value}))} placeholder="Include finish, tolerance or other requirements."/></label>
          <label>Drawing or photo
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={chooseQuoteFile} aria-describedby="quote-file-help"/>
            <small id="quote-file-help">Optional. One PDF, PNG or JPEG, up to 3 MB.</small>
          </label>
          {fileError&&<p className="danger" role="alert">{fileError}</p>}
          <div className="form-grid">
            <label>Name / business *<input required value={quote.name} onChange={e=>setQuote(q=>({...q,name:e.target.value}))}/></label>
            <label>Mobile number *<input required type="tel" value={quote.phone} onChange={e=>setQuote(q=>({...q,phone:e.target.value}))}/></label>
          </div>
          <label>Delivery location<input value={quote.address} onChange={e=>setQuote(q=>({...q,address:e.target.value}))}/></label>
          <button className="btn primary" type="submit" disabled={!!fileError}>{submitting?'Sending…':quote.kind==='bulk'?'Request bulk price':'Submit quotation request'} <ArrowRight size={17}/></button>
        </fieldset>
      </form>
    </main>}

    {page==='history'&&<main className="container page-body small-page">
      <div className="page-title"><span className="eyebrow dark">YOUR PURCHASES</span><h1>Order history</h1><p>See order dates, totals and current status using your order mobile number.</p><button className="btn outline" onClick={()=>go('orders')}>Track an order by ID <ArrowRight size={16}/></button></div>
      <div className="panel form"><label>Mobile number<input type="tel" autoComplete="tel" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="10-digit mobile number"/></label>
        {!validPhone(lookup)&&<p className="inline-note">Enter the mobile number used at checkout to view your orders.</p>}
      </div>
      {validPhone(lookup)&&historyOrders.length===0&&<div className="empty-state"><ClipboardList size={42}/><h3>No order history found</h3><p>Check the mobile number you used at checkout.</p></div>}
      {historyOrders.map(order=><article className="panel order-card history-order-card" key={order.id}>
        <div className="order-top"><div><span className="muted">{order.type==='order'?'Order':'Quotation'} · {day(order.createdAt)}</span><h3 className="history-order-id">#{order.id}<button type="button" className="copy-order-id" onClick={()=>copyOrderId(order.id)} aria-label={`Copy order ID ${order.id}`} title="Copy order ID"><Copy size={15}/></button></h3></div><span className={`tag ${order.status==='Delivered'?'good':''}`}>{order.status}</span></div>
        <div className="history-order-summary"><div>{order.items.map((item,index)=><p key={`${item.productId||item.name}-${index}`}>{item.name} × {item.qty}</p>)}</div><strong>{order.type==='order'?inr(order.total):order.quotedAmount?inr(order.quotedAmount):'Quotation pending'}</strong></div>
        {order.type==='order'&&<p className="muted">Expected delivery: {day(order.deliveryDate)}</p>}
        <button className="btn outline" onClick={()=>{setLookup(order.customer.phone);setLookupReference(order.id);go('orders');}}>Track this order <ArrowRight size={16}/></button>
      </article>)}
    </main>}

    {page==='orders'&&<main className="container page-body small-page">
      <div className="page-title"><span className="eyebrow dark">ORDER SUPPORT</span><h1>Track an order</h1><p>Enter the mobile number and order ID to view the matching order and its latest status.</p></div>
      <div className="panel form">
        <div className="form-grid">
          <label>Mobile number *<input type="tel" autoComplete="tel" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="10-digit mobile number"/></label>
          <label>Order ID *<input value={lookupReference} onChange={e=>setLookupReference(e.target.value)} placeholder="Example: ORD-…"/></label>
        </div>
        <p className="inline-note">Enter both details to retrieve the order. Your order status and items will appear below.</p>
      </div>
      {validPhone(lookup)&&reference&&!foundOrders.length&&<div className="empty-state"><ClipboardList size={42}/><h3>No matching order</h3><p>Check the mobile number and order ID, then try again.</p></div>}
      {foundOrders.map(order=>{
        const isOrder=order.type==='order';
        const step=orderSteps.indexOf(order.status);
        const reviewableItems=[...new Map(order.items.filter(item=>item.productId &&
          data.products.some(product=>product.id===item.productId)).map(item=>[item.productId,item])).values()];
        return <article className="panel order-card" key={order.id}>
          <div className="order-top">
            <div><span className="muted">{isOrder?'Order':order.quoteKind==='bulk'?'Bulk pricing request':'Quotation request'} · {day(order.createdAt)}</span>
              <h3>#{order.id}</h3></div>
            <span className={`tag ${order.status==='Delivered'?'good':''}`}>{order.status}</span>
          </div>
          {isOrder&&step>=0&&<ol className="order-progress" aria-label="Order progress" style={{'--order-step':step}}>
            {orderSteps.map((label,index)=><li key={label} className={index<step?'reached':''}
              aria-current={index===step?'step':undefined}>{index===step&&<Truck className="order-progress-truck" size={16} aria-hidden="true"/>}{label}</li>)}
          </ol>}
          {order.items.map((item,index)=><p key={index}>{item.name} × {item.qty}</p>)}
          {order.notes&&<p className="muted">{order.notes}</p>}
          <div className="order-bottom">
            <div>{isOrder?<><strong>{inr(order.total)}</strong>
              <p>{order.status==='Cancelled'?'Delivery cancelled':order.status==='Delivered'?'Delivered':
                'Expected delivery: '+day(order.deliveryDate)} · {order.payment?.status || 'Unpaid'}</p></>:
              order.quotedAmount?<><strong>{inr(order.quotedAmount)}</strong><p>Quoted total</p></>:<p>Awaiting pricing</p>}</div>
          </div>
          <div className="tracking-actions">
            {isOrder&&<><button className="btn outline" onClick={()=>downloadInvoice(order,shop)}><FileText size={16}/> Download invoice</button>
              <button className="btn outline" onClick={()=>printInvoice(order,shop)}>Print / Save PDF</button></>}
            {validPhone(shop.phone)&&<a className="btn outline"
              href={whatsappUrl(shop.phone,'Hello, I need help with '+(isOrder?'order ':'quotation ')+order.id+'.')}
              target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp support</a>}
          </div>
          {isOrder&&order.status==='Delivered'&&<>
            <div className="rating-row">Rate your order experience: {[1,2,3,4,5].map(n=>
              <button key={n} className="unstyled" onClick={()=>rate(order.id,n)} aria-label={n+' stars'} aria-pressed={n===order.rating}>
                <Star size={22} fill={n<=order.rating?'#e5a93a':'none'} color={n<=order.rating?'#e5a93a':'#a2a7ad'}/>
              </button>)}</div>
            {reviewableItems.length>0&&<ReviewForm order={order} items={reviewableItems}/>}
          </>}
        </article>;
      })}
    </main>}

    {page==='profile'&&<main className="container page-body small-page"><div className="page-title"><span className="eyebrow dark">YOUR ACCOUNT</span><h1>Profile</h1><p>Manage your customer account and saved delivery details.</p></div><section className="panel profile-account-card">{customerAuth?<><div><h2>{customerAuth.name}</h2><p>{customerAuth.phone}</p></div><button className="btn outline" onClick={logoutCustomer}>Log out</button></>:<><div><h2>Sign in to your account</h2><p>Log in or create an account to add products to your cart.</p></div><button className="btn primary" onClick={()=>startCustomerAuth({type:'none'})}>Log in / Sign up</button></>}</section>{savedAddresses.length?<><section className="panel"><h2>Saved delivery addresses</h2>{savedAddresses.map((address,index)=><article className="profile-address" key={`${address.phone}-${address.pin}-${index}`}>
      {editingAddressIndex===index&&addressDraft?<form className="profile-address-edit form" onSubmit={saveEditedAddress}>
        <label>Full name *<input required value={addressDraft.name||''} onChange={e=>setAddressDraft(old=>({...old,name:e.target.value}))}/></label>
        <label>Phone number *<input required type="tel" value={addressDraft.phone||''} onChange={e=>setAddressDraft(old=>({...old,phone:e.target.value}))}/></label>
        <label>Delivery address *<textarea required rows={3} value={addressDraft.address||''} onChange={e=>setAddressDraft(old=>({...old,address:e.target.value}))}/></label>
        <label>Landmark (optional)<input value={addressDraft.landmark||''} onChange={e=>setAddressDraft(old=>({...old,landmark:e.target.value}))} placeholder="Nearby shop, school or landmark"/></label>
        <label>PIN code *<input required inputMode="numeric" maxLength={6} value={addressDraft.pin||''} onChange={e=>setAddressDraft(old=>({...old,pin:e.target.value}))}/></label>
        <div className="profile-address-actions"><button className="btn primary" type="submit">Save changes</button><button className="btn outline" type="button" onClick={()=>{setEditingAddressIndex(null);setAddressDraft(null);setNotice('');}}>Cancel</button></div>
      </form>:<><div><strong>{address.name}</strong><span>{address.phone}</span><p>{address.address}{address.landmark?` · Landmark: ${address.landmark}`:''}, {address.pin}</p></div><div className="profile-address-actions"><button className="btn outline" onClick={()=>editSavedAddress(index)}>Edit address</button><button className="btn outline" onClick={()=>{setContact(old=>({...old,name:address.name,phone:address.phone,address:address.address,landmark:address.landmark||'',pin:address.pin}));go('cart');}}>Use at checkout</button></div></>}
    </article>)}</section><button className="btn outline" onClick={()=>{setLookup(savedAddresses[0].phone);go('orders');}}>Track an order</button></>:<section className="panel empty-minor"><UserRound size={32}/><h2>No saved delivery address yet</h2><p>Complete a checkout to save your delivery details here.</p><button className="btn primary" onClick={()=>go('products')}>Browse products</button></section>}</main>}

    {page==='success'&&success&&<main className="container page-body small-page">
      <div className="panel success-panel">
        <CheckCircle2 size={58} color="#228657"/>
        <h1>{success.type==='order'?'Order placed':success.quoteKind==='bulk'?'Bulk pricing request sent':'Quotation request sent'}</h1>
        <strong className="order-id">{success.id}</strong>
        <div className="confirmation-details">
          {success.items.map(item=><div key={item.productId??item.name}>
            <span>{item.name} × {item.qty}</span>
            {success.type==='order'&&<b>{inr(item.subtotal)}</b>}
          </div>)}
          {success.type==='order'?<>
            <div><span>Items subtotal</span><b>{inr(success.subtotal)}</b></div>
            {success.discount>0&&<div><span>{success.discountLabel}</span><b>− {inr(success.discount)}</b></div>}
            <div><span>GST ({success.taxRate}%)</span><b>{inr(success.tax)}</b></div>
            <div><span>Delivery charges</span><b>{success.deliveryCharge>0?inr(success.deliveryCharge):success.deliveryChargePending?'To be confirmed':'Free'}</b></div>
            {success.deliveryChargePending&&success.deliveryCharge>0&&<div><span>Remaining delivery charges</span><b>To be confirmed</b></div>}
            <div><span>{success.deliveryChargePending?'Total so far':'Total including GST & delivery'}</span><b>{inr(success.total)}</b></div>
            <div><span>Delivery address</span><b>{success.customer.address}</b></div>
            {success.customer.landmark&&<div><span>Landmark</span><b>{success.customer.landmark}</b></div>}
            <div><span>Estimated delivery</span><b>{day(success.deliveryDate)}</b></div>
            <div><span>Payment</span><b>{success.payment.method} · {success.payment.status}</b></div>
          </>:success.attachment&&<div><span>Attachment received</span><b>{success.attachment.name}</b></div>}
        </div>
        <div className="action-row">
          <button className="btn primary" onClick={()=>go('orders')}>Track status <ArrowRight size={16}/></button>
          {success.type==='order'&&<button className="btn outline" onClick={()=>printInvoice(success,shop)}><FileText size={16}/> Invoice</button>}
        </div>
      </div>
    </main>}

    {page==='about'&&<main className="container page-body small-page"><div className="page-title"><span className="eyebrow dark">ABOUT OUR WORKSHOP</span><h1>{shop.name}</h1><p>{shop.tagline}</p></div><div className="panel about-panel"><Layers3 size={45} color="#bd6b34"/><h2>Industrial precision, made to order</h2><p>Explore a catalog of metal dies and nakas, request customized specifications, and follow your order through production and delivery.</p><hr/><p><Phone size={17}/>{shop.phone||'Phone not yet configured'}</p><p><Mail size={17}/>{shop.address}</p>{shop.phone&&<a className="btn primary" target="_blank" rel="noreferrer" href={whatsappUrl(shop.phone,'Hello, I would like to enquire about your products.')}><MessageCircle size={17}/> Enquire on WhatsApp</a>}</div></main>}

    {page==='contact'&&<main className="container page-body small-page">
      <div className="page-title"><h1>Contact & policies</h1></div>
      <section className="panel contact-details">
        <h2>{shop.name}</h2>
        {shop.address&&<p>{shop.address}</p>}
        {shop.gstin&&<p>GSTIN {shop.gstin}</p>}
        {shop.email&&<p><a href={'mailto:'+shop.email}>{shop.email}</a></p>}
        {shop.phone&&<p><a href={'tel:'+phoneNumber(shop.phone)}>{shop.phone}</a></p>}
        {validPhone(shop.phone)&&<a className="btn outline" href={whatsappUrl(shop.phone,'Hello, I have a question.')} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>}
      </section>
      {[['Shipping policy',shop.shippingPolicy],['Return policy',shop.returnPolicy],['FAQ',shop.faq]].filter(([,content])=>content?.trim()).map(([title,content])=><section key={title} className="panel business-policy">
        <h2>{title}</h2><p>{content}</p>
      </section>)}
    </main>}

    <footer className="footer"><div className="container footer-grid"><div><div className="brand footer-brand"><img src="/icon-192.png" alt={shop.name} className="brand-mark" width="42" height="42" /><span><strong>{shop.name}</strong><small>{shop.tagline}</small></span></div><p>Industrial dies, nakas and metalwork products.</p></div><div><h4>Quick links</h4><button onClick={()=>go('shop')}>Products</button><button onClick={()=>go('quote')}>Custom quotation</button><button onClick={()=>go('orders')}>Track order</button><button onClick={()=>go('contact')}>Contact & policies</button></div><div><h4>Contact</h4><p>{shop.address}</p><p>{shop.phone||'Phone not configured'}</p><a href="/staff/">Staff demo</a></div></div><div className="container footer-bottom">© {new Date().getFullYear()} {shop.name} • React frontend demo, not a live payment website.</div></footer>
    <a className="whatsapp-float" href={validPhone(shop.phone)?whatsappUrl(shop.phone,'Hello, I would like to enquire about your products.'):`https://wa.me/?text=${encodeURIComponent('Hello, I would like to enquire about your products.')}`} target="_blank" rel="noreferrer" aria-label={`Open WhatsApp chat with ${shop.name}`} title="Chat on WhatsApp"><MessageCircle size={25}/></a>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <button className={['products','shop','product'].includes(page)?'active':''} onClick={()=>go('products')}><PackageCheck size={20}/><span>Products</span></button>
      <button className={page==='history'?'active':''} onClick={()=>{if(savedAddresses.length&&!lookup)setLookup(savedAddresses[0].phone);go('history');}}><History size={20}/><span>Order history</span></button>
      <button className={page==='orders'?'active':''} onClick={()=>{if(savedAddresses.length&&!lookup)setLookup(savedAddresses[0].phone);go('orders');}}><ClipboardList size={20}/><span>Track order</span></button>
      <button className={page==='profile'?'active':''} onClick={()=>go('profile')}><UserRound size={20}/><span>Profile</span></button>
      <button className={customerAuth?'auth-logout':'auth-login'} onClick={()=>customerAuth?logoutCustomer():startCustomerAuth({type:'none'})} aria-label={customerAuth?'Log out':'Log in'} title={customerAuth?'Log out':'Log in'}>{customerAuth?<LogOut size={20}/>:<LogIn size={20}/>}<span>{customerAuth?'Logout':'Login'}</span></button>
    </nav>
    {authOpen&&<div className="customer-auth-backdrop" role="presentation"><section className="customer-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-auth-title">
      <button type="button" className="customer-auth-close" onClick={()=>{setAuthOpen(false);setPendingAuthAction(null);setAuthError('');}} aria-label="Close sign in"><X size={20}/></button>
      <span className="eyebrow dark">CUSTOMER ACCOUNT</span><h2 id="customer-auth-title">{authMode==='signup'?'Create your account':'Welcome back'}</h2>
      <p>{authMode==='signup'?'Sign up to add products to your cart and checkout.':'Log in to continue to your cart.'}</p>
      <form className="form customer-auth-form" onSubmit={submitCustomerAuth}>
        {authMode==='signup'&&<label>Full name *<input required maxLength={120} autoComplete="name" value={authForm.name} onChange={e=>setAuthForm(old=>({...old,name:e.target.value}))}/></label>}
        <label>Mobile number *<input required type="tel" autoComplete="tel" value={authForm.phone} onChange={e=>setAuthForm(old=>({...old,phone:e.target.value}))} placeholder="10-digit Indian mobile number"/></label>
        <label>Password *<input required type="password" minLength={authMode==='signup'?8:1} maxLength={128} autoComplete={authMode==='signup'?'new-password':'current-password'} value={authForm.password} onChange={e=>setAuthForm(old=>({...old,password:e.target.value}))} placeholder={authMode==='signup'?'At least 8 characters':''}/></label>
        {authError&&<p className="customer-auth-error" role="alert">{authError}</p>}
        <button className="btn primary full" type="submit" disabled={authBusy||!authChecked}>{authBusy?'Please wait…':authMode==='signup'?'Create account':'Log in'}</button>
      </form>
      <p className="customer-auth-switch">{authMode==='signup'?'Already have an account?':'New customer?'} <button type="button" onClick={()=>{setAuthMode(authMode==='signup'?'login':'signup');setAuthError('');}}>{authMode==='signup'?'Log in':'Sign up'}</button></p>
    </section></div>}
  </div>;
}
