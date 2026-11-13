export function cartDeliveryCharges(lines) {
  let totalPaise=0;
  let pending=false;
  for(const {product,quantity} of lines) {
    const value=product.deliveryCharge;
    const rate=Number(value);
    if(value==null || value==='' || !Number.isFinite(rate) || rate<0) {
      pending=true;
    } else {
      totalPaise+=Math.round(rate*100)*quantity;
    }
  }
  return {amount:totalPaise/100,pending};
}
