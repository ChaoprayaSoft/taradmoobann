const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

const enTranslations = {
  welcome: 'Welcome to',
  description: 'Your local neighborhood online market.',
  spotlightProducts: 'Spotlight Products',
  spotlight: 'Spotlight',
  noImage: 'No Image',
  inMarket: 'In {marketName}',
  viewInMarket: 'View in Market \u2192',
  pendingApproval: 'Pending Approval',
  needsRevision: 'Needs Revision',
  requestToEnterArrow: 'Request to Enter \u2192',
  discoverLocalMarkets: 'Discover Local Markets',
  noMarketsYet: 'No markets have been created yet. Check back soon!',
  clickToRequest: 'Click to Request Access',
  enterMarket: 'Enter Market',
  requestToEnter: 'Request to Enter',
  requestMarketAccess: 'Request Market Access',
  applicationNoteDesc: 'Please provide a brief note to the Market Owner (e.g., your house number or name) to verify your residency.',
  applicationNoteLabel: 'Application Note *',
  applicationNotePlaceholder: 'Hi, I live at House #42...',
  cancel: 'Cancel',
  submitting: 'Submitting...',
  submitRequest: 'Submit Request',
  signInRequired: 'Sign In Required',
  signInRequiredDesc: 'You need to sign in or create an account before you can join a market and start shopping.',
  signInWithGoogle: 'Sign in with Google'
};

const thTranslations = {
  welcome: 'ยินดีต้อนรับสู่',
  description: 'ตลาดออนไลน์สำหรับหมู่บ้านของคุณ',
  spotlightProducts: 'สินค้าแนะนำ',
  spotlight: 'แนะนำ',
  noImage: 'ไม่มีรูป',
  inMarket: 'ใน {marketName}',
  viewInMarket: 'ดูในตลาด \u2192',
  pendingApproval: 'รอการอนุมัติ',
  needsRevision: 'ต้องการการแก้ไข',
  requestToEnterArrow: 'ขอเข้าตลาด \u2192',
  discoverLocalMarkets: 'ค้นพบตลาดในพื้นที่',
  noMarketsYet: 'ยังไม่มีการสร้างตลาดเลย กลับมาดูใหม่เร็วๆนี้นะ!',
  clickToRequest: 'คลิกเพื่อขอเข้าถึง',
  enterMarket: 'เข้าตลาด',
  requestToEnter: 'ขอเข้าตลาด',
  requestMarketAccess: 'ขอเข้าถึงตลาด',
  applicationNoteDesc: 'โปรดระบุหมายเหตุสั้นๆ ถึงเจ้าของตลาด (เช่น บ้านเลขที่หรือชื่อของคุณ) เพื่อยืนยันการอยู่อาศัยของคุณ',
  applicationNoteLabel: 'หมายเหตุการสมัคร *',
  applicationNotePlaceholder: 'สวัสดี ฉันอยู่ที่บ้านเลขที่ 42...',
  cancel: 'ยกเลิก',
  submitting: 'กำลังส่ง...',
  submitRequest: 'ส่งคำขอ',
  signInRequired: 'จำเป็นต้องเข้าสู่ระบบ',
  signInRequiredDesc: 'คุณต้องเข้าสู่ระบบหรือสร้างบัญชีก่อนที่คุณจะสามารถเข้าร่วมตลาดและเริ่มช้อปปิ้งได้',
  signInWithGoogle: 'เข้าสู่ระบบด้วย Google'
};

en.HomePage = { ...en.HomePage, ...enTranslations };
th.HomePage = { ...th.HomePage, ...thTranslations };

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('HomePage translations successfully updated');
