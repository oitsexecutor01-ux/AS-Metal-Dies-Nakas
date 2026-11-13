import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const app = express();
const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const mongoUri = process.env.MONGODB_URI;

const stateSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, versionKey: false });
const CommerceState = mongoose.model('CommerceState', stateSchema);
const customerAccountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, unique: true, index: true },
  salt: { type: String, required: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true, versionKey: false });
const CustomerAccount = mongoose.model('CustomerAccount', customerAccountSchema);
const customerSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { versionKey: false });
const CustomerSession = mongoose.model('CustomerSession', customerSessionSchema);
const pendingPaymentSchema = new mongoose.Schema({
  razorpayOrderId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'INR' },
  status: { type: String, required: true, default: 'created' },
  paymentId: String,
  order: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, versionKey: false });
const PendingPayment = mongoose.model('PendingPayment', pendingPaymentSchema);
const QuoteAttachment = mongoose.model('QuoteAttachment', new mongoose.Schema({ name: String, contentType: String, bytes: Buffer }));
const attachmentTypes = {
  'application/pdf': { extension: 'pdf', signature: Buffer.from('%PDF-') },
  'image/png': { extension: 'png', signature: Buffer.from('89504e470d0a1a0a', 'hex') },
  'image/jpeg': { extension: 'jpg', signature: Buffer.from('ffd8ff', 'hex') },
};
const reviewSchema = new mongoose.Schema({
  orderId: String, productId: String, customerName: String, rating: Number, comment: String,
  photo: { contentType: String, bytes: Buffer },
}, { timestamps: true });
reviewSchema.index({ orderId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, createdAt: -1 });
const ProductReview = mongoose.model('ProductReview', reviewSchema);
const normalizePhone = value => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 10 ? '91' + digits : digits;
};
const sessionCookie = 'as_customer_session';
const hashToken = token => createHash('sha256').update(token).digest('hex');
function getCookie(req, name) {
  const entry = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}
function writeSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
async function createCustomerSession(customer, res) {
  const token = randomBytes(32).toString('base64url');
  await CustomerSession.create({ tokenHash: hashToken(token), customerId: customer._id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
  writeSessionCookie(res, token);
}
async function currentCustomer(req) {
  const token = getCookie(req, sessionCookie);
  if (!token) return null;
  const session = await CustomerSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  return session ? CustomerAccount.findById(session.customerId).select('name phone').lean() : null;
}
function productUnitPrice(product, data) {
  if (+product.fixedPrice > 0) return +product.fixedPrice;
  const rate = +(data.metals.find(metal => metal.name === product.metal)?.rate || 0);
  return Math.max(0, Math.round(rate * (+product.weight || 0) + (+product.makingCharge || 0)));
}
function validPercent(value) {
  const rate = Number(value);
  return rate > 0 && rate <= 100 ? rate : 0;
}
function checkoutTotals(lines, data, couponCode) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const coupon = data.shop.promotions?.coupon;
  const bulk = data.shop.promotions?.bulk;
  const couponRate = coupon?.code && couponCode === coupon.code ? validPercent(coupon.percent) : 0;
  const bulkRate = bulk?.minUnits > 0 && itemCount >= bulk.minUnits ? validPercent(bulk.percent) : 0;
  const useCoupon = couponRate > 0 && couponRate >= bulkRate;
  const discountRate = useCoupon ? couponRate : bulkRate;
  const discount = Math.round(subtotal * discountRate) / 100;
  const tax = Math.round((subtotal - discount) * (+data.shop.tax || 0)) / 100;
  let deliveryPaise = 0;
  let deliveryPending = false;
  for (const line of lines) {
    const charge = line.product.deliveryCharge;
    const rate = Number(charge);
    if (charge == null || charge === '' || !Number.isFinite(rate) || rate < 0) deliveryPending = true;
    else deliveryPaise += Math.round(rate * 100) * line.quantity;
  }
  const deliveryCharge = deliveryPaise / 100;
  const total = Math.round((subtotal - discount + tax + deliveryCharge) * 100) / 100;
  const label = useCoupon ? `Coupon ${couponCode}` : bulkRate > 0 ? 'Bulk discount' : '';
  return { subtotal, itemCount, discount, discountLabel: label, couponCode: useCoupon ? couponCode : '',
    tax, taxRate: +data.shop.tax || 0, deliveryCharge, deliveryChargePending: deliveryPending, total };
}
function deliveryDateFor(quantity, data) {
  const rules = [...(data.deliveryRules || [])].sort((a, b) => a[0] - b[0]);
  const days = rules.find(([threshold]) => quantity <= threshold)?.[1] || Math.max(14, rules.at(-1)?.[1] || 14);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
async function razorpayRequest(path, method, payload) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw Object.assign(new Error('Online payments are not configured. Add Razorpay test keys to backend/.env.'), { status: 503 });
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error?.description || 'Razorpay could not process this payment.'), { status: 502 });
  return result;
}

