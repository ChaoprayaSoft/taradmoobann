const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

if (!en.AdminDashboard.villageName) {
  en.AdminDashboard.villageName = "Village Name";
}
if (!en.AdminDashboard.villageNamePlaceholder) {
  en.AdminDashboard.villageNamePlaceholder = "e.g. Happy Village";
}

if (!th.AdminDashboard.villageName) {
  th.AdminDashboard.villageName = "ชื่อหมู่บ้าน";
}
if (!th.AdminDashboard.villageNamePlaceholder) {
  th.AdminDashboard.villageNamePlaceholder = "เช่น หมู่บ้านสุขสันต์";
}

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('AdminDashboard translation keys updated');
