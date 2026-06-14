const fs = require('fs');
const th = JSON.parse(fs.readFileSync('messages/th.json')).ShopOwnerDashboard;
const content = fs.readFileSync('src/app/[locale]/shop-owner/ShopOwnerDashboardClient.tsx', 'utf8');

const regex = /t\(\"([^\"]+)\"\)/g;
const matches = [];
let match;
while ((match = regex.exec(content)) !== null) {
  matches.push(match[1]);
}

const missing = matches.filter(k => !th[k]);
console.log('Missing TH:', [...new Set(missing)]);
