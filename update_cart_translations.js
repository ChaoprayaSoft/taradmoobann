const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

const enTranslations = {
  yourCart: 'Your Cart',
  cartEmpty: 'Your cart is empty.',
  noImg: 'No Img',
  note: 'Note: {note}',
  subtotal: 'Subtotal',
  proceedToCheckout: 'Proceed to Checkout',
  unknownShop: 'Unknown Shop'
};

const thTranslations = {
  yourCart: 'ตะกร้าของคุณ',
  cartEmpty: 'ตะกร้าของคุณว่างเปล่า',
  noImg: 'ไม่มีรูป',
  note: 'หมายเหตุ: {note}',
  subtotal: 'ยอดรวม',
  proceedToCheckout: 'ดำเนินการชำระเงิน',
  unknownShop: 'ไม่ทราบชื่อร้าน'
};

en.CartSidebar = { ...en.CartSidebar, ...enTranslations };
th.CartSidebar = { ...th.CartSidebar, ...thTranslations };

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('Cart translations successfully updated');
