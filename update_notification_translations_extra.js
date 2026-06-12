const fs = require('fs');

const enFile = 'messages/en.json';
const thFile = 'messages/th.json';

const en = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const th = JSON.parse(fs.readFileSync(thFile, 'utf8'));

en.Notifications.membershipApprovedTitle = "Market Membership Approved";
en.Notifications.membershipApprovedBody = "Your request to join {marketName} has been approved!";
en.Notifications.membershipReviseTitle = "Membership Revision Needed";
en.Notifications.membershipReviseBody = "The market owner has requested a revision to your membership request for {marketName}.";

th.Notifications.membershipApprovedTitle = "อนุมัติการเป็นสมาชิกตลาดแล้ว";
th.Notifications.membershipApprovedBody = "คำขอเข้าร่วมตลาด {marketName} ของคุณได้รับการอนุมัติแล้ว!";
th.Notifications.membershipReviseTitle = "ต้องแก้ไขข้อมูลสมาชิก";
th.Notifications.membershipReviseBody = "เจ้าของตลาดได้ขอให้คุณแก้ไขคำขอการเป็นสมาชิกสำหรับตลาด {marketName}";

fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
fs.writeFileSync(thFile, JSON.stringify(th, null, 2));
console.log('Extra notification translations added');
