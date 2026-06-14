const fs = require('fs');
const en = JSON.parse(fs.readFileSync('messages/en.json')).ShopOwnerDashboard;
const content = fs.readFileSync('src/app/[locale]/shop-owner/ShopOwnerDashboardClient.tsx', 'utf8');

const regex = /t\(\"([^\"]+)\"\)/g;
const matches = [];
let match;
while ((match = regex.exec(content)) !== null) {
  matches.push(match[1]);
}

const missing = matches.filter(k => !en[k]);
console.log('Missing:', [...new Set(missing)]);
