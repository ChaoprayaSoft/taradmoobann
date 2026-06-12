const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

en.AdminDashboard.deleteMarketTitle = "Delete Market?";
en.AdminDashboard.deleteMarketConfirm = "Are you sure you want to delete {name}? This action cannot be undone.";

th.AdminDashboard.deleteMarketTitle = "ลบตลาด?";
th.AdminDashboard.deleteMarketConfirm = "คุณแน่ใจหรือไม่ว่าต้องการลบ {name}? การดำเนินการนี้ไม่สามารถยกเลิกได้";

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Delete market translation keys added');
