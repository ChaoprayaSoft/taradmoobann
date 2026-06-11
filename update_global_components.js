const fs = require('fs');

const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const th = JSON.parse(fs.readFileSync('messages/th.json', 'utf8'));

// WelcomeModal
const enWelcome = {
  welcomeTitle: 'Welcome to TaradMooBann!',
  welcomeDesc: "We're thrilled to have you here. To get you started on your journey, we've deposited a welcome gift into your account!",
  coinsAmount: '50 Free Coins!',
  addedToWallet: 'Added to your wallet',
  startExploring: 'Start Exploring'
};
const thWelcome = {
  welcomeTitle: 'ยินดีต้อนรับสู่ TaradMooBann!',
  welcomeDesc: "เราดีใจมากที่คุณมาที่นี่ เพื่อให้คุณเริ่มต้นการเดินทาง เราได้ฝากของขวัญต้อนรับไว้ในบัญชีของคุณแล้ว!",
  coinsAmount: 'ฟรี 50 เหรียญ!',
  addedToWallet: 'เพิ่มในกระเป๋าเงินของคุณแล้ว',
  startExploring: 'เริ่มสำรวจเลย'
};
en.WelcomeModal = { ...en.WelcomeModal, ...enWelcome };
th.WelcomeModal = { ...th.WelcomeModal, ...thWelcome };

// NotificationPrompt
const enNotification = {
  enableTitle: 'Enable Notifications?',
  enableDesc: 'Get instant alerts when your order status changes or when you receive a new message.',
  allow: 'Allow',
  maybeLater: 'Maybe Later',
  newNotification: 'New Notification'
};
const thNotification = {
  enableTitle: 'เปิดใช้งานการแจ้งเตือน?',
  enableDesc: 'รับการแจ้งเตือนทันทีเมื่อสถานะคำสั่งซื้อของคุณเปลี่ยนแปลงหรือเมื่อคุณได้รับข้อความใหม่',
  allow: 'อนุญาต',
  maybeLater: 'ไว้คราวหลัง',
  newNotification: 'การแจ้งเตือนใหม่'
};
en.NotificationPrompt = { ...en.NotificationPrompt, ...enNotification };
th.NotificationPrompt = { ...th.NotificationPrompt, ...thNotification };

// ChatWidget
const enChatWidget = {
  contactAdmin: 'Contact Admin',
  replySoon: 'We usually reply within a few hours.',
  sendToStart: 'Send a message to start a conversation.',
  typeMessage: 'Type your message...'
};
const thChatWidget = {
  contactAdmin: 'ติดต่อแอดมิน',
  replySoon: 'เรามักจะตอบกลับภายในไม่กี่ชั่วโมง',
  sendToStart: 'ส่งข้อความเพื่อเริ่มการสนทนา',
  typeMessage: 'พิมพ์ข้อความของคุณ...'
};
en.ChatWidget = { ...en.ChatWidget, ...enChatWidget };
th.ChatWidget = { ...th.ChatWidget, ...thChatWidget };

// ShopperShopChatModal
const enShopChat = {
  chatWith: 'Chat with {shopName}',
  shopOwner: 'Shop Owner',
  sendToStartShop: 'Send a message to start a conversation with the shop owner.',
  typeMessageShop: 'Type a message...'
};
const thShopChat = {
  chatWith: 'แชทกับ {shopName}',
  shopOwner: 'เจ้าของร้าน',
  sendToStartShop: 'ส่งข้อความเพื่อเริ่มการสนทนากับเจ้าของร้าน',
  typeMessageShop: 'พิมพ์ข้อความ...'
};
en.ShopperShopChatModal = { ...en.ShopperShopChatModal, ...enShopChat };
th.ShopperShopChatModal = { ...th.ShopperShopChatModal, ...thShopChat };

fs.writeFileSync('messages/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('messages/th.json', JSON.stringify(th, null, 2));
console.log('Global components translations successfully updated');
