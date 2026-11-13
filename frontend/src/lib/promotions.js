export function cartPromotion(subtotal, itemCount, promotions, couponCode) {
  const code = couponCode.trim().toUpperCase();
  const coupon = promotions?.coupon;
  const bulk = promotions?.bulk;
  const couponRate = coupon?.code && code === coupon.code ? validPercent(coupon.percent) : 0;
  const bulkRate = bulk?.minUnits > 0 && itemCount >= bulk.minUnits ? validPercent(bulk.percent) : 0;
  const useCoupon = couponRate > 0 && couponRate >= bulkRate;
  const rate = useCoupon ? couponRate : bulkRate;
  return {
    discount: Math.round(subtotal * rate) / 100,
    couponCode: useCoupon ? code : '',
    label: useCoupon ? 'Coupon ' + code : bulkRate > 0 ? 'Bulk discount' : '',
  };
}

function validPercent(value) {
  const rate=Number(value);
  return rate>0 && rate<=100 ? rate : 0;
}
