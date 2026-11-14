import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { day, readAttachment } from '../lib/utils.jsx';
import { toast } from 'react-toastify';
import { apiUrl } from '../lib/api.js';

export function ProductReviews({ productId, customer, onSignIn }) {
  const [result,setResult]=useState(null);
  const [error,setError]=useState(false);
  const [rating,setRating]=useState(0);
  const [comment,setComment]=useState('');
  const [sending,setSending]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(apiUrl('/api/products/'+encodeURIComponent(productId)+'/reviews'),{signal:controller.signal})
      .then(response=>{
        if(!response.ok) throw new Error('Reviews unavailable');
        return response.json();
      })
      .then(setResult)
      .catch(error=>{if(error.name!=='AbortError')setError(true);});
    return ()=>controller.abort();
  },[productId]);
  async function submit(event){
    event.preventDefault();
    if(!rating){toast.error('Choose a star rating first.');return;}
    if(!comment.trim()){toast.error('Write a short review before submitting.');return;}
    setSending(true);
    try{
      const response=await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/reviews`),{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({rating,comment:comment.trim()}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Could not publish your review.');
      setRating(0);setComment('');
      const updated=await fetch(apiUrl('/api/products/'+encodeURIComponent(productId)+'/reviews'),{cache:'no-store'});
      if(updated.ok)setResult(await updated.json());
      toast.success('Your review and star rating were published.');
    }catch(error){toast.error(error.message||'Could not publish your review.');}
    finally{setSending(false);}
  }
  return <section className="panel product-reviews">
    <h2>Customer reviews</h2>
    <div className="product-review-compose">
      {customer?<form className="form" onSubmit={submit}>
        <label>Your rating</label>
        <div className="review-star-picker" role="group" aria-label="Choose a star rating">
          {[1,2,3,4,5].map(value=><button type="button" key={value} onClick={()=>setRating(value)} aria-label={`${value} star${value===1?'':'s'}`} aria-pressed={rating===value}>
            <Star size={25} fill={value<=rating?'#e5a93a':'none'} color={value<=rating?'#e5a93a':'#9aa5b1'}/>
          </button>)}
          {rating>0&&<span>{rating} / 5</span>}
        </div>
        <label>Share your experience<textarea required rows={3} maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder="What did you think about this product?"/></label>
        <button className="btn primary" type="submit" disabled={sending}>{sending?'Publishing…':'Submit review'}</button>
      </form>:<div className="review-signin-prompt"><span>Purchased this product? Sign in to leave a star rating and review.</span><button className="btn outline" type="button" onClick={onSignIn}>Log in / Sign up</button></div>}
    </div>
    {error?<p role="status">Reviews are currently unavailable.</p>:!result?<p>Loading reviews…</p>:
      !result.count?<p>No reviews yet.</p>:<>
        <p><strong>{result.average.toFixed(1)} / 5</strong> · {result.count} {result.count===1?'review':'reviews'}</p>
        {result.reviews.map(review=><article key={review.id} className="product-review">
          <strong>{review.rating} / 5 stars</strong> <small>· {review.customerName||'Verified customer'} · {day(review.createdAt)}</small>
          <p>{review.comment}</p>
          {review.hasPhoto&&<a href={apiUrl('/api/reviews/'+review.id+'/photo')} target="_blank" rel="noreferrer">
            <img src={apiUrl('/api/reviews/'+review.id+'/photo')} loading="lazy" alt="Product photo submitted by a customer"/>
          </a>}
        </article>)}
      </>}
  </section>;
}

export function ReviewForm({ order, items }) {
  const [open,setOpen]=useState(false);
  const [productId,setProductId]=useState(items[0].productId);
  const [rating,setRating]=useState('');
  const [comment,setComment]=useState('');
  const [photo,setPhoto]=useState(null);
  const [sending,setSending]=useState(false);
  const lock=useRef(false);

  async function submit(event) {
    event.preventDefault();
    if(lock.current) return;
    if(!comment.trim()) {toast.error('Write a short review before submitting.');return;}
    if(photo&&(!['image/jpeg','image/png'].includes(photo.type)||photo.size>3*1024*1024||!photo.size)) {
      toast.error('Choose a PNG or JPEG photo up to 3 MB.');
      return;
    }
    lock.current=true;
    setSending(true);
    try {
      const response=await fetch(apiUrl('/api/reviews'),{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({orderId:order.id,phone:order.customer.phone,productId,rating:Number(rating),
          comment:comment.trim(),photo:photo ? await readAttachment(photo) : null}),
      });
      if(!response.ok) {
        const body=await response.json().catch(()=>null);
        throw new Error(body?.error || 'Could not post the review. Try again.');
      }
      setOpen(false);
      setRating('');
      setComment('');
      setPhoto(null);
      toast.success('Review published.');
    } catch(error) {
      toast.error(error.message);
    } finally {
      lock.current=false;
      setSending(false);
    }
  }

  return <div className="review-entry">
    <button className="btn outline" type="button" aria-expanded={open} onClick={()=>{
      setOpen(value=>!value);setPhoto(null);
    }} disabled={sending}>{open?'Close review form':'Write a product review'}</button>
    {open&&<form className="form" onSubmit={submit}>
      <fieldset className="checkout-fields" disabled={sending}>
        <div className="form-grid">
          <label>Product<select value={productId} onChange={e=>setProductId(e.target.value)}>
            {items.map(item=><option key={item.productId} value={item.productId}>{item.name}</option>)}
          </select></label>
          <label>Rating<select required value={rating} onChange={e=>setRating(e.target.value)}>
            <option value="">Choose a rating</option>
            {[5,4,3,2,1].map(value=><option key={value} value={value}>{value} / 5</option>)}
          </select></label>
        </div>
        <label>Review<textarea required rows={3} maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label>
        <label>Public product photo (optional, PNG or JPEG up to 3 MB)
          <input type="file" accept="image/png,image/jpeg" onChange={e=>setPhoto(e.target.files[0] ?? null)}/>
        </label>
        <button className="btn primary" type="submit">{sending?'Publishing…':'Publish review'}</button>
      </fieldset>
    </form>}
  </div>;
}