app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.post('/api/customer/signup', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const phone = normalizePhone(req.body?.phone);
    const password = req.body?.password;
    if (!name || name.length > 120 || !/^91\d{10}$/.test(phone) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Enter your name, a valid Indian mobile number, and a password of 8 to 128 characters.' });
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
    const customer = await CustomerAccount.create({ name, phone, salt, passwordHash });
    await createCustomerSession(customer, res);
    res.set('Cache-Control', 'no-store').status(201).json({ customer: { name: customer.name, phone: customer.phone } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account already uses this mobile number. Log in instead.' });
    next(error);
  }
});
app.post('/api/customer/login', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const password = req.body?.password;
    if (!/^91\d{10}$/.test(phone) || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid mobile number and password.' });
    }
    const account = await CustomerAccount.findOne({ phone });
    const candidate = await scrypt(password, account?.salt || 'invalid-account-salt', 64);
    const stored = account ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(64);
    if (!account || stored.length !== candidate.length || !timingSafeEqual(stored, candidate)) {
      return res.status(401).json({ error: 'Mobile number or password is incorrect.' });
    }
    await createCustomerSession(account, res);
    res.set('Cache-Control', 'no-store').json({ customer: { name: account.name, phone: account.phone } });
  } catch (error) { next(error); }
});
app.get('/api/customer/me', async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ customer: await currentCustomer(req) }); }
  catch (error) { next(error); }
});
app.get('/api/staff/customers', async (_req, res, next) => {
  try {
    const [accounts, record] = await Promise.all([
      CustomerAccount.find().select('name phone createdAt').sort({ createdAt: -1 }).lean(),
      CommerceState.findOne({ key: 'main' }, 'data.orders').lean(),
    ]);
    const orders = record?.data?.orders || [];
    res.set('Cache-Control', 'no-store').json(accounts.map(({ _id, name, phone, createdAt }) => ({
      id: String(_id), name, phone, createdAt,
      orders: orders.filter(order => normalizePhone(order.customer?.phone) === phone),
    })));
  } catch (error) { next(error); }
});
app.post('/api/customer/logout', async (req, res, next) => {
  try {
    const token = getCookie(req, sessionCookie);
    if (token) await CustomerSession.deleteOne({ tokenHash: hashToken(token) });
    clearSessionCookie(res);
    res.sendStatus(204);
  } catch (error) { next(error); }
});
app.post('/api/payments/razorpay/order', async (req, res, next) => {
  try {
    const account = await currentCustomer(req);
    if (!account) return res.status(401).json({ error: 'Log in before starting an online payment.' });
    const { items, customer: details, notes = '', couponCode = '' } = req.body ?? {};
    const phone = normalizePhone(details?.phone);
    if (!Array.isArray(items) || !items.length || items.length > 100 ||
        !details?.name?.trim() || !/^91\d{10}$/.test(phone) || phone !== account.phone ||
        !details?.address?.trim() || !/^[1-9]\d{5}$/.test(String(details?.pin || ''))) {
      return res.status(400).json({ error: 'Check your cart and enter delivery details matching your account mobile number.' });
    }
    const stateRecord = await CommerceState.findOne({ key: 'main' }).lean();
    const data = stateRecord?.data;
    if (!data) return res.status(503).json({ error: 'The product catalog is unavailable.' });
    const lines = [];
    const quantities = new Map();
    for (const item of items) {
      if (typeof item?.id !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ error: 'The cart contains an invalid item quantity.' });
      }
      quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
    }
    for (const [id, quantity] of quantities) {
      const product = data.products.find(entry => entry.id === id);
      if (!product || product.quoteOnly || (product.stock != null && product.stock < quantity)) {
        return res.status(409).json({ error: 'A product is unavailable or its stock changed. Review your cart.' });
      }
      const price = productUnitPrice(product, data);
      lines.push({ product, quantity, price });
    }
    const totals = checkoutTotals(lines, data, String(couponCode).trim().toUpperCase());
    const amount = Math.round(totals.total * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ error: 'The payment total must be at least ₹1.00.' });
    const orderId = `AS-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;
    const commerceOrder = {
      id: orderId, type: 'order', createdAt: new Date().toISOString(),
      customer: { name: details.name.trim(), phone, address: `${details.address.trim()}, PIN ${String(details.pin).trim()}`,
        landmark: String(details.landmark || '').trim(), pin: String(details.pin).trim() },
      items: lines.map(({ product, quantity, price }) => ({ productId: product.id, name: product.name,
        qty: quantity, unitPrice: price, subtotal: price * quantity })),
      notes: String(notes).trim(), ...totals, deliveryDate: deliveryDateFor(totals.itemCount, data),
      status: 'Pending', rating: 0,
      payment: { method: 'Razorpay', status: 'Unpaid', reference: '' },
    };
    const receipt = `AS${Date.now()}${randomBytes(3).toString('hex')}`;
    const razorpayOrder = await razorpayRequest('/orders', 'POST', {
      amount, currency: 'INR', receipt, notes: { commerce_order_id: orderId },
    });
    await PendingPayment.create({ razorpayOrderId: razorpayOrder.id, customerId: account._id,
      amount, currency: 'INR', order: commerceOrder, status: 'created' });
    res.set('Cache-Control', 'no-store').status(201).json({ keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id, amount, currency: 'INR', commerceOrderId: orderId });
  } catch (error) { next(error); }
});
app.post('/api/payments/razorpay/verify', async (req, res, next) => {
  try {
    const account = await currentCustomer(req);
    if (!account) return res.status(401).json({ error: 'Log in again to verify this payment.' });
    const { razorpay_payment_id: paymentId, razorpay_order_id: razorpayOrderId, razorpay_signature: signature } = req.body ?? {};
    if (typeof paymentId !== 'string' || typeof razorpayOrderId !== 'string' ||
        typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) {
      return res.status(400).json({ error: 'Razorpay returned an invalid payment response.' });
    }
    const pending = await PendingPayment.findOne({ razorpayOrderId, customerId: account._id });
    if (!pending) return res.status(404).json({ error: 'Payment order not found for this account.' });
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: 'Razorpay is not configured on the server.' });
    const expectedSignature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${paymentId}`).digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }
    const remotePayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, 'GET');
    if (remotePayment.order_id !== razorpayOrderId || remotePayment.amount !== pending.amount ||
        remotePayment.currency !== pending.currency || remotePayment.status !== 'captured') {
      return res.status(409).json({ error: 'Payment is not captured for the expected order amount.' });
    }
    if (pending.status === 'paid') return res.json({ order: pending.order });
    const locked = await PendingPayment.findOneAndUpdate({ _id: pending._id, status: 'created' },
      { $set: { status: 'processing', paymentId } }, { new: true });
    if (!locked) return res.status(409).json({ error: 'Payment is already being confirmed. Please refresh order history shortly.' });
    try {
      const stateRecord = await CommerceState.findOne({ key: 'main' });
      if (!stateRecord?.data) throw new Error('The commerce catalog is unavailable. Contact the store before trying to pay again.');
      const data = structuredClone(stateRecord.data);
      const order = structuredClone(locked.order);
      order.payment = { method: 'Razorpay', status: 'Paid', reference: paymentId, razorpayOrderId };
      const currentProducts = order.items.map(item => data.products.find(product => product.id === item.productId));
      const stockChanged = order.items.some((item, index) => !currentProducts[index] ||
        (currentProducts[index].stock != null && currentProducts[index].stock < item.qty));
      if (stockChanged) {
        order.status = 'Payment Review';
        order.notes = [order.notes, 'Payment captured; current stock needs staff review.'].filter(Boolean).join('\n');
      } else {
        currentProducts.forEach((product, index) => { if (product.stock != null) product.stock -= order.items[index].qty; });
      }
      const existing = data.orders.find(entry => entry.id === order.id);
      if (!existing) data.orders.unshift(order);
      const customer = order.customer;
      const savedCustomer = data.customers.find(entry => normalizePhone(entry.phone) === customer.phone);
      if (savedCustomer) Object.assign(savedCustomer, customer);
      else data.customers.push({ id: `CUS-${randomBytes(5).toString('hex')}`, ...customer });
      await CommerceState.findOneAndUpdate({ key: 'main' }, { $set: { data } }, { new: true });
      locked.order = order;
      locked.status = 'paid';
      await locked.save();
      res.set('Cache-Control', 'no-store').json({ order });
    } catch (error) {
      await PendingPayment.updateOne({ _id: locked._id, status: 'processing' }, { $set: { status: 'created' } });
      throw error;
    }
  } catch (error) { next(error); }
});

