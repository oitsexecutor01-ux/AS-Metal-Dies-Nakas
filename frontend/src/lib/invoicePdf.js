import { jsPDF } from 'jspdf';
import { inr, day, phoneNumber, whatsappUrl } from './utils.jsx';
import { toast } from 'react-toastify';

/**
 * Format invoice details into a clean WhatsApp text receipt
 */
export function formatInvoiceWhatsAppText(order, shop) {
  const storeName = shop?.name || 'AS Metal Dies & Nakas';
  const customerName = order?.customer?.name || 'Walk-in Customer';
  const customerPhone = order?.customer?.phone || '';
  const dateStr = day(order?.createdAt);
  
  const itemsText = (order?.items || [])
    .map((item, idx) => `${idx + 1}. ${item.name} × ${item.qty} = Rs. ${Number(item.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
    .join('\n');

  const subtotalStr = Number(order?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const totalStr = Number(order?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  
  let details = `*TAX INVOICE / BILL*\n*${storeName}*\n`;
  if (shop?.tagline) details += `${shop.tagline}\n`;
  if (shop?.phone) details += `Ph: ${shop.phone} | `;
  if (shop?.gstin) details += `GSTIN: ${shop.gstin}\n`;
  else details += '\n';

  details += `--------------------------------\n`;
  details += `*Invoice No:* #${order?.id || ''}\n`;
  details += `*Date:* ${dateStr}\n`;
  details += `*Customer:* ${customerName}\n`;
  if (customerPhone) details += `*Mobile:* ${customerPhone}\n`;
  if (order?.customer?.address) details += `*Address:* ${order.customer.address}\n`;
  details += `--------------------------------\n`;
  details += `*ITEMS:*\n${itemsText}\n`;
  details += `--------------------------------\n`;
  details += `Subtotal: Rs. ${subtotalStr}\n`;
  
  if (order?.discount > 0) {
    details += `Discount: -Rs. ${Number(order.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
  }
  if (order?.tax > 0) {
    details += `GST / Tax: Rs. ${Number(order.tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
  }
  if (order?.deliveryCharge > 0) {
    details += `Delivery: Rs. ${Number(order.deliveryCharge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
  }

  details += `*GRAND TOTAL: Rs. ${totalStr}*\n`;
  details += `--------------------------------\n`;
  details += `*Payment:* ${order?.payment?.status || 'Unpaid'} (${order?.payment?.method || 'Cash'})\n`;
  if (shop?.upi) details += `*UPI ID for Payment:* ${shop.upi}\n`;
  details += `--------------------------------\n`;
  details += `Thank you for your business!`;

  return details;
}

/**
 * Generate a professional, branded A4 PDF Invoice
 */
export function generateInvoicePDF(order, shop = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pW = 210;
  const pH = 297;
  const mX = 14;
  const contentW = pW - mX * 2; // 182mm

  // Colors
  const primaryDark = [16, 37, 62];    // #10253e
  const accentBrown = [185, 98, 45];   // #b9622d
  const textDark = [23, 36, 56];       // #172438
  const textMuted = [85, 98, 115];     // #556273
  const lightBg = [248, 250, 252];     // #f8fafc
  const borderColor = [225, 230, 236]; // #e1e6ec
  const successColor = [33, 131, 79];  // #21834f
  const dangerColor = [196, 74, 70];   // #c44a46

  function drawHeaderAndMeta() {
    // Header Bar
    doc.setFillColor(...primaryDark);
    doc.rect(0, 0, pW, 32, 'F');

    // Store Name
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.text((shop.name || 'AS METAL DIES & NAKAS').toUpperCase(), mX, 11);

    // Tagline and Contact
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(195, 210, 225);
    if (shop.tagline) {
      doc.text(shop.tagline, mX, 16);
    }
    const storeSub = [
      shop.address,
      shop.phone ? `Ph: ${shop.phone}` : '',
      shop.gstin ? `GSTIN: ${shop.gstin}` : '',
      shop.email ? `Email: ${shop.email}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(storeSub || 'Industrial Dies, Nakas & Precision Metal Products', mX, 21);
    if (shop.upi) {
      doc.text(`UPI Payment ID: ${shop.upi}`, mX, 26);
    }

    // Invoice Badge (Right aligned)
    doc.setFillColor(...accentBrown);
    doc.roundedRect(pW - 58, 6, 44, 9.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TAX INVOICE / BILL', pW - 36, 12, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`INV #${order.id || 'NEW'}`, pW - mX, 21, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(195, 210, 225);
    doc.text(`Date: ${day(order.createdAt || new Date())}`, pW - mX, 26, { align: 'right' });

    // Customer & Payment Info Boxes (y = 36)
    const boxY = 36;
    const boxH = 27;
    const boxW = (contentW - 6) / 2; // 88mm

    // Billed To Box
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(mX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...accentBrown);
    doc.text('BILLED TO (CUSTOMER)', mX + 4, boxY + 5);

    doc.setTextColor(...textDark);
    doc.setFontSize(9.5);
    doc.text(order.customer?.name || 'Walk-in Customer', mX + 4, boxY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(`Phone: ${order.customer?.phone || 'Not provided'}`, mX + 4, boxY + 16);
    const addr = order.customer?.address || 'Counter Sale / Pick up';
    doc.text(addr.slice(0, 48), mX + 4, boxY + 20.5);
    if (order.customer?.landmark) {
      doc.text(`Landmark: ${order.customer.landmark.slice(0, 44)}`, mX + 4, boxY + 24.5);
    } else if (order.customer?.gstin) {
      doc.text(`Customer GSTIN: ${order.customer.gstin}`, mX + 4, boxY + 24.5);
    }

    // Payment Box
    const pBoxX = mX + boxW + 6;
    doc.roundedRect(pBoxX, boxY, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...accentBrown);
    doc.text('PAYMENT & ORDER STATUS', pBoxX + 4, boxY + 5);

    const isPaid = (order.payment?.status || '').toLowerCase() === 'paid';
    doc.setFillColor(...(isPaid ? successColor : dangerColor));
    doc.roundedRect(pBoxX + 4, boxY + 8, 22, 5.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(isPaid ? 'PAID' : 'UNPAID', pBoxX + 15, boxY + 12, { align: 'center' });

    doc.setTextColor(...textMuted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Mode: ${order.payment?.method || 'Cash'}`, pBoxX + 30, boxY + 12);
    doc.text(`Order Type: ${order.type === 'quote' ? 'Quotation' : 'Sales Invoice'}`, pBoxX + 4, boxY + 18.5);
    doc.text(`Delivery Date: ${day(order.deliveryDate || order.createdAt)}`, pBoxX + 4, boxY + 23);
  }

  function drawTableHeader(y) {
    doc.setFillColor(...primaryDark);
    doc.rect(mX, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('#', mX + 3, y + 5.2);
    doc.text('Item Description', mX + 12, y + 5.2);
    doc.text('Qty', mX + 115, y + 5.2, { align: 'center' });
    doc.text('Unit Rate (Rs.)', mX + 148, y + 5.2, { align: 'right' });
    doc.text('Amount (Rs.)', mX + contentW - 4, y + 5.2, { align: 'right' });
  }

  // Draw first page header
  drawHeaderAndMeta();

  let curY = 68;
  drawTableHeader(curY);
  curY += 8;

  const items = order.items || [];
  items.forEach((item, index) => {
    // Check if new page is needed
    if (curY > pH - 65) {
      doc.addPage();
      curY = 16;
      drawTableHeader(curY);
      curY += 8;
    }

    const isAlt = index % 2 === 1;
    if (isAlt) {
      doc.setFillColor(250, 251, 253);
      doc.rect(mX, curY, contentW, 7.5, 'F');
    }
    doc.setDrawColor(235, 238, 242);
    doc.line(mX, curY + 7.5, mX + contentW, curY + 7.5);

    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(index + 1), mX + 3, curY + 5);

    const itemName = String(item.name || 'Custom Die / Work').slice(0, 56);
    doc.text(itemName, mX + 12, curY + 5);

    doc.text(String(item.qty || 1), mX + 115, curY + 5, { align: 'center' });
    doc.text(Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), mX + 148, curY + 5, { align: 'right' });
    doc.text(Number(item.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), mX + contentW - 4, curY + 5, { align: 'right' });

    curY += 7.5;
  });

  // Check if summary box fits, else new page
  if (curY > pH - 60) {
    doc.addPage();
    curY = 20;
  } else {
    curY += 4;
  }

  // Totals Summary Box
  const summaryW = 86;
  const summaryX = mX + contentW - summaryW;
  const summaryStartY = curY;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderColor);
  doc.roundedRect(summaryX, summaryStartY, summaryW, 38, 1.5, 1.5, 'FD');

  let sY = summaryStartY + 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);

  // Subtotal
  doc.text('Subtotal:', summaryX + 4, sY);
  doc.text(`Rs. ${Number(order.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + summaryW - 4, sY, { align: 'right' });

  // Discount
  if (order.discount > 0) {
    sY += 5;
    doc.setTextColor(...successColor);
    doc.text('Discount:', summaryX + 4, sY);
    doc.text(`- Rs. ${Number(order.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + summaryW - 4, sY, { align: 'right' });
  }

  // Tax / GST
  if (order.tax > 0) {
    sY += 5;
    doc.setTextColor(...textMuted);
    const taxLabel = order.taxRate ? `GST (${order.taxRate}%):` : 'GST / Tax:';
    doc.text(taxLabel, summaryX + 4, sY);
    doc.text(`Rs. ${Number(order.tax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + summaryW - 4, sY, { align: 'right' });
  }

  // Delivery
  if (order.deliveryCharge > 0) {
    sY += 5;
    doc.setTextColor(...textMuted);
    doc.text('Delivery / Transport:', summaryX + 4, sY);
    doc.text(`Rs. ${Number(order.deliveryCharge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + summaryW - 4, sY, { align: 'right' });
  }

  // Grand Total Line
  sY += 6.5;
  doc.setDrawColor(215, 222, 230);
  doc.line(summaryX + 4, sY - 1.5, summaryX + summaryW - 4, sY - 1.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...accentBrown);
  doc.text('Grand Total:', summaryX + 4, sY + 2.5);
  doc.text(`Rs. ${Number(order.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryX + summaryW - 4, sY + 2.5, { align: 'right' });

  // Left side notes / Terms in summary area
  const notesW = summaryX - mX - 6;
  doc.setFillColor(...lightBg);
  doc.roundedRect(mX, summaryStartY, notesW, 38, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...accentBrown);
  doc.text('TERMS & NOTES', mX + 4, summaryStartY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  const notes = order.notes || '1. Materials delivered as per ordered specifications.\n2. Goods once sold cannot be returned without invoice.\n3. Computer generated tax invoice, no physical signature required.';
  const splitNotes = doc.splitTextToSize(notes, notesW - 8);
  doc.text(splitNotes, mX + 4, summaryStartY + 11);

  // Footer bar
  doc.setFillColor(...primaryDark);
  doc.rect(0, pH - 9, pW, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Thank you for choosing ' + (shop.name || 'AS Metal Dies & Nakas') + ' • Quality & Precision Assured', pW / 2, pH - 3.5, { align: 'center' });

  return doc;
}

/**
 * Trigger immediate download of the PDF invoice
 */
export function downloadInvoicePDF(order, shop = {}) {
  try {
    const doc = generateInvoicePDF(order, shop);
    const fileName = `Invoice-${order.id || Date.now()}.pdf`;
    doc.save(fileName);
    toast.success(`Invoice PDF downloaded: ${fileName}`);
    return true;
  } catch (error) {
    console.error('PDF download error:', error);
    toast.error('Could not generate PDF: ' + error.message);
    return false;
  }
}

/**
 * Share PDF directly via WhatsApp or open WhatsApp with formatted receipt
 */
export async function shareInvoiceWhatsApp(order, shop = {}) {
  const customerPhone = order?.customer?.phone;
  const messageText = formatInvoiceWhatsAppText(order, shop);
  const fileName = `Invoice-${order.id || 'bill'}.pdf`;

  let pdfDoc = null;
  let pdfFile = null;

  try {
    pdfDoc = generateInvoicePDF(order, shop);
    const pdfBlob = pdfDoc.output('blob');
    pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
  } catch (e) {
    console.warn('PDF generation for share failed, proceeding with text:', e);
  }

  // 1. Check if device supports sharing PDF files natively (e.g. mobile Safari / Chrome)
  if (pdfFile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Invoice #${order.id}`,
        text: messageText,
      });
      toast.success('Invoice PDF shared successfully!');
      return true;
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') return false; // User cancelled share sheet
      console.log('Native share failed, falling back to download + WhatsApp chat link:', shareErr);
    }
  }

  // 2. Fallback for Desktop / non-file-sharing browsers:
  // Automatically download the PDF to device so user has the file
  if (pdfDoc) {
    try {
      pdfDoc.save(fileName);
    } catch {}
  }

  // Open direct WhatsApp chat with the customer phone pre-filled
  const waUrl = customerPhone
    ? whatsappUrl(customerPhone, messageText)
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  window.open(waUrl, '_blank', 'noopener,noreferrer');
  toast.info('PDF downloaded & WhatsApp opened! Attach the downloaded invoice file to the chat.');
  return true;
}
