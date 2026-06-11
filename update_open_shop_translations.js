const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

const enNewKeys = {
  openShopTitle: 'Open a Shop',
  openShopDesc: 'Select an approved market and submit your shop details.',
  selectMarket: 'Select Market *',
  shopNameLabel: 'Shop Name *',
  shopNamePlaceholder: "e.g. Grandma's Bakery",
  categoryLabel: 'Category *',
  descriptionLabel: 'Description',
  locationType: 'Location Type *',
  houseNumberOpt: 'House Number',
  nearbyAreaOpt: 'Nearby Area',
  houseNumberPlaceholder: 'e.g. 123',
  nearbyAreaPlaceholder: 'e.g. Near the main gate',
  shopCoverImage: 'Shop Cover Image',
  cancelButton: 'Cancel',
  submitShopButton: 'Submit Shop',
  submittingShop: 'Submitting...'
};

const thNewKeys = {
  openShopTitle: 'เปิดร้านค้า',
  openShopDesc: 'เลือกตลาดที่ได้รับการอนุมัติและส่งรายละเอียดร้านค้าของคุณ',
  selectMarket: 'เลือกตลาด *',
  shopNameLabel: 'ชื่อร้านค้า *',
  shopNamePlaceholder: 'เช่น ร้านเบเกอรี่คุณยาย',
  categoryLabel: 'หมวดหมู่ *',
  descriptionLabel: 'รายละเอียด',
  locationType: 'ประเภทที่ตั้ง *',
  houseNumberOpt: 'บ้านเลขที่',
  nearbyAreaOpt: 'บริเวณใกล้เคียง',
  houseNumberPlaceholder: 'เช่น 123',
  nearbyAreaPlaceholder: 'เช่น ใกล้ประตูใหญ่',
  shopCoverImage: 'รูปภาพปกร้านค้า',
  cancelButton: 'ยกเลิก',
  submitShopButton: 'ส่งข้อมูลร้านค้า',
  submittingShop: 'กำลังส่ง...'
};

en.ShopperDashboard = { ...en.ShopperDashboard, ...enNewKeys };
th.ShopperDashboard = { ...th.ShopperDashboard, ...thNewKeys };

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Open shop translation keys updated');
