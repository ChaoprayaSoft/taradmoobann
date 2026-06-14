const fs = require('fs');

const enFile = './messages/en.json';
const thFile = './messages/th.json';

const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const thData = JSON.parse(fs.readFileSync(thFile, 'utf8'));

const newKeys = {
  "manageUsers": "Manage Users",
  "searchUsersPlaceholder": "Search by name, email, or house number...",
  "allMarkets": "All Markets",
  "allVillages": "All Villages",
  "username": "Username",
  "email": "Email",
  "createdDate": "Created Date",
  "address": "Address",
  "viewAddresses": "View Addresses",
  "noUsersFound": "No users found.",
  "deliveryAddresses": "Delivery Addresses",
  "noAddressesFound": "No addresses found for this user."
};

const newKeysTh = {
  "manageUsers": "จัดการผู้ใช้",
  "searchUsersPlaceholder": "ค้นหาตามชื่อ อีเมล หรือบ้านเลขที่...",
  "allMarkets": "ตลาดทั้งหมด",
  "allVillages": "หมู่บ้านทั้งหมด",
  "username": "ชื่อผู้ใช้",
  "email": "อีเมล",
  "createdDate": "วันที่สร้าง",
  "address": "ที่อยู่",
  "viewAddresses": "ดูที่อยู่",
  "noUsersFound": "ไม่พบผู้ใช้",
  "deliveryAddresses": "ที่อยู่สำหรับจัดส่ง",
  "noAddressesFound": "ไม่พบที่อยู่สำหรับผู้ใช้นี้"
};

for (const [key, val] of Object.entries(newKeys)) {
  enData.AdminDashboard[key] = val;
}

for (const [key, val] of Object.entries(newKeysTh)) {
  thData.AdminDashboard[key] = val;
}

fs.writeFileSync(enFile, JSON.stringify(enData, null, 2));
fs.writeFileSync(thFile, JSON.stringify(thData, null, 2));

console.log("Keys added successfully.");
