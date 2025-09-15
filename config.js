
 module.exports = {
	USE_SSL: false,
	CF_SSL: {
		key: 'certs/panazic.key',
		cert: 'certs/panazic.crt'
	},

	DOMAIN: 'https://fmaxtrading.com',
	TITLE_SITE: 'fmaxtrading',
	CONTACT:'support@fmaxtrading.com',

	MAIL_USERNAME: 'support@fmaxtrading.com',
	MAIL_PASSWORD: 'kerjbmaqpzalztwo',
	MAIL_LOGO: 'https://fmaxtrading.com/img/logo.87c4ea28.png',
	MAIL_IMG_FOOTER: 'https://fmaxtrading.com/img/logo.87c4ea28.png',

	IS_PLAY_SPOT: true, // mặc địng false -> FUTURES, Sử dụng BINANCE SPOT ( check được sàn ) hoặc FUTURE ( không bào giờ bảo trì, không check được sàn )

	SO_GIAY_DEM_NGUOC: 30,
	RATE_NHA_THUONG: 95,
	BET_MAX: 1,

	BINANCE_APIKEY: 'srBGjy1ATl33Lzb5ZmeXneanYnygQw3QRCGNq0zKV9vvPM5O95CjV8aNX9C9HCUZ',
  	BINANCE_APISECRET: 'AVoHbbQcrOuUhdvkhdxyGuTk9FJlTJBgH02LPwA9TcUxxMCTnF8p1WL3ZPWw4C1T',

	// THANH TOÁN PAYPAL
	//PAYPAL_MODE: 'live', //sandbox or live
	//PAYPAL_CLIENT_ID: 'AbubWI5Cc-21tFJnqK7B6cFuSa2es3nqJYY0McPI9EBLiCyDQjJEJ7_vUcZTBNdiHVhfOEWUsTPL0mcf',//'AakUAPg0hA5WSN5IdhfLV_VsPWd8kLktvesDPEDgbsdzOLwI9UPQj9NAYEyVIVKKzRsdC_2HbnAFy10p',
	//PAYPAL_CLIENT_SECRET: 'EFX50IOpCcqREF8npYA9iavGBvqeW8W7zZ1wfM_dn147xyelQyGwSa9U-WJrl44BrSmnj7JFNqMcY8fk',//'EMEZw9QceAhl2UztIWGH62xh95z7---kuu6npJTRj09TVJRQnG-hyIfKUfsptfPIGcBvuwxeBhCtjYT_',

	PAYPAL_MODE: 'sandbox', //sandbox or live
	PAYPAL_CLIENT_ID: 'AakUAPg0hA5WSN5IdhfLV_VsPWd8kLktvesDPEDgbsdzOLwI9UPQj9NAYEyVIVKKzRsdC_2HbnAFy10p',//'',
	PAYPAL_CLIENT_SECRET: 'EMEZw9QceAhl2UztIWGH62xh95z7---kuu6npJTRj09TVJRQnG-hyIfKUfsptfPIGcBvuwxeBhCtjYT_',//'',
	// KẾT THÚC THANH TOÁN PAYPAL

	DATA_HOST: 'localhost',
	DATA_USER: 'admin',
	DATA_PASS: 'Noname@2022',
	DATA_DB: 'cgame',
	DATA_PORT: 3306,

	PORT_TRADE: 2096,
	PORT_SYS: 2087,
	PORT_NAP: 2083,
	PORT_NOTIFY: 2053,
	PORT_SERVER: 3000,

	TELEGRAM_TOKEN: '8062373345:AAH4HqMTotCAWlhG4YEMhek90VfaoEKZSvQ', 
	TELEGRAM_BET_ID: 'telecallcall', 
	TELEGRAM_RUT_ID: 'telecallcall', 
	TELEGRAM_NAP_ID: 'telecallcall',
	TELEGRAM_BET_AMOUNT: 'telecallcall',
	TELEGRAM_BET_THONG_BAO: 'telecallcall',
	TELEGRAM_BET_PHIM_LENH: 'telecallcall', 

	TOKEN_KEY: 'thinhvipprono1',

	PATH_SYS_CONFIG: 'stSys',
	PATH_SYS_COMMISSION: 'stCommission',
	PATH_SYS_COMMISSION_VIP: 'stCommissionVip',

	ABI_USDT_MAINNET: 'USDT_BEP20_mainnet',
	ABI_USDT_TESTNNET: 'USDT_BEP20_testnet',
}


