const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

const enNewKeys = {
  villageName: 'Village Name',
  houseNo: 'House No.',
  addressLine: 'Address',
  telephone: 'Telephone No.'
};

const thNewKeys = {
  villageName: 'ชื่อหมู่บ้าน',
  houseNo: 'บ้านเลขที่',
  addressLine: 'ที่อยู่',
  telephone: 'เบอร์โทรศัพท์'
};

en.ShopperDashboard = { ...en.ShopperDashboard, ...enNewKeys };
th.ShopperDashboard = { ...th.ShopperDashboard, ...thNewKeys };

en.Checkout = { ...en.Checkout, ...enNewKeys };
th.Checkout = { ...th.Checkout, ...thNewKeys };

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('Address translation keys updated');
