const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

const enTranslations = {
  allCategories: 'All Categories',
  unknownShop: 'Unknown Shop',
  marketNotFound: 'Market not found.',
  switchMarket: 'Switch Market:',
  shopsCount: '{count} Shops',
  membersCount: '{count} Members',
  marketClosed: 'Market Closed',
  marketOpen: 'Market Open',
  searchProducts: 'Search for products across the market...',
  shopsInMarket: 'Shops in Market',
  all: 'All',
  open: 'Open',
  closed: 'Closed',
  noShopsMatching: 'No shops matching status.',
  spotlightProducts: 'Spotlight Products',
  topPicks: 'Top picks for you',
  scheduled: 'Scheduled',
  new: 'New',
  marketIsCurrentlyClosed: 'Market is Currently Closed',
  marketClosedDesc: '{name} is currently closed for business. Please come back later during operating hours.',
  searchResults: 'Search Results',
  foundItems: 'Found {count} items matching your criteria.',
  noProductsFound: 'No products found matching your search criteria.',
  clearFilters: 'Clear Filters',
  highlightedItems: 'Highlighted items chosen by our shop owners.',
  noSpotlightProducts: 'No spotlight products available right now.',
  validUntil: 'VALID UNTIL {dates}',
  openCaps: 'OPEN',
  closedCaps: 'CLOSED',
  welcomeShop: 'Welcome to our shop!',
  ratingWithCount: '{rating} ({count} Reviews)',
  noReviewsYet: 'No reviews yet',
  chatWithShop: 'Chat with Shop',
  shopNoProducts: 'This shop hasn\'t added any products yet.',
  selectShop: 'Select a Shop',
  chooseShopSidebar: 'Choose a shop from the sidebar to view their products.',
  reviewsFor: 'Reviews for {name}',
  noReviewsYetPeriod: 'No reviews yet.',
  replyFromShopOwner: 'Reply from Shop Owner:',
  close: 'Close'
};

const thTranslations = {
  allCategories: 'ทุกหมวดหมู่',
  unknownShop: 'ร้านค้าที่ไม่รู้จัก',
  marketNotFound: 'ไม่พบตลาด',
  switchMarket: 'เปลี่ยนตลาด:',
  shopsCount: '{count} ร้านค้า',
  membersCount: '{count} สมาชิก',
  marketClosed: 'ตลาดปิด',
  marketOpen: 'ตลาดเปิด',
  searchProducts: 'ค้นหาสินค้าในตลาด...',
  shopsInMarket: 'ร้านค้าในตลาด',
  all: 'ทั้งหมด',
  open: 'เปิด',
  closed: 'ปิด',
  noShopsMatching: 'ไม่มีร้านค้าที่ตรงกับสถานะ',
  spotlightProducts: 'สินค้าแนะนำ',
  topPicks: 'สินค้าที่เลือกสรรมาเพื่อคุณ',
  scheduled: 'ตามกำหนดการ',
  new: 'ใหม่',
  marketIsCurrentlyClosed: 'ตลาดปิดทำการชั่วคราว',
  marketClosedDesc: '{name} ปิดให้บริการในขณะนี้ โปรดกลับมาใหม่ในช่วงเวลาทำการ',
  searchResults: 'ผลการค้นหา',
  foundItems: 'พบ {count} รายการที่ตรงกับเกณฑ์ของคุณ',
  noProductsFound: 'ไม่พบสินค้าที่ตรงกับเกณฑ์การค้นหาของคุณ',
  clearFilters: 'ล้างตัวกรอง',
  highlightedItems: 'สินค้าแนะนำที่คัดเลือกโดยเจ้าของร้าน',
  noSpotlightProducts: 'ไม่มีสินค้าแนะนำในขณะนี้',
  validUntil: 'เปิดถึง {dates}',
  openCaps: 'เปิด',
  closedCaps: 'ปิด',
  welcomeShop: 'ยินดีต้อนรับสู่ร้านของเรา!',
  ratingWithCount: '{rating} ({count} รีวิว)',
  noReviewsYet: 'ยังไม่มีรีวิว',
  chatWithShop: 'แชทกับร้านค้า',
  shopNoProducts: 'ร้านค้านี้ยังไม่ได้เพิ่มสินค้าใด ๆ',
  selectShop: 'เลือกร้านค้า',
  chooseShopSidebar: 'เลือกร้านค้าจากแถบด้านข้างเพื่อดูสินค้าของพวกเขา',
  reviewsFor: 'รีวิวสำหรับ {name}',
  noReviewsYetPeriod: 'ยังไม่มีรีวิว',
  replyFromShopOwner: 'ตอบกลับจากเจ้าของร้าน:',
  close: 'ปิด'
};

en.MarketShopping = enTranslations;
th.MarketShopping = thTranslations;

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('MarketShopping translations successfully written');
