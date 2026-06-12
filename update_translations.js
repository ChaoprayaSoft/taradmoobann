const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

en.ShopOwnerDashboard.requestCompletion = "Request Completion";
delete en.ShopOwnerDashboard.choice2RequestCompletion;

th.ShopOwnerDashboard.requestCompletion = "ขอการยืนยันรับสินค้า";
delete th.ShopOwnerDashboard.choice2RequestCompletion;

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Translations updated');
