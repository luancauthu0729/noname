const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

console.log("Token bot đang dùng:", config.TELEGRAM_TOKEN);

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

bot.on('message', (msg) => {
  console.log(msg);
  bot.sendMessage(msg.chat.id, 'Chào bạn!');
});
