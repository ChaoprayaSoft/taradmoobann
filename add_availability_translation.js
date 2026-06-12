const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

en.ShopOwnerDashboard.available = "Available";
en.ShopOwnerDashboard.unavailable = "Unavailable";

th.ShopOwnerDashboard.available = "มีสินค้า";
th.ShopOwnerDashboard.unavailable = "หมดชั่วคราว";

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Product availability translation keys added');
