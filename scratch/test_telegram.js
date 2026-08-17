const fs = require('fs');
const path = require('path');

let envStr = '';
try { envStr = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8'); } catch (e) {
  try { envStr = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8'); } catch (e2) {}
}

let botToken = '8967681842:AAEB3mYEQO2T-xy3B9wBUO93Qki2rv_YIC0';
let chatId = '-5412526905';

for (const line of envStr.split('\n')) {
  if (line.startsWith('TELEGRAM_BOT_TOKEN=')) {
    botToken = line.split('TELEGRAM_BOT_TOKEN=')[1].trim().replace(/^["']/, '').replace(/["']$/, '');
  }
  if (line.startsWith('TELEGRAM_CHAT_ID=')) {
    chatId = line.split('TELEGRAM_CHAT_ID=')[1].trim().replace(/^["']/, '').replace(/["']$/, '');
  }
}

async function testTelegram() {
  console.log(`Sending Telegram Test Message to Chat ID: ${chatId}...`);
  const text = `🎉 *SKYLIGHT KITCHEN TELEGRAM BOT IS ACTIVE!*\n\nYour restaurant app is now successfully linked to Telegram!\nNew orders placed by guests or waiters will automatically arrive in this chat.\n\n⏰ _${new Date().toLocaleTimeString()} | Skylight Village_`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  const json = await res.json();
  console.log('Telegram API Response:', json);
}

testTelegram().catch(console.error);