app.get('/api/state', async (_req, res, next) => {
  try {
    const record = await CommerceState.findOne({ key: 'main' }).lean();
    res.json(record?.data ?? null);
  } catch (error) { next(error); }
});
app.post('/api/product-images', async (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return res.status(503).json({ error: 'Cloudinary is not configured. Set its cloud name, API key and API secret in backend/.env.' });
  const { image } = req.body ?? {};
  if (typeof image !== 'string' || !/^data:image\/jpeg;base64,/.test(image) || image.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Choose a JPEG image up to 3 MB.' });
  }
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = `folder=as-commerce/products&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(`${params}${secret}`).digest('hex');
    const body = new FormData();
    body.set('file', image);
    body.set('api_key', key);
    body.set('timestamp', timestamp);
    body.set('folder', 'as-commerce/products');
    body.set('signature', signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: 'POST', body,
    });
    const result = await response.json();
    if (!response.ok || !result.secure_url) {
      console.error('Cloudinary upload failed:', result.error?.message || response.status);
      return res.status(502).json({ error: 'Cloudinary could not store this image. Check your Cloudinary settings and try again.' });
    }
    res.status(201).json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    res.status(502).json({ error: 'Could not reach Cloudinary. Try again.' });
  }
});
app.put('/api/state', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.shop || !Array.isArray(data.products) || !Array.isArray(data.orders)) {
      return res.status(400).json({ error: 'Invalid commerce data.' });
    }
    await CommerceState.findOneAndUpdate({ key: 'main' }, { $set: { data } }, { upsert: true, new: true, runValidators: true });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/quotes', async (req, res, next) => {
  let attachment;
  try {
    const { quote, file } = req.body ?? {};
    const item = quote?.items?.[0];
    if (quote?.type !== 'quote' || typeof quote.id !== 'string' || !Array.isArray(quote.items) ||
        quote.items.length !== 1 || typeof item?.name !== 'string' || !Number.isSafeInteger(item.qty) ||
        item.qty < (quote.quoteKind === 'bulk' ? 10 : 1)) {
      return res.status(400).json({ error: 'Invalid quotation request.' });
    }
    delete quote.attachment;
    if (file) {
      const type = Object.hasOwn(attachmentTypes, file.type) && attachmentTypes[file.type];
      const bytes = typeof file.base64 === 'string' ? Buffer.from(file.base64, 'base64') : Buffer.alloc(0);
      if (!type || bytes.length > 3 * 1024 * 1024 || !bytes.subarray(0, type.signature.length).equals(type.signature)) {
        return res.status(400).json({ error: 'Choose a valid PDF, PNG or JPEG file up to 3 MB.' });
      }
      const stem = String(file.name || '').replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 100);
      attachment = await QuoteAttachment.create({ name: `${stem || 'drawing'}.${type.extension}`, contentType: file.type, bytes });
      quote.attachment = { id: String(attachment._id), name: attachment.name };
    }
    const result = await CommerceState.updateOne({ key: 'main', 'data.orders.id': { $ne: quote.id } }, {
      $push: { 'data.orders': { $each: [quote], $position: 0 } },
    });
    if (!result.matchedCount) {
      if (attachment) await attachment.deleteOne();
      return res.status(409).json({ error: 'Could not save this quotation. Refresh and try again.' });
    }
    res.status(201).json(quote);
  } catch (error) {
    if (attachment) await attachment.deleteOne().catch(console.error);
    next(error);
  }
});
app.get('/api/quote-attachments/:id', async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const attachment = await QuoteAttachment.findById(req.params.id);
    if (!attachment) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.attachment(attachment.name).type(attachment.contentType).send(attachment.bytes);
  } catch (error) { next(error); }
});
app.post('/api/reviews', async (req, res, next) => {
  try {
    const { orderId, productId, phone, rating, comment, photo } = req.body ?? {};
    if (typeof orderId !== 'string' || typeof productId !== 'string' || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof comment !== 'string' || !comment.trim() || comment.length > 1000 || !/^91\d{10}$/.test(normalizePhone(phone))) {
      return res.status(400).json({ error: 'Enter a rating and review of up to 1,000 characters.' });
    }
    const record = await CommerceState.findOne({ key: 'main' }, 'data.orders').lean();
    const order = record?.data?.orders?.find(order => order.id === orderId && order.type === 'order' && order.status === 'Delivered' && order.items?.some(item => item.productId === productId));
    if (!order || normalizePhone(order.customer?.phone) !== normalizePhone(phone)) {
      return res.status(403).json({ error: 'Reviews are available for products in delivered orders.' });
    }
    let image;
    if (photo) {
      const type = photo.type;
      const bytes = typeof photo.base64 === 'string' ? Buffer.from(photo.base64, 'base64') : Buffer.alloc(0);
      if (!['image/png', 'image/jpeg'].includes(type) || bytes.length > 3 * 1024 * 1024 ||
          !bytes.subarray(0, attachmentTypes[type].signature.length).equals(attachmentTypes[type].signature)) {
        return res.status(400).json({ error: 'Choose a valid PNG or JPEG photo up to 3 MB.' });
      }
      image = { contentType: type, bytes };
    }
    await ProductReview.create({ orderId, productId, rating, comment: comment.trim(), photo: image });
    res.sendStatus(201);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already reviewed this product for this order.' });
    next(error);
  }
});
app.get('/api/products/:id/reviews', async (req, res, next) => {
  try {
    const [summary, reviews] = await Promise.all([
      ProductReview.aggregate([{ $match: { productId: req.params.id } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      ProductReview.find({ productId: req.params.id }).sort({ createdAt: -1 }).limit(20).select('rating comment customerName createdAt photo.contentType').lean(),
    ]);
    res.json({ count: summary[0]?.count ?? 0, average: summary[0]?.average ?? 0,
      reviews: reviews.map(({ _id, rating, comment, customerName, createdAt, photo }) => ({ id: String(_id), rating, comment, customerName, createdAt, hasPhoto: Boolean(photo?.contentType) })) });
  } catch (error) { next(error); }
});
app.post('/api/products/:id/reviews', async (req, res, next) => {
  try {
    const customer = await currentCustomer(req);
    if (!customer) return res.status(401).json({ error: 'Log in before submitting a product review.' });
    const { rating, comment } = req.body ?? {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || !comment.trim() || comment.length > 1000) {
      return res.status(400).json({ error: 'Choose a star rating and write a review of up to 1,000 characters.' });
    }
    const state = await CommerceState.findOne({ key: 'main' }, 'data.products').lean();
    if (!state?.data?.products?.some(product => product.id === req.params.id)) {
      return res.status(404).json({ error: 'This product is no longer available.' });
    }
    const review = await ProductReview.create({ orderId: `customer-${customer._id}`, productId: req.params.id,
      customerName: customer.name, rating, comment: comment.trim() });
    res.status(201).json({ id: String(review._id), rating: review.rating, customerName: review.customerName,
      comment: review.comment, createdAt: review.createdAt, hasPhoto: false });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already reviewed this product.' });
    next(error);
  }
});
app.get('/api/reviews/:id/photo', async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const review = await ProductReview.findById(req.params.id).select('photo');
    if (!review?.photo?.bytes) return res.sendStatus(404);
    res.set('X-Content-Type-Options', 'nosniff').type(review.photo.contentType).send(review.photo.bytes);
  } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  res.status(status).json({ error: status < 500 ? error.message : (error.status ? error.message : 'Internal server error.') });
});

if (!mongoUri) {
  console.error('MONGODB_URI is missing. Copy backend/.env.example to backend/.env and set your MongoDB connection string.');
  process.exit(1);
}
try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  await ProductReview.init();
  await CustomerAccount.init();
  await CustomerSession.init();
  await PendingPayment.init();
  app.listen(port, host, () => console.log(`AS Commerce API listening on http://${host}:${port}`));
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
}
