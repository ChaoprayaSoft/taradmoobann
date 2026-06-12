require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log("Testing Resend with key:", process.env.RESEND_API_KEY.substring(0, 8) + "...");
  const response = await resend.emails.send({
    from: 'TaradMooBann <noreply@taradmoobann.com>',
    to: 'test@example.com',
    subject: 'Test Email',
    html: '<p>Test</p>'
  });
  console.log("Resend Response:", response);
}

testEmail();
