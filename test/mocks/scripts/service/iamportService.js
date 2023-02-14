//Load express module
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

app.use(express.json());

//Define request response in root URL (/)
app.get('/', (req, res) => {
    res.status(200).json('Hello, World!');
});

// Create the auth token
app.post('/api/auth/token', (req, res) => {
	const { username, password } = req.body;
    if(!username || !password){
		return res.status(401).json({"error":"user name or password parameter is missing"})
	}
	if(password == 'incorrectpassword'){
		return res.status(401).json({"error":"Invalid username or password"})
	}
	const token = jwt.sign({ sub: username }, 'secretkey', { expiresIn: '1h' });
    return res.status(200).json({ token });
});

// Create get paymentInfo API with json response...
app.get('/api/iamport_getPaymentInfo/', (req,res)=>{
  if(!req.query.impuid){
    return res.status(401).json({"error":"paymentID parameter is missing"})
  }
    return res.status(200).json({
		code: 0,
		message: null,
		response: {
			amount: 200,
			apply_num: '31225404',
			bank_code: null,
			bank_name: null,
			buyer_addr: '548 Market St',
			buyer_email: 'isaac.oppong-baah@kcsit.pt',
			buyer_name: 'Isaac Oppong-Baa',
			buyer_postcode: '94103',
			buyer_tel: '4152879794',
			cancel_amount: 0,
			cancel_history: [],
			cancel_reason: null,
			cancel_receipt_urls: [],
			cancelled_at: 0,
			card_code: '374',
			card_name: '외환카드',
			card_number: '524242*********0',
			card_quota: 0,
			card_type: 1,
			cash_receipt_issued: false,
			channel: 'pc',
			currency: 'KRW',
			custom_data: null,
			customer_uid: null,
			customer_uid_usage: null,
			emb_pg_provider: null,
			escrow: false,
			fail_reason: null,
			failed_at: 0,
			imp_uid: 'imp_566377906932',
			merchant_uid: '00000901',
			name: 'Isaac Oppong-Baah',
			paid_at: 1666334556,
			pay_method: 'card',
			pg_id: 'INIpayTest',
			pg_provider: 'html5_inicis',
			pg_tid: 'StdpayCARDINIpayTest20221021154232890854',
			receipt_url: 'https://iniweb.inicis.com/DefaultWebApp/mall/cr/cm/mCmReceipt_head.jsp?noTid=StdpayCARDINIpayTest20221021154232890854&noMethod=1',
			started_at: 1666333377,
			status: 'paid',
			user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
			vbank_code: null,
			vbank_date: 0,
			vbank_holder: null,
			vbank_issued_at: 0,
			vbank_name: null,
			vbank_num: null
		}
	})
});

//Launch listening server on port 8080
app.listen(3000, ()=> {
  console.log('App listening on port 3000!')
})

module.exports = app;
