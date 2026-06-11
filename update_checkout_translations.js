const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

const enTranslations = {
  emptyCartTitle: 'Your Cart is Empty',
  emptyCartDesc: 'Looks like you haven\'t added anything to your cart yet.',
  goShopping: 'Go Shopping',
  orderPlacedTitle: 'Order Placed Successfully!',
  orderPlacedDesc: 'The shop owners have been notified and are preparing your items.',
  returnToDashboard: 'Return to Dashboard',
  unknownShop: 'Unknown Shop',
  checkoutTitle: 'Checkout',
  deliveryAddress: 'Delivery Address',
  noDeliveryAddressSet: 'You don\'t have a delivery address set.',
  addAddressLink: 'Please go to your dashboard to add one.',
  orderSummary: 'Order Summary',
  noImg: 'No Img',
  note: 'Note',
  qty: 'Qty',
  paymentSummary: 'Payment Summary',
  subtotal: 'Subtotal',
  deliveryFee: 'Delivery Fee',
  free: 'Free',
  total: 'Total',
  placingOrder: 'Placing Order...',
  placeOrder: 'Place Order',
  cashOnDelivery: 'Cash on Delivery',
  selectOrAddAddress: 'Please select or add a delivery address.'
};

const thTranslations = {
  emptyCartTitle: 'ตะกร้าสินค้าของคุณว่างเปล่า',
  emptyCartDesc: 'ดูเหมือนว่าคุณยังไม่ได้เพิ่มอะไรลงในตะกร้าเลย',
  goShopping: 'ไปช้อปปิ้ง',
  orderPlacedTitle: 'สั่งซื้อสำเร็จ!',
  orderPlacedDesc: 'เจ้าของร้านได้รับการแจ้งเตือนแล้วและกำลังเตรียมสินค้าของคุณ',
  returnToDashboard: 'กลับไปที่แดชบอร์ด',
  unknownShop: 'ร้านค้าที่ไม่รู้จัก',
  checkoutTitle: 'ชำระเงิน',
  deliveryAddress: 'ที่อยู่สำหรับจัดส่ง',
  noDeliveryAddressSet: 'คุณยังไม่ได้ตั้งที่อยู่สำหรับจัดส่ง',
  addAddressLink: 'กรุณาไปที่แดชบอร์ดของคุณเพื่อเพิ่มที่อยู่',
  orderSummary: 'สรุปคำสั่งซื้อ',
  noImg: 'ไม่มีรูป',
  note: 'หมายเหตุ',
  qty: 'จำนวน',
  paymentSummary: 'สรุปการชำระเงิน',
  subtotal: 'ยอดรวมย่อย',
  deliveryFee: 'ค่าจัดส่ง',
  free: 'ฟรี',
  total: 'ยอดรวม',
  placingOrder: 'กำลังสั่งซื้อ...',
  placeOrder: 'สั่งซื้อ',
  cashOnDelivery: 'เก็บเงินปลายทาง',
  selectOrAddAddress: 'กรุณาเลือกหรือเพิ่มที่อยู่จัดส่ง'
};

en.Checkout = enTranslations;
th.Checkout = thTranslations;

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('Checkout translations successfully written');
