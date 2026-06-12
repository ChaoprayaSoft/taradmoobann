const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

en.Notifications = {
  newOrderTitle: "New Order Received!",
  newOrderBody: "You have a new order from {shopperName}.<br/><br/><strong>Delivery Address:</strong><br/>{deliveryAddress}<br/><br/><strong>Items Ordered:</strong><br/>{itemsList}<br/><br/><strong>Total Amount:</strong> ฿{totalAmount}",
  orderUpdateTitle: "Order Update",
  orderUpdateBody: "Your order from {shopName} is now: {status}",
  shopApprovedTitle: "Shop Approved!",
  shopApprovedBody: "Congratulations! Your shop {shopName} has been approved by the market owner.",
  shopReviseTitle: "Shop Needs Revision",
  shopReviseBody: "The market owner has requested a revision for your shop {shopName}. Please check your dashboard.",
  membershipActiveTitle: "Membership Activated",
  membershipActiveBody: "Your membership for {marketName} is now active!",
  membershipExpiredTitle: "Membership Expired",
  membershipExpiredBody: "Your membership for {marketName} has expired.",
  newShopTitle: "New Shop Registration",
  newShopBody: "{ownerName} has requested to open a shop '{shopName}' in your market.",
  newMemberTitle: "New Membership Registration",
  newMemberBody: "{userName} has requested to join your market '{marketName}'."
};

th.Notifications = {
  newOrderTitle: "ได้รับคำสั่งซื้อใหม่!",
  newOrderBody: "คุณได้รับคำสั่งซื้อใหม่จาก {shopperName}.<br/><br/><strong>ที่อยู่จัดส่ง:</strong><br/>{deliveryAddress}<br/><br/><strong>รายการสินค้า:</strong><br/>{itemsList}<br/><br/><strong>ยอดรวม:</strong> ฿{totalAmount}",
  orderUpdateTitle: "อัปเดตคำสั่งซื้อ",
  orderUpdateBody: "คำสั่งซื้อของคุณจากร้าน {shopName} ตอนนี้อยู่ในสถานะ: {status}",
  shopApprovedTitle: "ร้านค้าได้รับการอนุมัติ!",
  shopApprovedBody: "ขอแสดงความยินดี! ร้านค้า {shopName} ของคุณได้รับการอนุมัติจากเจ้าของตลาดแล้ว",
  shopReviseTitle: "ร้านค้าต้องแก้ไข",
  shopReviseBody: "เจ้าของตลาดได้ขอให้แก้ไขร้านค้า {shopName} ของคุณ โปรดตรวจสอบในแดชบอร์ดของคุณ",
  membershipActiveTitle: "เปิดใช้งานสมาชิกแล้ว",
  membershipActiveBody: "การเป็นสมาชิกของคุณสำหรับ {marketName} ถูกเปิดใช้งานแล้ว!",
  membershipExpiredTitle: "สมาชิกหมดอายุ",
  membershipExpiredBody: "การเป็นสมาชิกของคุณสำหรับ {marketName} หมดอายุแล้ว",
  newShopTitle: "การลงทะเบียนร้านค้าใหม่",
  newShopBody: "{ownerName} ได้ร้องขอเปิดร้าน '{shopName}' ในตลาดของคุณ",
  newMemberTitle: "การลงทะเบียนสมาชิกใหม่",
  newMemberBody: "{userName} ได้ขอเข้าร่วมตลาด '{marketName}' ของคุณ"
};

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Notification translations added');
