//const e = require("cors");
const moment = require('moment-timezone');
const db = require("./../../database");
const config = require('../../config');
const Helper = require("../../helpers");
var fileSys = config.PATH_SYS_CONFIG;
const fileCommissionVip = config.PATH_SYS_COMMISSION_VIP;
//const fs = require('fs');
const Web3 = require('web3');
const axios = require('axios');

var dataSys = Helper.getConfig(fileSys);
const Tele = require("../../auth/telegram_notify");
const {SEND_THONG_BAO} = require("../../auth/notifi");

const createAddressBTC = `https://api.blockcypher.com/v1/btc/main/addrs?token=${dataSys.tokenBlockcypher}`;
// 2000 request 1 ngày eth / btc
//const web3 = new Web3(new Web3.providers.WebsocketProvider(`https://api.blockcypher.com/v1/eth/main/addrs?token=${dataSys.tokenBlockcypher}`))

// 100k request 1 ngày ETH
const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/v3/${dataSys.projectId}`));

function makeid(length) {
    var result           = [];
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result.push(characters.charAt(Math.floor(Math.random() * 
        charactersLength)));
   }
   return result.join('');
}

Date.prototype.getWeek = function () {
    var target  = new Date(this.valueOf());
    var dayNr   = (this.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    var firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() != 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function getDateRangeOfWeek(weekNo){
    var d1 = new Date();
    numOfdaysPastSinceLastMonday = eval(d1.getDay()- 1);
    d1.setDate(d1.getDate() - numOfdaysPastSinceLastMonday);
    var weekNoToday = d1.getWeek();
    var weeksInTheFuture = eval( weekNo - weekNoToday );
    d1.setDate(d1.getDate() + eval( 7 * weeksInTheFuture ));
    var rangeIsFrom = eval(d1.getFullYear()+1) +"-" + d1.getMonth() + "-" + d1.getDate();
    d1.setDate(d1.getDate() + 6);
    var rangeIsTo = eval(d1.getFullYear()+1) +"-" + d1.getMonth() + "-" + d1.getDate() ;
    return rangeIsFrom + " to "+rangeIsTo;
};

function creatAccountUser(data){
    db.query(
        `select count(email) as countMail from account WHERE email = ?`,
        [data.email], (error, results, fields) => {
            if(error){
                return callback(error);
            }
            if(results[0].countMail > 0) return;

            // tạo tài khoản demo
            db.query(
                `insert into account (email, type, u_id, created_at)
                    values(?,0,?,now())`, 
                    [
                        data.email,
                        makeid(10)
                    ]
            );
            // tạo tài khoản thật
            db.query(
                `insert into account (email, type, u_id, created_at)
                    values(?,1,?,now())`, 
                    [
                        data.email,
                        makeid(10)
                    ]
            );
       }
   )
}

async function CongTienHoaHongVIP(email){
    // kiểm tra F1 của mình là ai để cộng tiền là 50% của 100$
    
    //var money = 100;
    // let reSys = fs.readFileSync(fileSys);
    // const redataSys = JSON.parse(reSys);

    // let currUse = redataSys.typeCurrUseSys.toLowerCase();

    let lsComm = Helper.getConfig(fileCommissionVip);
    
    // usdt 7 tầng
    let hhVip = lsComm;
    let refFrom, uplineID;
    //
	await new Promise((res, rej) => {
		db.query(
			`SELECT upline_id, ref_code, level_vip FROM users WHERE email = ?`,
			[
				email
			], (error, results, fields) => {
				refFrom = results[0].ref_code; //lấy ref code của mình mà người khác đăng ký
				uplineID = results[0].upline_id; //lấy ref id của họ mà mình đăng ký
				//let lvVip = results[0].level_vip;
				res();
			}
		) 
	})
	
	if(uplineID == null) return;

    // cộng tiền thẳng vào ví, + vào hoa hồng vip
    for(let u = 0; u < hhVip.length; u++){
        let amountDuocCong = hhVip[u].value*1;
		if(uplineID == null) break; // kết thúc
        db.query(
            `UPDATE users SET commission_vip = commission_vip + ?, money_usdt = money_usdt + ? where ref_code = ?`,
            [
                amountDuocCong,
                amountDuocCong,
                uplineID
            ], (error, results, fields) => {
                if(error){
                    return error;
                }
                // in vào lịch sử hoa hồng VIP
                // kiểm tra UPLINE ID của cấp trên
                
                db.query(
                    `INSERT INTO commission_history (email, ref_id, upline_id, vip_commission, type, status, created_at) 
                    VALUES (?,?,?,?,?,?,now())`,
                    [
                        email,
                        refFrom,
                        uplineID,
                        amountDuocCong,
                        'hhv', // hoa hồng vip
                        1,
                    ], (error, results, fields) => {
                        if(error){
                            console.log(error);
                            throw new Error(error);
                        }
                        db.query(
                        `SELECT upline_id, email, nick_name FROM users WHERE ref_code = ?`,
                        [
                            uplineID // ref id của thằng F1
                        ],(error, result, fields) => {
								if(!!result[0].upline_id){
									uplineID = result[0].upline_id; // ref id của F0
								}else{
									uplineID = null;
								}
                                SEND_THONG_BAO('vip', result[0].email, result[0].email, 'Thông báo hoa hồng VIP', `Cấp dưới (${result[0].nick_name}) vừa mua vip. Và bạn nhận được ${amountDuocCong}$ hoa hồng.`);
                                SEND_THONG_BAO('vip', email, email, 'Thông báo hoa hồng VIP', `Bạn vừa mua vip`);
                            }
                        )
                    }
                )
            }
        )
        await sleep(300);
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function GET_EMAIL_BY_NICKNAME(nick){
    return await new Promise((res, rej) => {
        db.query(
            `SELECT email FROM users WHERE nick_name = ?`,
            [
                nick
            ], (error, results, fields) => {
                res(results[0].email);
            })
    })
   
}

function formatPrice(value, minimum) {
    var formatter = new Intl.NumberFormat('en-US', {
        //style: 'currency',
        //currency: '',
        minimumFractionDigits: minimum
    });
    return formatter.format(value);
}


module.exports = {



    checkUserNickName: (nick, callback) => {
        db.query(
            `SELECT nick_name FROM users WHERE nick_name = ?`,
            [nick], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    createAccount: (data, callback) => {
        if(data.upline_id === ''){
            data.upline_id = null
        }
        let account = web3.eth.accounts.create();
        axios.post(createAddressBTC)
        .then((res) => {
            let adr = res.data
            db.query(
                `insert into users (email, nick_name, password, upline_id, ref_code, address_ETH, address_USDT, privateKey_ETH, privateKey_USDT, address_BTC, wif_BTC, privateKey_BTC, created_at)
                    values(?,?,?,?,?,?,?,?,?,?,?,?,now())`, 
                    [
                        data.email,
                        data.nick_name.toLowerCase().replace(/[^a-zA-Z0-9]+/g, "_"),
                        data.password,
                        data.upline_id,
                        makeid(7),
                        account.address,
                        account.address,
                        account.privateKey,
                        account.privateKey,
                        adr.address,
                        adr.wif,
                        adr.private,
                    ],
                   async (error, results, fields) => {
                        if(error){
                           return callback(error);
                        }
						Tele.sendMessThongBao(`🛫 Vừa thêm mới TÀI KHOẢN vào hệ thống: Email: <b>${data.email}</b>\nBiệt danh: ${data.nick_name}`);
                        return callback(null, results)
                    }
            );
           
        })
        
    },

    

    createUser: (data, callback) => {
        let account = web3.eth.accounts.create()
        axios.post(createAddressBTC)
        .then((res) => {
            let adr = res.data;
			
			
            db.query(
                `insert into users (ref_code, marketing, email, first_name, last_name, password, nick_name, address_ETH, address_USDT, privateKey_ETH, privateKey_USDT, address_BTC, wif_BTC, privateKey_BTC, level_vip, vip_user, active, created_at)
                    values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,now())`, 
                    [
                        makeid(7),
                        1,
                        data.email,
                        data.first_name,
                        data.last_name,
                        data.password,
                        data.nick_name,
                        account.address,
                        account.address,
                        account.privateKey,
                        account.privateKey,
                        adr.address,
                        adr.wif,
                        adr.private,
                        data.level_vip,
                        data.vip_user,
                        data.active
                    ],
                    (error, results, fields) => {
                        if(error){
                           return callback(error);
                        }
						creatAccountUser(data);
                        return callback(null, results)
                    }
            );
            
        })
    },

    checkUserEmail: (email, callback) => {
        db.query(
            `select email from users where email = ?`,
            [email], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    checkCodeSecure: (data, callback) => {
        db.query(
            `select email from users where email = ? and code_secure = ?`,
            [data.email, data.code_secure], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    checkActiveUser: (email, callback) => {
        db.query(
            `select active from users where email = ? and active = 1`,
            [email], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    getInfoUser: (data, callback) => {
        // db.query(
        //     `select 
        //     users.email,
        //     users.nick_name, 
        //     users.first_name, 
        //     users.last_name, 
        //     users.verified as verifi, 
        //     users.money_usdt as b, 
        //     users.vip_user as vip, 
        //     users.ref_code as ref, 
        //     users.id_front, 
        //     users.id_back, 
        //     users.active_2fa as 2fa, 
        //     users.language as 2fa, 
        //     account.* from users INNER JOIN account ON users.email = account.email WHERE users.email = ? AND account.type = 1`,
        //     [data.email], (error, results, fields) => {
        //         if(error){
        //             return callback(error);
        //          }
        //          return callback(null, results[0])
        //     }
        // )
        var dataList = []

        const redataSys = Helper.getConfig(fileSys);

        let currUse = redataSys.typeCurrUseSys.toLowerCase()

        db.query(
            `select 
            id,
            email,
            nick_name, 
            first_name, 
            last_name, 
            verified as verify, 
            money_${currUse} as balance,
            vip_user as vip, 
            ref_code as ref, 
            upline_id as upid,
            id_front, 
            id_back, 
            profile_image,
            active_2fa as fa2, 
            code_secure as num_secury,
            so_cmnd,
            pending_commission, 
            commission_vip, 
            level_vip,
            country as c,
            marketing as mkt, 
            language from users WHERE email = ?`,
            [data.email], (error, results, fields) => {
                if(error){
                    return callback(error);
                }

                dataList = results[0];

                db.query(
                `select balance, u_id, type FROM account WHERE email = ?`,
                [data.email], (error, results2, fields) => {
                    if(error){
                        return callback(error);
                    }
                    const order = [];
                    
                    results2.forEach(function(res) {
                        if (!res) return;
                        if(res.type === 0){
                            order[0] = res
                        }
                        if(res.type === 1){
                            order[1] = res
                        }
                        //order.push(res)
                    }) 
                    //console.log(order)
                    dataList['order'] = order;
                   
                    return callback(null, dataList)
                })
            }
        )
    },

    getAllUser: callback => {
        db.query(
            `SELECT * FROM users WHERE deleted_at IS NULL ORDER BY id DESC`,
            [], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    getUserById: (id, callback) => {
        db.query(
            `select * from users where id = ?`,
            [id], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results[0])
            }
        )
    },

    updateUserById: (data, callback) => {

        if(!!data.password){
            let qr = `update users set email = ?, nick_name = ?, first_name = ?, last_name = ?, vip_user = ?, level_vip = ?, password = ?, updated_at=now() where id = ?`;
            db.query(
                qr,
                [
                    data.email, 
                    data.nick_name, 
                    data.first_name, 
                    data.last_name,
                    data.vip_user,
                    data.level_vip,
                    data.password,
                    data.id
                ], (error, results, fields) => {
                    if(error){
                        return callback(error);
                     }
                     return callback(null, results)
                }
            )
            
        }else{
            let qr = `update users set email = ?, nick_name = ?, first_name = ?, last_name = ?, vip_user = ?, level_vip = ?, updated_at=now() where id = ?`;
            db.query(
                qr,
                [
                    data.email, 
                    data.nick_name, 
                    data.first_name, 
                    data.last_name,
                    data.vip_user,
                    data.level_vip,
                    data.id
                ], (error, results, fields) => {
                    if(error){
                        return callback(error);
                     }
                     return callback(null, results)
                }
            )
        }

    },

    updateInfoVerify: (data, callback) => {
        db.query(
            `update users set first_name=?, last_name=?, country=?, so_cmnd = ?, verified = 2 where email = ?`,
            [
                data.first_name, 
                data.last_name, 
                data.country, 
                data.cmnd,
                data.email
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 SEND_THONG_BAO('kyc', data.email, data.email, 'Xác minh danh tính đang chờ xử lý', `Xác minh danh tính của bạn đã được phê duyệt. Vui lòng đợi ít nhất 7 ngày làm việc.`);

                 Tele.sendMessThongBao(`📇📇📇Người dùng <b>${data.email}</b> vừa thực hiện xác minh tài khoản:\n
                    Số căn cước (CMT): <b>${data.cmnd}</b>
                    Họ tên: <b>${data.last_name} ${data.first_name}</b>
                 `);

                 return callback(null, results);
            }
        )
    },

    addMoneyMember: (data, callback) => {

        db.query(
            `UPDATE users SET money_usdt = money_usdt - ?, money_btc = money_btc - ?, money_eth = money_eth - ?, money_paypal = money_paypal - ?, money_vn = money_vn - ? WHERE nick_name = ?`,
            [
                data.aUSDT, 
                data.aBTC, 
                data.aETH, 
                data.aPAYPAL,
                data.aVND,
                data.nick
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
				 Tele.sendMessThongBao(`🧑ADMIN vừa thực hiện trừ tiền tới người dùng: <b>${data.nick}</b>\n
                    USDT: <b>-${data.aUSDT}</b>
                    BTC: <b>-${data.aBTC}</b>
                    ETH: <b>-${data.aETH}</b>
                    PAYPAL: <b>-${data.aPAYPAL}</b>
                    VNĐ: <b>-${data.aVND}</b>`);
                 return callback(null, results)
            }
        )
    },

    
    updateUserMoneyById: (data, callback) => {
        db.query(
            `update users set money_btc=money_btc+?, money_eth=money_eth+?, money_usdt=money_usdt+?, money_vn=money_vn+? where id = ?`,
            [
                data.money_btc, 
                data.money_eth, 
                data.money_usdt, 
                data.money_vn,
                data.id
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
      
                 db.query(`INSERT INTO add_money_history (email, nick_name, type, price_USDT, price_BTC, price_ETH, price_PAYPAL, price_VN, created_at) 
                 VALUES(?,?,?,?,?,?,?,?,now())`,
                 [
                     data.email,
                     data.nick_name,
                     data.type,
                     data.money_usdt, 
                     data.money_btc, 
                     data.money_eth,
                     data.money_paypal, 
                     data.money_vn,
                 ]);
				 Tele.sendMessThongBao(`🧑ADMIN vừa thực hiện thêm tiền tới người dùng: <b>${data.nick_name}</b>\n
                    USDT: <b>${data.money_usdt}</b>
                    BTC: <b>${data.money_btc}</b>
                    ETH: <b>${data.money_eth}</b>
                    PAYPAL: <b>${data.money_paypal}</b>
                    VNĐ: <b>${data.money_vn}</b>`);
					
                 return callback(null, results)
            }
        )
    },

    activeUser: (data, callback) => {
        db.query(
            `update users set active = 1, code_secure = ? where email = ?`,
            [
                makeid(4),
                data.email
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                creatAccountUser(data);
				Tele.sendMessThongBao(`🧑Tài khoản mới: <b>${data.email}</b> vừa kích hoạt thành công!`);
                return callback(null, results)
            }
        )
        
    },

    updateUserPasswordByEmail: (data, callback) => {
        db.query(
            `UPDATE users SET password = ? WHERE email = ?`,
            [
                data.password, 
                data.email
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                return callback(null, results)
            }
        )
    },


    deleteUserById: (id, callback) => {
        db.query(
            `UPDATE users SET active = 0, deleted_at = now() WHERE id = ?`,
            [id], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
        // db.query(
        //     `delete from users where id = ?`,
        //     [id], (error, results, fields) => {
        //         if(error){
        //             return callback(error);
        //          }
        //          return callback(null, results)
        //     }
        // )
    },

    getUserByUserEmail: (email, callback) => {
        db.query(
            `SELECT email, nick_name, password, active_2fa, secret_2fa, deleted_at FROM users WHERE email = ? OR username = ?`,
            [email, email], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(!!results[0].deleted_at){
                    return callback(null)
                }
                return callback(null, results[0])
            }
        )
    },

    getAdminByAdminUsername: (username, callback) => {
        db.query(
            `select email, nick_name, password from users where username = ? AND manage_supers = 1`,
            [username], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results[0])
            }
        )
    },


    verifiedAccount: (data, callback) => {
        db.query(
            `update users set verified = ? where id = ?`,
            [data.verified, data.id ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(data.verified){
                    db.query(
                        `SELECT email FROM users WHERE id = ?`,
                        [data.id ], (error, result, fields) => {
                            SEND_THONG_BAO('kyc', result[0].email, result[0].email, 'Xác minh danh tính thành công', `Danh tính của bạn đã được admin phê duyệt.`)
                            Tele.sendMessThongBao(`📇📇📇 Đã <i>BẬT</i> xác minh tài khoản cho người dùng <b>${result[0].email}</b>`);
                        })
                }
                return callback(null, results);
            }
        )
    },

    // get đại lý
    getListAgency: callback => {
        db.query(
            `select * from users where vip_user = 1 order by id desc`, 
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    viewMemberAgency: (id, callback) => {
        db.query(
            `select COUNT(upline_id) as totalPeopel from users where upline_id = ?`, 
            [id], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    reloadMoneyDemo: (email, callback) => {
        db.query(
            `update account set balance = 1000 where email = ? AND type = 0`,
            [
                email
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results)
            }
        )
    },

    checkMoneyUser: (email, callback) => {
        db.query(
            `select money_usdt as balance from users where email = ?`, 
            [
                email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results[0])
            }
        )
    },


    listHisBO: (email, callback) => {
        
        db.query(
            `select u_id from account where email = ? order by id desc`,
            [
                email
            ], (error, results, fields) => {
                
                var listAcc = []
                results.forEach(function(res) {
                    listAcc.push(res.u_id)
                }) 

                db.query(
                    `select 
                        buy_sell as bs,
                        currency as c,
                        type_account as t,
                        amount_win as aw,
                        amount_lose as al,
                        amount_bet as ab,
                        open as o,
                        close as cl,
                        created_at as d 
                        from bet_history where id_account = ? or id_account = ? and status = 1 order by id desc`,
                    [
                        listAcc[0],
                        listAcc[1]
                    ], (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }
                        return callback(null, results)
                    }
                )
            }
        )

        //
    },

    UsdtToLive: (data, callback) => {

        db.query(
            `select money_usdt from users where email = ?`,
            [
                data.email
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }

                if(results[0].money_usdt >= data.m){
                    
                    //=======
                    db.query(`update users set money_usdt = money_usdt - ? where email = ?`,
                        [
                            data.m,
                            data.email
                        ])
                    db.query(
                        `update account set balance = balance + ? where email = ? AND type = 1`,
                        [
                            data.m,
                            data.email
                        ], (error, results, fields) => {
                            if(error){
                                return callback(error);
                             }

                             //==== IN vào lịch sử

                            db.query(`insert into trade_history (email, from_u, to_u, type_key, type, currency, amount, note, status, created_at)
                            values(?,?,?,?,?,?,?,?,?,now())`,
                                [
                                    data.email,
                                    data.nick,
                                    'Live Account',
                                    'ctsa', // Chuyển Tiền
                                    'Chuyển tiền từ (Nội bộ) -> Live Account',
                                    'usdt',
                                    data.m,
                                    null,
                                    1
                                ])

                             return callback(null, results)
                        }
                    )
                }else{
                    return callback(null)
                }
            }
        )
    },

    LiveToUsdt: (data, callback) => {
    
        db.query(
            `select balance from account where email = ? AND type = 1`,
            [
                data.email
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }
                
                if(results[0].balance >= data.m){

                   

                    db.query(`update account set balance = balance - ? where email = ? AND type = 1`,
                        [
                            data.m,
                            data.email
                        ])
                    db.query(
                        `update users set money_usdt = money_usdt + ? where email = ?`,
                        [
                            data.m,
                            data.email
                        ], (error, results, fields) => {
                            if(error){
                                return callback(error);
                             }

                             //==== IN vào lịch sử

                            db.query(`insert into trade_history (email, from_u, to_u, type_key, type, currency, amount, note, status, created_at)
                            values(?,?,?,?,?,?,?,?,?,now())`,
                                [
                                    data.email,
                                    'Live Account',
                                    data.nick,
                                    'ctas', // Chuyển Tiền
                                    'Chuyển tiền từ Live Account -> (Nội bộ)',
                                    'usdt',
                                    data.m,
                                    null,
                                    1
                                ]) 

                            return callback(null, results)
                        }
                    )
                }else{
                    return callback(null)
                }
            }
        )
    },

    WithDrawalNoiBo: (data, callback) => {
		dataSys = Helper.getConfig(fileSys);
        db.query(
            `select money_usdt, verified from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }
				
				if(results[0].verified != 1){
                    return callback(null, {err: 10});
                }
				
                // phí rút 0 usdt
                let phi = dataSys.feeRutUSDTNoiBo;
                let tongPhi = Number(data.amS) + Number(phi);
   
                if(results[0].money_usdt >= tongPhi){
	
                    //======= Từ tiền tài khoản mình
                    db.query(`update users set money_usdt = money_usdt - ? where email = ?`,
                    [
                        tongPhi,
                        data.email
                    ])
                    Tele.sendMessRut(`🌟Người dùng ${data.nick_name} vừa thực hiện rút tiền NỘI BỘ tới Nick Name: ${data.address} với <b>$${data.amS}</b>.!`);
					
					SEND_THONG_BAO('rut', data.email, data.email, 'Rút tiền nội bộ', `-Số lượng: <b>${formatPrice(data.amS, 2)} USDT</b><br>-Người nhận: <b>${data.address}</b>`);
                    GET_EMAIL_BY_NICKNAME(data.address)
                    .then((email) => {
                        SEND_THONG_BAO('nap', email, email, 'Nạp tiền nội bộ', `-Số lượng: <b>${formatPrice(data.amS, 2)} USDT</b><br>-Người gửi: <b>${data.nick_name}</b>`)
                    })
					
                    //======= cộng tiền vào tài khoản người khác
                    db.query(`update users set money_usdt = money_usdt + ? where nick_name = ?`,
                    [
                        Number(data.amS),
                        data.address
                    ], (error, results, fields) => {
                        if(error){
                            return callback(error);
                         }
		
                         //==== IN vào lịch sử

                        db.query(
                            `insert into trade_history (name,pay_fee, email, from_u, to_u, type_key, type, currency, amount, note, status, created_at) 
                            values (?,?,?,?,?,?,?,?,?,?,now())`,
                        [
                            data.noteName,
                            phi,
                            data.email,
                            data.nick_name,
                            data.address,
                            'rt', // Rút Tiền
                            'Rút tiền (Nội bộ) tới '+data.address,
                            'usdt',
                            data.amS,
                            data.gc,
                            1
                        ], (error, results, fields) => {
                            if(error){
                                return callback(error);
                             }
                        })

                         return callback(null, results)
                    })
                }else{
                    return callback(null)
                }
            })
    },
    
    WithDrawalERC: (data, callback) => {
		dataSys = Helper.getConfig(fileSys);
		
        db.query(
            `select money_usdt from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }
                // phí rút usdt
                let phi = dataSys.feeRutETHERC20;
                let tongPhi = Number(data.amS) + Number(phi);
                if(results[0].money_usdt >= tongPhi){
                      //======= Từ tiền tài khoản mình
                      db.query(`update users set money_usdt = money_usdt - ? where email = ?`,
                      [
                          tongPhi,
                          data.email
                      ], (error, results, fields) => {
                         if(error){
                             return callback(error);
                          }

                    
                          Tele.sendMessRut(`🌟Người dùng ${data.nick_name} vừa thực hiện rút tiền ERC20 tới: ${data.address} với <b>$${data.amS}</b>. Vui lòng kiểm tra!`);
                          Tele.sendMessRut(`ARES-CHECK check ${data.nick_name}`);

                          //==== IN vào lịch sử
                         db.query(`insert into trade_history (email, from_u, to_u, type_key, type, currency, amount, note, status, network, created_at)
                         values(?,?,?,?,?,?,?,?,?,?,now())`,
                             [
                                data.email,
                                data.nick_name,
                                data.address,
                                'rt', // Rút Tiền
                                'Rút tiền ERC20',
                                'usdt',
                                data.amS,
                                data.gc,
                                0,
                                data.nw
                             ], (error, results, fields) => {
                                Tele.sendMessRut(`ARES-ACCPET rut ${results.insertId}`);
                            })
 
                          return callback(null, results)
                     })
                }else{
                    return callback(null)
                }
            })
    },

    WithDrawalBSC: (data, callback) => {
		dataSys = Helper.getConfig(fileSys);
		console.log(data)
        db.query(
            `select money_usdt, verified from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }

				if(results[0].verified != 1){
                    return callback(null, {err: 10});
                }
				
                // phí rút usdt
                let phi = Number(dataSys.feeRutUSDTBEP20);
                
                let tongPhi = Number(data.amS) + phi;
                if(results[0].money_usdt >= tongPhi){
                      //======= Trừ tiền tài khoản mình
                      db.query(`UPDATE users SET money_usdt = money_usdt - ? WHERE email = ?`,
                      [
                          tongPhi,
                          data.email
                      ], (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }

                        Tele.sendMessRut(`🌟Người dùng ${data.nick_name} vừa thực hiện rút tiền BEP20 về Ví: ${data.address} với <b>$${data.amS}</b>. !\nSử dụng lệnh dưới vào BOT để thực hiện lệnh KIỂM TRA và RÚT:`);
                        Tele.sendMessRut(`ARES-CHECK check ${data.nick_name}`);
						
						GET_EMAIL_BY_NICKNAME(data.nick_name)
                        .then((email) => {
                            SEND_THONG_BAO('rut', data.email, email, 'Rút tiền BEP20', `-Số lượng: <b>${formatPrice(data.amS, 2)} USDT</b>`)
                        })

                        //==== IN vào lịch sử
                        db.query(`insert into trade_history (name,email, from_u, to_u, type_key, type, currency, amount, note, status, network, fee_withdraw, created_at)
                        values(?,?,?,?,?,?,?,?,?,?,?,?,now())`,
                            [
                                data.noteName,
                                data.email,
                                data.nick_name,
                                data.address,
                                'rt', // Rút Tiền
                                'Rút tiền BEP20 (BSC) về Ví: '+ data.address,
                                'usdt',
                                data.amS,
                                data.gc,
                                0,
                                data.nw,
                                phi
                            ], (error, results, fields) => {
                                Tele.sendMessRut(`ARES-ACCPET rut ${results.insertId}`);
                            })

                        return callback(null, results)
                     })
                }else{
                    return callback(null)
                }
            })
    },

    WithDrawalVND: (data, callback) => {
		dataSys = Helper.getConfig(fileSys);
		
        db.query(
            `select money_usdt, verified from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }

				if(results[0].verified != 1){
                    return callback(null, {err: 10});
                }
                
                const tongPhi = Number(data.amS);
                if(results[0].money_usdt >= tongPhi){
                      //======= Trừ tiền tài khoản mình
                      db.query(`UPDATE users SET money_usdt = money_usdt - ? WHERE email = ?`,
                      [
                          tongPhi,
                          data.email
                      ], (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }

                        Tele.sendMessRut(`🌟Người dùng ${data.nick_name} vừa thực hiện rút tiền VNĐ\nSử dụng lệnh dưới vào BOT để thực hiện lệnh KIỂM TRA và RÚT:`);
                        Tele.sendMessRut(`ARES-CHECK check ${data.nick_name}`);
						
						GET_EMAIL_BY_NICKNAME(data.nick_name)
                        .then((email) => {
                            SEND_THONG_BAO('rut', data.email, email, 'Rút tiền VNĐ', `-Số lượng: <b>${formatPrice(data.amS, 2)} USDT</b>`)
                        })

                        /**
                         * note user | tên ngân hàng | chi nhánh ngân hàng | số tài khoản | chủ tài khoản
                         */
                        const bankNote = `${data.tenNganHang}|${data.chiNhanhNganHang}|${data.soTaiKhoan}|${data.chuTaiKhoan}`;

                        //==== IN vào lịch sử
                        db.query(`insert into trade_history (email, from_u, type_key, type, currency, amount, real_amount, bank, note, status, created_at)
                        values(?,?,?,?,?,?,?,?,?,?,now())`,
                            [
                                data.email,
                                data.nick_name,
                                'rt', // Rút Tiền
                                'Rút tiền về VNĐ',
                                'vnd',
                                data.amS,
                                data.amR,
                                bankNote,
                                data.gc,
                                0,
                            ], (error, results, fields) => {
                                Tele.sendMessRut(`ARES-ACCPET rut ${results.insertId}`);
                            })

                        return callback(null, results)
                     })
                }else{
                    return callback(null)
                }
            })
    },
    
    WithDrawalPaypalAc: (data, callback) => {
        db.query(
            `select money_paypal from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }
                // phí rút usd
                let phi = dataSys.feeRutPaypalAcc;
                let tongPhi = Number(data.amS) + Number(phi)
                if(results[0].money_paypal >= tongPhi){
                      //======= Từ tiền tài khoản mình
                      db.query(`update users set money_paypal = money_paypal - ? where email = ?`,
                      [
                          tongPhi,
                          data.email
                      ], (error, results, fields) => {
                         if(error){
                             return callback(error);
                          }
                          //==== IN vào lịch sử
                         db.query(`insert into trade_history (from_u, to_u, type_key, type, currency, amount, note, status, created_at)
                         values(?,?,?,?,?,?,?,?,now())`,
                             [
                                data.nick_name,
                                data.address,
                                'rt', // Rút Tiền
                                'Rút tiền tài khoản Paypal',
                                'usd',
                                data.amS,
                                data.gc,
                                1
                             ])
 
                          return callback(null, results)
                     })
                }else{
                    return callback(null)
                }
            })
    },

    WithDrawalPaypalNB: (data, callback) => {
        db.query(
            `select money_paypal from users where email = ? AND nick_name = ?`,
            [
                data.email,
                data.nick_name
            ], (error, results, fields) => {
            
                if(error){
                    return callback(error);
                }
                // phí rút 0 usdt
                let phi = dataSys.feeRutPaypalNoiBo;
                let tongPhi = Number(data.amS) + Number(phi);

                if(results[0].money_paypal >= tongPhi){
                    //======= Từ tiền tài khoản mình
                    db.query(`update users set money_paypal = money_paypal - ? where email = ?`,
                    [
                        tongPhi,
                        data.email
                    ])
                    //======= cộng tiền vào tài khoản người khác
                    db.query(`update users set money_paypal = money_paypal + ? where nick_name = ?`,
                    [
                        Number(data.amS),
                        data.nick
                    ], (error, results, fields) => {
                        if(error){
                            return callback(error);
                         }

                         //==== IN vào lịch sử

                        db.query(
                            `insert into trade_history (from_u, to_u, type_key, type, currency, amount, note, status, created_at) 
                            values (?,?,?,?,?,?,?,?,now())`,
                        [
                            data.nick_name,
                            data.nick,
                            'rt', // Rút Tiền
                            'Rút tiền Paypal (Nội bộ)',
                            'usd',
                            data.amS,
                            data.gc,
                            1
                        ], (error, results, fields) => {
                            if(error){
                                return callback(error);
                             }
                        })

                         return callback(null, results)
                    })
                }else{
                    return callback(null)
                }
            })
    },

    BalanceWallet: (email, callback) => {
        db.query(
            `select 
                money_usdt as usdt,
                money_eth as eth,
                money_btc as btc,
                money_paypal as paypal 
                from users where email = ?`, 
            [
                email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                 return callback(null, results[0])
            }
        )
    },

    BankInfo: (callback) => {
        const redataSys = Helper.getConfig(fileSys);
        return callback(null, redataSys.bankInfo || '');
    },

    DepositToWallet: (data, callback) => {

        const redataSys = Helper.getConfig(fileSys);

        let currUse = redataSys.typeCurrUseSys.toLowerCase()
        let money = 0
        if(currUse == 'usdt' || currUse == 'paypal'){
            money = data.m 
        }else if(currUse == 'eth'){
            money = data.m * currUse.quotePriceETH
        }else if(currUse == 'btc'){
            money = data.m * currUse.quotePriceBTC
        }

        // money là tổng nhận
        // data.mlaf số tiền nhập
   
        // nạp nhanh
        if(!!money && money >= 11){

            db.query(
                `update users set money_${currUse} = money_${currUse} - ? where email = ?`, 
                [
                    data.m,
                    data.email
                ],
                (error, results, fields) => {
                    if(error){
                        return callback(error);
                     }

                     //update vào tài khoản thật
                     db.query(`update account set balance = balance + ? where email = ? and type = 1`, [money, data.email])

                      //==== IN vào lịch sử
                      db.query(`insert into trade_history (email, from_u, to_u, type_key, type, currency, amount, note, status, created_at)
                      values(?,?,?,?,?,?,?,?,?,now())`,
                        [
                            data.email,
                            data.nick,
                            data.uidLive,
                            'nn', // Nạp nhanh
                            `Nạp nhanh ${currUse.toUpperCase()} -> Live Account`,
                            currUse,
                            data.m,
                            data.gc,
                            1
                        ])

                     return callback(null, results)
                }
            )
            
           
        }else{
            return callback(null, [])
        }
    },

    UserBuyVIP: (data, callback) => {
        
        const redataSys = Helper.getConfig(fileSys);

        let currUse = redataSys.typeCurrUseSys.toLowerCase()
        let money = 0
        if(currUse == 'usdt' || currUse == 'paypal'){
            money = data.amount
        }else if(currUse == 'eth'){
            money = data.amount / currUse.quotePriceETH
        }else if(currUse == 'btc'){
            money = data.amount / currUse.quotePriceBTC
        }

        db.query(
            `update users set money_${currUse} = money_${currUse} - ?, vip_user = 1, level_vip = 1 where email = ?`, 
            [
                money,
                data.email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                 //==== IN vào lịch sử
                db.query(`insert into trade_history (email, from_u, to_u, type_key, type, currency, amount, note, status, created_at)
                values(?,?,?,?,?,?,?,?,?,now())`,
                [
                    data.email,
                    data.nick,
                    data.nick,
                    'mv', // Mua Vip
                    'Mua thành viên VIP',
                    currUse,
                    data.amount,
                    '',
                    1
                ], (error, results, fields) => {
                    if(error){
                        return callback(error);
                    }

                    // chia tiền Hoa Hồng VIP cho F1 của mình 50%
                    // kiểm tra ai là f1 của mình
                    CongTienHoaHongVIP(data.email)
                })
                return callback(null, results)
            }
        )
        
    },


    getNguoiGioiThieu: async (email, callback) => {
        let obj = {
            nick: '', // tên người giới thệu
            tsdl: 0, // tổng số đại lý
            tsngd: 0, // tổng số nhà giao dịch
            hhdl: 0, // Hoa hồng đại lý
            hhgd: 0, // hoa hồng giao dịch
            hhttisMe: 0, // hoa hồng tuần của f1 đại lý
            tsdlisMe: 0, // tổng số đại lý
            tslgdCD1: 0, // tổng số lượng giao dịch tháng này
            tslgdCD2: 0, // tổng số lượng giao dịch tháng 2
            tslgdCD3: 0, // tổng số lượng giao dịch tháng 3
            tslgdCD4: 0, // tổng số lượng giao dịch tháng 4
            t1: '',
            t2: '',
            t3: '',
            t4: '',
        }, upline_id = '', refForMe = '', lvVip = 0;

        await new Promise((resolve, reject)=>{
            // lấy tên người f1 mà chính mình đã đăng ký
            db.query(
                `SELECT upline_id, ref_code, level_vip, pending_commission AS hhforme, commission_vip AS hhdl FROM users WHERE email = ?`, 
                [
                    email
                ],
                (error, results, fields) => {
                    if(error){
                        resolve([]);
                    }

                    upline_id = results[0].upline_id ? results[0].upline_id : '';
                    refForMe = results[0].ref_code
                    lvVip = results[0].level_vip
					// obj.hhgd = results[0].hhforme
					obj.hhdl = results[0].hhdl
					
                    resolve();
                })
        })

        // Lấy hoa hồng giao dịch VIP của các F dưới tháng này
        await new Promise((resolve, reject) => {
            db.query(
                `select 
                SUM(pending_commission) AS hhgd,
                SUM(vip_commission) AS thhvip,
                SUM(personal_trading_volume) AS tslgdCD
                FROM commission_history WHERE ((upline_id = ? AND type = ?) OR (ref_id = ? AND type = ?)) AND MONTH(created_at) = MONTH(NOW())`, 
                [
                    refForMe,
                    'hhv',
                    refForMe,
                    'klgd',
                ],(error, results, fields) => {
                if(error){
                    resolve([]);
                }
				obj.hhgd = results[0].hhgd || 0;
                obj.tshhmtn = (results[0].thhvip || 0) + obj.hhgd;
                obj.tslgdCD1 = results[0].tslgdCD || 0;
                resolve();
            })
        });
		

		if(upline_id !== ''){
			await new Promise((resolve, reject)=>{
            // nếu tồn tại F0 của mình 
            db.query(
                `SELECT nick_name FROM users WHERE ref_code = ?`,
                [upline_id], (error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
					
                    obj.nick = results[0].nick_name
                    //==================================================
                    resolve();
                    //return callback(null, obj)
                })
            
			})
		}else{
			upline_id = '-------';
		}
        
		
        //========== TỔNG SỐ NHÀ GIAO DỊCH
        let listData = {
			"cap1": [],
			"cap2": [],
			"cap3": [],
			"cap4": [],
			"cap5": [],
			"cap6": [],
			"cap7": [],
			"cap8": [],
			"cap9": [],
			"cap10": [],
			"cap11": [],
			"cap12": [],
			"cap13": [],
			"cap14": [],
			"cap15": []
		};


        let cap1 = false, cap2 = false, cap3 = false, cap4 = false, cap5 = false, cap6 = false, cap7 = false, cap8 = false;
        // lấy cấp 1
        await new Promise((res, rej) => {
            db.query(
                `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                [
                    refForMe
                ], (error, result, fields) => {
                    if(result.length > 0){
                        result.forEach((ele) => {
                            listData['cap1'].push(ele);
							cap1 = true;
                        })
                    }
                    res();
                }
            )
        })
        
        if(cap1){
            for(let i = 0; i < listData['cap1'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap1'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap2'].push(ele);
                            });
                            cap2 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap2){
            for(let i = 0;  i < listData['cap2'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap2'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap3'].push(ele);
                            }); 
                            cap3 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }
	
        if(cap3){
            for(let i = 0;  i < listData['cap3'].length; i++){
			
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap3'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap4'].push(ele);
                            });
                            cap4 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap4){
            for(let i = 0;  i < listData['cap4'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap4'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap5'].push(ele);
                            });
                            cap5 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap5){
            for(let i = 0;  i < listData['cap5'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap5'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap6'].push(ele);
                            });
                            cap6 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap6){
            for(let i = 0;  i < listData['cap6'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap6'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap7'].push(ele);
                            });
                            cap7 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap7){
            for(let i = 0;  i < listData['cap7'].length; i++){
                db.query(
                    `SELECT ref_code, vip_user FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap8'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap8'].push(ele);
                            });
                            cap8 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        let TSNGD = 0, TSDL = 0;
        for(let l in listData){
            let d = listData[l];
			if(d.length > 0){
				TSNGD += d.length;
				for(let i = 0; i < d.length; i++){
					if(d[i].vip_user == 1) TSDL++;
				}
			}
        }

        obj.tsngd = TSNGD;
        obj.tsdl = TSDL;


        //==================================

        // await new Promise((resolve, reject)=>{
        //     // lấy danh sách thành viên đã đăng ký link giới thiệu ( tổng số nhà giao dịch )

        //     db.query(
        //         `select COUNT(upline_id) AS tsngd FROM users WHERE upline_id = ?`, 
        //         [
        //             refForMe
        //         ],(error, results, fields) => {
        //             if(error){
        //                 resolve([]);
        //             }

        //             if(results[0]){
        //                 obj.tsngd = results[0].tsngd
        //                 //obj.hhgd = results[0].hhgd + com_for_me
        //             }
        //             resolve();
        //     })
        //     // kết thúc 

            
            
        // })
        // await new Promise((resolve, reject)=>{
        //     // tổng số đại lý ( đã mua vip )
        //     db.query(
        //         `SELECT COUNT(vip_user) AS tsdl FROM users WHERE upline_id = ? AND vip_user = 1`, 
        //         [
        //             refForMe
        //         ],(error, results, fields) => {
        //             if(error){
        //                 resolve([]);
        //             }

        //             if(results[0]){
        //                 obj.tsdl = results[0].tsdl
        //             }
        //             resolve();
        //     })
        //     // kết thúc 

           
        // })
		
		//await new Promise((resolve, reject)=>{
        //    // tổng số đại lý ( đã mua vip )
        //    db.query(
        //        `select commission_vip AS hhdl FROM users WHERE ref_code = ?`, 
        //        [
        //            refForMe
        //        ],(error, results, fields) => {
        //            if(error){
        //                resolve([]);
        //            }
//
         //           if(results[0]){
         //               obj.hhdl = results[0].hhdl
         //           }
         //           resolve();
         //   })
            // kết thúc 

           
        //})
        
        // của bản thân mình
        //==============================
        //==============================
        //==============================
        let listAgent = await new Promise((resolve, reject)=>{
            // tổng số đại lý ( đã mua vip ) của bản thân
			// AND vip_user = ?
            db.query(
                `SELECT email FROM users WHERE upline_id = ? AND vip_user = ?`, 
                [
                    refForMe,
                    1
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    if(results[0]){
                        obj.tsdlisMe = results.length
                    }
                    resolve(results);
            })
          
        })


        await new Promise((resolve, reject)=>{
            // tổng số hoa hồng đại lý của bản thân tuần này
            let min = 0;
            let max = listAgent.length;
            if(max == 0) resolve();
            let totalDLVip = obj.tsdlisMe
            listAgent.forEach(function(item){
                //SELECT SUM(personal_trading_volume) AS hhttisMe FROM commission_history WHERE upline_id = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW())
                db.query(
                     `SELECT SUM(amount_bet) AS hhttisMe FROM bet_history WHERE email = ? AND type_account = ? AND marketing = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW())`, 
                    [
                        item.email, // mã của f1 đại lý
                        1, 
                        0
                        //refForMe,
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        if(!!results[0].hhttisMe){
                            min++;
                            let hhTuanNay = obj.hhttisMe += results[0].hhttisMe;
                            // UPDATE vip level nếu đủ tổng hoa hồng
                            if(lvVip <= 8){
                                if(totalDLVip == 3 && hhTuanNay >= 2000){
                                    db.query(`UPDATE users SET level_vip = 2 WHERE ref_code = ?`, [refForMe])
                                }else if(totalDLVip == 4 && hhTuanNay >= 4000){
                                    db.query(`UPDATE users SET level_vip = 3 WHERE ref_code = ?`, [refForMe])
                                }else if(totalDLVip == 5 && hhTuanNay >= 8000){
                                    db.query(`UPDATE users SET level_vip = 4 WHERE ref_code = ?`, [refForMe])
                                }else if(totalDLVip == 6 && hhTuanNay >= 16000){
                                    db.query(`UPDATE users SET level_vip = 5 WHERE ref_code = ?`, [refForMe])
                                }else if(totalDLVip == 7 && hhTuanNay >= 32000){
                                    db.query(`UPDATE users SET level_vip = 6 WHERE ref_code = ?`, [refForMe])
                                }else if(totalDLVip == 8 && hhTuanNay >= 64000){
                                    db.query(`UPDATE users SET level_vip = 7 WHERE ref_code = ?`, [refForMe])
                                } else if(totalDLVip == 9 && hhTuanNay >= 128000){
                                    db.query(`UPDATE users SET level_vip = 8 WHERE ref_code = ?`, [refForMe])
                                }
                            }
                            if(min == max) resolve();
                        }else{
                            resolve();
                        }
                    })
           });


        })
        // kết thúc 
        //==============================
        //==============================
        //==============================
        // lấy tổng số lượng giao dịch cấp dưới 4 tháng
        let currentDate = new Date()
        //let thangnay =  new Date(currentDate.getFullYear(), currentDate.getMonth() + 1) 
        let cach1thang =  new Date(currentDate.getFullYear(), currentDate.getMonth()) 
        let cach2thang =  new Date(currentDate.getFullYear(), currentDate.getMonth() - 1) 
        let cach3thang =  new Date(currentDate.getFullYear(), currentDate.getMonth() - 2) 
        let cach4thang =  new Date(currentDate.getFullYear(), currentDate.getMonth() - 3) 



        obj.t1 = cach1thang
        obj.t2 = cach2thang
        obj.t3 = cach3thang
        obj.t4 = cach4thang

        await new Promise((resolve, reject)=>{
            // Tổng số nhà giao dịch mới tháng này
            db.query(
                `select 
                SUM(personal_trading_volume) AS tslgdCD, 
                COUNT(personal_trading_volume) AS tslgdMoi,
                COUNT(pending_commission) AS tshhMoi 
                FROM commission_history WHERE upline_id = ? AND MONTH(created_at) = MONTH(NOW())`, 
                [
                    refForMe
                ],(error, results, fields) => {
                if(error){
                    resolve([]);
                }
                    obj['tslgdmtn'] = results[0].tslgdMoi || 0;
                    // obj['tshhmtn'] = results[0].tshhMoi || 0;
                resolve();
            })

            
        })
        await new Promise((resolve, reject)=>{
            // Tổng số nhà giao dịch mới tháng trước
            db.query(
                `select 
                SUM(personal_trading_volume) AS tslgdCD,
                COUNT(personal_trading_volume) AS tslgdMoi,
                COUNT(pending_commission) AS tshhMoi 
                FROM commission_history WHERE upline_id = ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                [
                    refForMe
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj['tslgdmtt'] = results[0].tslgdMoi || 0;
                    obj['tshhmtt'] = results[0].tshhMoi || 0;
                    resolve();
            })
           
        })
        // let uIdAccount = await new Promise((resolve, reject)=>{
        //     // get account name
        //     db.query(
        //         `SELECT u_id FROM account WHERE email = ? AND type = 1`, 
        //         [
        //             email
        //         ],
        //         (error, results, fields) => {
        //             if(error){
        //                 return callback(error);
        //             }
        //             resolve(results[0].u_id);
        //         })
        // })

        // await new Promise((resolve, reject)=>{
        //     // tổng số lượng giao dịch cấp dưới tháng này
        //     //SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE from_upid = ? AND ref_id = ? AND MONTH(created_at) = MONTH(NOW())
        //     db.query(
        //         `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW())`, 
        //         [
        //             //uIdAccount,
        //             refForMe,
        //             'klgd'
        //         ],(error, results, fields) => {
        //             if(error){
        //                 resolve([]);
        //             }
        //             obj.tslgdCD1 = results[0].tslgdCD || 0;
        //             resolve();
        //     })
            
        // })
        await new Promise((resolve, reject)=>{
            // tổng số lượng giao dịch cấp dưới cách 1 tháng

            db.query(
                `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                [
                    //uIdAccount,
                    refForMe,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD2 = results[0].tslgdCD || 0;
                    resolve();
            })
            
        })
        await new Promise((resolve, reject)=>{
            
            // tổng số lượng giao dịch cấp dưới cách 2 tháng

            db.query(
                `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 2`, 
                [
                    //uIdAccount,
                    refForMe,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD3 = results[0].tslgdCD || 0;
                    resolve();
            })
            
           
        })
        await new Promise((resolve, reject)=>{
            // cách 3 tháng
            db.query(
                `select SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 3`, 
                [
                    //uIdAccount,
                    refForMe,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD4 = results[0].tslgdCD || 0;
                    resolve();
            })
           
        })
        
        await new Promise((resolve, reject)=>{
            // lấy tổng số đại lý mới f1 của mình tháng này
            db.query(
                `select 
                COUNT(nick_name) AS totalNewDL 
                from users where upline_id = ? AND vip_user = 1 AND marketing = ? AND MONTH(created_at) = MONTH(NOW())`,
            [
                refForMe,
                0
            ], (error, results, fields) => {
                if(error){
                    resolve([]);
                }
                obj['tsdlmtn'] = results[0].totalNewDL || 0;
                resolve();
            })
            
        })
        await new Promise((resolve, reject)=>{
            // lấy tổng số đại lý mới f1 của mình tháng trước
            db.query(
                `select 
                COUNT(nick_name) AS totalNewDL 
                from users where upline_id = ? AND vip_user = 1 AND marketing = ? AND MONTH(created_at) = MONTH(NOW()) - 1`,
            [
                refForMe,
                0
            ], (error, results, fields) => {
                if(error){
                    resolve([]);
                }
                obj['tsdlmtt'] = results[0].totalNewDL || 0;
                resolve();
            })
            
        })
         //================================================
        // Tháng này
        await new Promise((resolve, reject)=>{
             // tổng số nhà giao dịch mới
			 //`select COUNT(personal_trading_volume) AS tsngdMoi FROM commission_history WHERE upline_id = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ?`, 
            for(let a = 0; a < 4; a++){
                db.query(
                    `select COUNT(id) AS tsngdMoi 
                    FROM users WHERE upline_id = ? AND marketing = ? AND pricePlay > 0 AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ?`, 
                    [
                        refForMe,
                        0, 
                        a
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                    obj['tsngdMoi'+a] = results[0].tsngdMoi || 0;
					if(a === 3) resolve();	
                })
                
            }
        })
        await new Promise((resolve, reject)=>{
             // tổng số đại lý mới hôm nay 
            for(let b = 0; b < 4; b++){
                db.query(
                    `select 
                    COUNT(vip_user) AS tsdlMoi 
                    FROM users WHERE upline_id = ? AND vip_user = 1 AND marketing = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ?`, 
                    [
                        refForMe,
                        0,
                        b
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        obj['tsdlMoi'+b] = results[0].tsdlMoi || 0;
						if(b === 3) resolve();
                })
                
            }
        })
        await new Promise((resolve, reject)=>{
            // tổng số hoa hồng mới hôm nay 
            for(let c = 0; c < 4; c++){
                db.query(
                    `select 
                    COUNT(pending_commission) AS tshhMoi 
                    FROM commission_history WHERE upline_id = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ?`, 
                    [
                        refForMe,
                        c
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        obj['tshhMoi'+c] = results[0].tshhMoi || 0;
						if(c === 3) resolve();

                })
                
            }
        })
         //================================================
        // Tháng trước
        await new Promise((resolve, reject)=>{
            // tổng số nhà giao dịch mới tháng trước
            //select 
            //COUNT(personal_trading_volume) AS tsngdMoi 
            //FROM commission_history WHERE upline_id = ?
            for(let d = 0; d < 4; d++){
                db.query(
                    `select COUNT(id) AS tsngdMoi 
                    FROM users WHERE upline_id = ? AND marketing = ? AND pricePlay > 0 AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                    [
                        refForMe,
                        0,
                        d
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        obj['tsngdTTMoi'+d] = results[0].tsngdMoi || 0;
						if(d === 3) resolve();
                })
                
            }
        })
        await new Promise((resolve, reject)=>{
            // tổng số đại lý mới tháng trước
            for(let f = 0; f < 4; f++){
                db.query(
                    `select 
                    COUNT(vip_user) AS tsdlMoi 
                    FROM users WHERE upline_id = ? AND vip_user = 1 AND marketing = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                    [
                        refForMe,
                        0,
                        f
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        obj['tsdlTTMoi'+f] = results[0].tsdlMoi || 0;
						if(f === 3) resolve();
                })
                
            }
        })
        await new Promise((resolve, reject)=>{
            // tổng số hoa hồng mới tháng trước
            for(let g = 0; g < 4; g++){
                db.query(
                    `select 
                    COUNT(pending_commission) AS tshhMoi 
                    FROM commission_history WHERE upline_id = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) - ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                    [
                        refForMe,
                        g
                    ],(error, results, fields) => {
                        if(error){
                            resolve([]);
                        }
                        obj['tshhTTMoi'+g] = results[0].tshhMoi || 0;
						if(g === 3) resolve();
                })
               
            }
            
        })
        
        return callback(null, obj);
    },


    getBoStatistics: async (email, callback) => {
        // lấy tài khoản thực của email
        
        var obj = {
            //bet_amount: order_amount,
            down:0, // số lần sell
            down_rate:0, // tỉ lệ sell

            lose: 0,
            profits: 0, // lợi nhuận rồng
            refund: 0, // hoàn tiền           
            revenue: 0, // tổng doanh thu

            trades: 0, // tổng tiền giao dịch


            up:0, // số lần buy
            up_rate:0, // tỉ lệ buy

            win: 0,
            win_rate: 0
        }, uid = 0;
        await new Promise((resolve, reject)=>{
            db.query(
                `select * from account where email = ? and type = 1`, 
                [
                    email
                ],
                (error, results, fields) => {
                    if(results.length == 0){
                        //return callback(null);
                        resolve()
                    }
                    let rs =  results[0];
                    uid = rs.u_id;
        
                    let win = rs.win;
                    let lose = rs.lose;
                    //let withdrawal = results[0].withdrawal
                    //let deposit = results[0].deposit
                    let order_amount = rs.order_amount;
    
                    let total = win + lose;
    
                    let rateWin = (win/total)*100;
    
                    obj.profits = win - lose; // lợi nhuận rồng   
                    obj.revenue = win; // tổng doanh thu
    
                    obj.trades = order_amount; // tổng tiền giao dịch
                    obj.win_rate = rateWin
                    resolve();
                })
        })
		if(uid == 0){
            return callback(null);
        }
        await new Promise((resolve, reject)=>{
            // lấy tổng lần đánh thắng, thua
            db.query(
                `SELECT 
                COUNT(amount_win) AS totalWin
                FROM bet_history WHERE id_account = ? AND type_account = 1 AND amount_win > 0`, 
                [
                    uid
                ],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.win = result[0].totalWin
                    resolve();
            })
        })
        await new Promise((resolve, reject)=>{
            db.query(
                `SELECT 
                COUNT(amount_lose) AS totalLose
                FROM bet_history WHERE id_account = ? AND type_account = 1 AND amount_lose > 0`, 
                [
                    uid
                ],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.lose = result[0].totalLose
                    resolve();
                })
    
        })
        await new Promise((resolve, reject)=>{
            db.query(
                `SELECT 
                COUNT(buy_sell) AS totalBUY
                FROM bet_history WHERE id_account = ? AND buy_sell = ? AND type_account = 1`, 
                [
                    uid,
                    'buy'
                ],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    obj.up = result[0].totalBUY
                    resolve();
                })
        })
        await new Promise((resolve, reject)=>{
            db.query(
                `SELECT 
                COUNT(buy_sell) AS totalSell
                FROM bet_history WHERE id_account = ?  AND buy_sell = ? AND type_account = 1`, 
                [
                    uid,
                    'sell'
                ],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.down = result[0].totalSell

                    let tt = obj.up + obj.down

                    let rateUp = (obj.up/tt)*100
    
                    obj.up_rate = rateUp
                    resolve();
            }) 
        })
    
        return callback(null, obj);
    },

    getBoStatisticsCurrentDay: async (email, callback) => {
        const obj = {
            win: 0,
            lose: 0,
        };
        await new Promise((resolve, reject)=>{
            // lấy tổng lần đánh thắng, thua
            db.query(
                `SELECT 
                SUM(amount_bet) AS totalWin
                FROM bet_history WHERE email = ? AND type_account = 1 AND amount_win > 0 AND CAST(created_at AS DATE) = CAST(CURRENT_DATE() AS DATE)`, 
                [email],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.win = result[0].totalWin || 0;
                    resolve();
            })
        })
        await new Promise((resolve, reject)=>{
            db.query(
                `SELECT 
                SUM(amount_lose) AS totalLose
                FROM bet_history WHERE email = ? AND type_account = 1 AND amount_lose > 0 AND CAST(created_at AS DATE) = CAST(CURRENT_DATE() AS DATE)`, 
                [email],(error, result, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.lose = result[0].totalLose || 0;
                    resolve();
                })
    
        })
    
        return callback(null, obj);
    },

    getListHisOrder: (email, callback) => {
        // lấy tài khoản thực của email
        db.query(
            `select u_id from account where email = ? and type = 1`, 
            [
                email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(!results){
                    return callback(null, results[0])
                }
                let rs =  results[0]
                var uid = rs.u_id

                // lấy danh sách order tài khoản thực
                db.query(
                    `select 
                        amount_bet as ab,
                        amount_lose as al,
                        amount_win as aw,
                        buy_sell as bs,
                        close as c,
                        open as o,
                        created_at as d,
                        session as oss,
                        currency as cu from bet_history where id_account = ? and type_account = 1 ORDER BY id DESC LIMIT 20`, 
                    [
                        uid
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }

                        return callback(null, results)
                        
                        
                    })

            })
        
    },

    getListHisOrderDate: (data, callback) => {
        // lấy tài khoản thực của email
        db.query(
            `select u_id from account where email = ? and type = 1`, 
            [
                data.email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(!results){
                    return callback(null, results[0])
                }
                let rs =  results[0]
                let uid = rs.u_id

                // lấy danh sách order tài khoản thực
                db.query(
                    `SELECT 
                        amount_bet as ab,
                        amount_lose as al,
                        amount_win as aw,
                        buy_sell as bs,
                        close as c,
                        open as o,
                        created_at as d,
                        session as oss,
                        currency as cu FROM bet_history WHERE (id_account = ? and type_account = 1) AND (created_at >= ? AND created_at < ?) ORDER BY id DESC`, 
                    [
                        uid,
                        data.s,
                        data.e + ' 23:59:59'
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }

                        return callback(null, results)
                        
                        
                    })

            })
        
    },


    getListHisTradeWallet: (nick, callback) => {

        db.query(
            `SELECT * FROM trade_history WHERE from_u = ? OR to_u = ? ORDER BY id DESC LIMIT 10`, 
            [
                nick,
                nick
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                // tổng reco 
                db.query(
                    `SELECT COUNT(from_u) AS totalCount FROM trade_history WHERE from_u = ? OR to_u = ?`, 
                    [
                        nick,
                        nick
                    ],
                    (error, result, fields) => {
                        if(error){
                            return callback(error);
                        }
                        results['count'] = result[0].totalCount
                        return callback(null, results)
                    })
            })
        
    },

    getListHisTradeWalletPage: (data, callback) => {
        // lấy tài khoản thực của email
        let count_per_page = 10;
        let page_number = Number(data.page)
        if(page_number == 1) page_number = 0
        let next_offset = (page_number - 1) * count_per_page

        db.query(
            `SELECT * FROM trade_history WHERE from_u = ? AND type_key != ? ORDER BY id DESC LIMIT ? OFFSET ? `, 
            [
                data.nick,
                'hh',
                count_per_page,
                next_offset > 0 ? next_offset : 0
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                return callback(null, results)
            })
    },


    getListHisTradeWalletHH: (email, callback) => {
        db.query(
            `SELECT ref_code FROM users WHERE email = ?`, 
            [
                email,
            ], (error, res, fields) => {
                let ref_id = res[0].ref_code;
                // lấy tài khoản thực của email
                db.query(
                    `SELECT * FROM commission_history WHERE (upline_id = ? AND type = ?) OR (ref_id = ? AND type = ?) ORDER BY id DESC LIMIT 10`, 
                    [
                        ref_id,
                        'hhv',
                        ref_id,
                        'klgd',
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }
                        results['count'] = results.length;
                        return callback(null, results)
                    })
            })
    },


    getListHisTradeWalletHHPage: (data, callback) => {
        // lấy tài khoản thực của email
        let count_per_page = 10;
        let page_number = Number(data.page)
        if(page_number == 1) page_number = 0
        let next_offset = page_number * count_per_page
        db.query(
            `SELECT ref_code FROM users WHERE email = ?`, 
            [
                data.email,
            ], (error, res, fields) => {
                let ref_id = res[0].ref_code;
                db.query(
                    `SELECT * FROM commission_history WHERE (upline_id = ? AND type = ?) OR (ref_id = ? AND type = ?) ORDER BY id DESC LIMIT ? OFFSET ?`, 
                    [
                        ref_id,
                        'hhv',
                        ref_id,
                        'klgd',
                        count_per_page,
                        next_offset
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }
                        return callback(null, results)
                    })
            })
       
    },


    getListHisTradeWalletWGD: (nick, callback) => {
        // lấy tài khoản thực của email
        db.query(
            `SELECT * FROM trade_history WHERE (from_u = ? OR to_u = ?) AND (type_key = ? OR type_key = ?) ORDER BY id DESC LIMIT 10`, 
            [
                nick,
                nick,
                'ctas',
                'ctsa'
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                }
    
                // tổng reco 
                db.query(
                    `SELECT COUNT(from_u) AS totalCount FROM trade_history WHERE (from_u = ? OR to_u = ?) AND (type_key = ? OR type_key = ?)`, 
                    [
                        nick,
                        nick,
                        'ctas',
                        'ctsa'
                    ],
                    (error, result, fields) => {
                        if(error){
                            return callback(error);
                        }
                        results['count'] = result[0].totalCount
                        return callback(null, results)
                    })
            })
        
    },

    getListHisTradeWalletWGDPage: (data, callback) => {
        // lấy tài khoản thực của email
        let count_per_page = 10;
        let page_number = Number(data.page)
        if(page_number == 1) page_number = 0
        let next_offset = page_number * count_per_page
        
        db.query(
            `SELECT * FROM trade_history WHERE from_u = ? AND type_key = ? OR type_key = ? ORDER BY id DESC LIMIT ? OFFSET ? `, 
            [
                data.nick,
                'ctas',
                'ctsa',
                count_per_page,
                next_offset
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                return callback(null, results)
            })
    },


    getComDetails: (email, callback) => {
        // lấy
        db.query(
            `select ref_code from users where email = ?`, 
            [
                email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(!results){
                    return callback(null, results[0])
                }
                let rs =  results[0]
                let uid = rs.ref_code

                db.query(
                    `SELECT 
                        SUM(pending_commission) AS thanhtoan, 
                        COUNT(pending_commission) AS soluongGD,
                        COUNT(upline_id) AS sonhaGD,
                        created_at AS dt 
                        FROM commission_history WHERE upline_id = ? GROUP BY DAY(created_at) ORDER BY id DESC LIMIT 10`, 
                    [
                        uid
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }

                        // tổng reco 
                        db.query(
                            `SELECT 
                                COUNT(pending_commission) AS totalCount 
                                FROM commission_history WHERE upline_id = ? GROUP BY DAY(created_at) ORDER BY id DESC`, 
                            [
                                uid
                            ],
                            (error, result, fields) => {
                                if(error){
                                    return callback(error);
                                }
                                if(result.length != 0){
                                    results['count'] = result[0].totalCount
                                }else{
                                    results['count'] = 0
                                }

                                return callback(null, results)
                            })
                    })

            })
        
        
        
    },

    getComDetailsPage: (data, callback) => {
        // lấy tài khoản thực của email
        let count_per_page = 10;
        let page_number = Number(data.page)
        if(page_number == 1) page_number = 0
        let next_offset = page_number * count_per_page
        
        // lấy tài khoản thực của email
        db.query(
            `select ref_code from users where email = ?`, 
            [
                data.email
            ],
            (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                if(!results){
                    return callback(null, results[0])
                }
                let rs =  results[0]
                let uid = rs.ref_code

                db.query(
                    `SELECT 
                        SUM(pending_commission) AS thanhtoan, 
                        COUNT(pending_commission) AS soluongGD,
                        COUNT(upline_id) AS sonhaGD,
                        created_at AS dt 
                        FROM commission_history WHERE upline_id = ? GROUP BY DAY(created_at) ORDER BY id DESC LIMIT ? OFFSET ? `, 
                    [
                        uid,
                        count_per_page,
                        next_offset
                    ],
                    (error, results, fields) => {
                        if(error){
                            return callback(error);
                        }
                        return callback(null, results)
                      
                    })

            })
    },
    
    getComDetailsDate: async (data, callback) => {
        let Rs = [];

        await new Promise((res, rej) => {
            // lấy
            db.query(
                `select ref_code from users where email = ?`, 
                [
                    data.email
                ],
                (error, results, fields) => {
                    if(error){
                        //return callback(error);
                        res(Rs);
                    }
                    if(!results){
                        //return callback(null, results[0])
                        res(Rs);
                    }
                    let rs =  results[0];
                    let uid = rs.ref_code;

                    let daysBetween = (Date.parse(data.e) - Date.parse(data.s)) / (24 * 3600 * 1000)

                    if(daysBetween < 0){
                        //return callback(null, Rs)
                        res(Rs);
                    }

                    daysBetween++; // cộng thêm 1 ngày

                    let min = 0;

                    if(data.t == 1){
                        // khối lượng hoa hồng giao dịch
                        for(let i = 0; i < daysBetween; i++){
                            db.query(
                                `SELECT 
                                    SUM(pending_commission) AS thanhtoan, 
                                    SUM(personal_trading_volume) AS klgd,
                                    COUNT(pending_commission) AS soluongGD,
                                    DATE_FORMAT(created_at, '%Y-%m-%d') AS dt 
                                    FROM commission_history WHERE type = ? AND ref_id = ? AND DAY(created_at) = DAY(?) - ? GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`, 
                                [
                                    'klgd', // hoa hồng giao dịch
                                    uid,
                                    data.e,
                                    i
                                ],
                                (error, results, fields) => {
                                    if(error){
                                        //return callback(error);
                                        res(Rs);
                                    }
                                min++;    
                                if(Array.isArray(results) && results.length > 0) Rs.push(results[0]);
                                if(min == daysBetween) res();
                            })
                        }
                    }else{
                        // khối lượng hoa hồng vip giao dịch
                        for(let i = 0; i < daysBetween; i++){
                            db.query(
                                `SELECT 
                                    SUM(vip_commission) AS doanhso, 
                                    created_at AS dt 
                                    FROM commission_history WHERE type = ? AND ref_id = ? AND DAY(created_at) = DAY(?) - ? GROUP BY DAY(created_at)`, 
                                [
                                    'hhv',
                                    uid,
                                    data.e,
                                    i
                                ],
                                (error, results, fields) => {
                                    if(error){
                                        res(error);
                                    }
                                min++;
                                if(results.length > 0) Rs.push(results[0])   
                                if(min == daysBetween) res();
                            })
                        }
                    }
                
                })
            })
        return callback(null, Rs);
    },

    getAgencySearchLevel: async (data, callback) => {
		
		let dt = moment().tz("Asia/Ho_Chi_Minh");
		let dt1 = moment().tz("Asia/Ho_Chi_Minh");
		let dt2 = moment().tz("Asia/Ho_Chi_Minh");
	
		let cach30ngay = dt.subtract(30,'days').format("YYYY-MM-DD");
        let cach7ngay = dt1.subtract(7,'days').format("YYYY-MM-DD");
        let cach1ngay = dt2.subtract(1,'days').format("YYYY-MM-DD");
		

        //let currentDate = new Date()
        //let cach30ngay =  new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDay() - 30) 
        //let cach7ngay =  new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDay() - 7) 
        //let cach1ngay =  new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDay() - 1) 
		
        //let c30n =  cach30ngay.getFullYear() + '-' + cach30ngay.getMonth() + '-' + cach30ngay.getDay()
        //let c7n =  cach7ngay.getFullYear() + '-' + cach7ngay.getMonth() + '-' + cach7ngay.getDay()
        //let c1n =  cach1ngay.getFullYear() + '-' + cach1ngay.getMonth() + '-' + cach1ngay.getDay()
		
		let c30n = cach30ngay;
        let c7n = cach7ngay;
        let c1n = cach1ngay;

        let n = data.kc, ac = 0;

        if(n == 30){
            ac = c30n;
        }else if(n == 7){
            ac = c7n;
        }else if(n == 1){
            ac = c1n;
        }else{
            ac = 0;
        }
		
		let refID, UpID, listCap = []; 
		let Level = data.id;
        // lấy danh sách 7 cấp dưới của mình 
		let listData = {
			"cap1": [],
			"cap2": [],
			"cap3": [],
			"cap4": [],
			"cap5": [],
			"cap6": [],
			"cap7": [],
			"cap8": [],
			"cap9": [],
			"cap10": [],
			"cap11": [],
			"cap12": [],
			"cap13": [],
			"cap14": [],
			"cap15": []
		};
		
		 await new Promise((res, rej) => {
             db.query(
                 `SELECT upline_id, ref_code FROM users WHERE email = ?`, 
                 [
                     data.email
                 ],
                 (error, results, fields) => {
                     if(error){
                         res([]);
                      }
                    if(!results){
                         res([]);
                     }
                     let rs =  results[0];
                     refID = rs.ref_code; // ref_code của mình
                     UpID = rs.upline_id;
					  res();
                 }
             )


         });

        // let dataList = await new Promise((res, rej) => {
		// 	//SELECT  upline_id, ref_code 
		// 	//FROM (SELECT * FROM users
        //     //            ORDER BY upline_id) users_sorted,
        //     //            (SELECT @pv := 'RYIFCWS') initialisation
        //     //    WHERE find_in_set(upline_id, @pv)
        //     //    AND length(@pv := concat(@pv, ',', ref_code));
				
        //     db.query(`with recursive cte (level_vip, tklgd, ref_code, upline_id, nick_name) as (
		// 			  select     level_vip,
		// 						 pricePlay,
		// 						 ref_code,
		// 						 upline_id,
		// 						 nick_name
		// 			  from       users
		// 			  where      upline_id = ?
		// 			  union all
		// 			  select     p.level_vip,
		// 						 p.pricePlay,
		// 						 p.ref_code,
		// 						 p.upline_id,
		// 						 p.nick_name
		// 			  from       users p
		// 			  inner join cte
		// 					  on p.upline_id = cte.ref_code
		// 			)
		// 			select * from cte;`, 
        //         [
		// 			refID
		// 		], (error, result, fields) => {
		// 			//console.log(result);
        //             //let count = result.length;
        //             //if(count > 0){
        //                 res(result)
        //             //}
        //         }
        //     )
            
        // });
		
		let cap1 = false, cap2 = false, cap3 = false, cap4 = false, cap5 = false, cap6 = false, cap7 = false;
        // lấy cấp 1
        await new Promise((res, rej) => {
            db.query(
                `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                [
                    refID
                ], (error, result, fields) => {
                    if(result.length > 0){
                        result.forEach((ele) => {
                            listData['cap1'].push(ele);
                        })
						cap1 = true;
                    }
                    res();
                }
            )
        })
		
        
        if(cap1){
            for(let i = 0; i < listData['cap1'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap1'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap2'].push(ele);
                            });
                            cap2 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap2){
            for(let i = 0;  i < listData['cap2'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap2'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap3'].push(ele);
                            });
                            cap3 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap3){
            for(let i = 0;  i < listData['cap3'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap3'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap4'].push(ele);
                            });
                            cap4 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap4){
            for(let i = 0;  i < listData['cap4'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap4'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap5'].push(ele);
                            });
                            cap5 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap5){
            for(let i = 0;  i < listData['cap5'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap5'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap6'].push(ele);
                            });
                            cap6 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap6){
            for(let i = 0;  i < listData['cap6'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
                    [
                        listData['cap6'][i].ref_code
                    ], (error, result, fields) => {
                        if(result.length > 0){
                            result.forEach((ele) => {
                                listData['cap7'].push(ele);
                            });
                            cap7 = true;
                        }else{
                            cap7 = false;
                        }
                    }
                )
                await sleep(50);
            }
        }

        //if(cap7){
         //   for(let i = 0;  i < listData['cap7'].length; i++){
         //       db.query(
         //           `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
         //           [
         //               listData['cap7'][i].ref_code
         //           ], (error, result, fields) => {
         //               if(result.length > 0){
         //                   result.forEach((ele) => {
         //                       listData['cap7'].push(ele);
         //                   });
          //                  //cap7 = true;
          //              }
          //          }
          //      )
          //      await sleep(50);
          //  }
        //}
		
        // if(dataList.length > 0){
        //     let u = 0, check = '';
        //     dataList.forEach((ele) => {
		// 		if(check != ele.upline_id){
		// 			u++;
		// 			check = ele.upline_id;
		// 		} 
		// 		if(u <= 7){
		// 			listData[`cap${u}`].push(ele);
		// 		}
            
        //     })

        // }
		
		//await sleep(100);

		for(let i = 0; i < listData[`cap${Level}`].length; i++){
			let qrr = `SELECT SUM(pending_commission) AS thhn FROM commission_history WHERE ref_id = ? AND upline_id = ? AND type = ? AND created_at > '${ac}'`;
			db.query(qrr, 
			[
				listData[`cap${Level}`][i].upline_id,
				listData[`cap${Level}`][i].ref_code,
				'klgd'
			],
			(error2, resu, fields2) => {
				if(resu[0].thhn !== null){
					listData[`cap${Level}`][i].thhn = resu[0].thhn;
				}else{
					listData[`cap${Level}`][i].thhn = 0;
				}
				
			});
			await sleep(100);
            
		}
        

		return callback(null, listData[`cap${Level}`]);
        
    },
	

    getAgencySearchName:async (data, callback) => {
  
        if(data.name == '') return callback(null);

        let dt = moment().tz("Asia/Ho_Chi_Minh");
		let dt1 = moment().tz("Asia/Ho_Chi_Minh");
		let dt2 = moment().tz("Asia/Ho_Chi_Minh");
	
		let cach30ngay = dt.subtract(30,'days').format("YYYY-MM-DD");
        let cach7ngay = dt1.subtract(7,'days').format("YYYY-MM-DD");
        let cach1ngay = dt2.subtract(1,'days').format("YYYY-MM-DD");
		
		let c30n = cach30ngay;
        let c7n = cach7ngay;
        let c1n = cach1ngay;

        let n = data.kc, ac = 0;

        if(n == 30){
            ac = c30n;
        }else if(n == 7){
            ac = c7n;
        }else if(n == 1){
            ac = c1n;
        }else{
            ac = 0;
        }

        let listData = await new Promise((res, rej) => {
            db.query(
                `select ref_code from users where email = ?`, 
                [
                    data.email
                ],
                (error, results, fields) => {
                    if(error){
                        res([])
                     }
                    if(!results){
                        res([])
                    }
                    let rs =  results[0]
                    let uid = rs.ref_code; // ref_code của mình
                    let name = data.name
    
                    let qr = ''
    
                    // lấy thông tin đại lý 
                    if(ac == 0){
                        qr = `select level_vip, pricePlay AS tklgd, nick_name, ref_code from users where upline_id = ? AND nick_name LIKE CONCAT('%${name}%') ORDER BY id DESC`
                    }else{
                        qr = `select level_vip, pricePlay AS tklgd, nick_name, ref_code from users where upline_id = ? AND (nick_name LIKE CONCAT('%${name}%') AND created_at > '${ac}') ORDER BY id DESC`
                    }
          
                    db.query(qr, 
                        [
                            uid
                        ],
                        (error, results, fields) => {
                            if(error){
                                rej(error);
                            }  
                            if(results.length == 0){
                                return callback(null);
                            }
                            res(results)
                     })
    
                })
        });

        await new Promise((res, rej) => {
            let qrr = '';
            //if(ac == 0){
            //    qrr = `select SUM(personal_trading_volume) AS thhn from commission_history where ref_id = ? ORDER BY id DESC`
            //}else{
                qrr = `select SUM(personal_trading_volume) AS thhn from commission_history where ref_id = ? AND created_at > '${ac}') ORDER BY id DESC`
            //}

            let min = 0;
            let max = listData.length;

            if(max == 0) res([]);
                
            listData.forEach(function(result){
                    // lấy thông tin hoa hồng // personal_trading_volume AS thhn,
                db.query(qrr, 
                    [
                        result.ref_code
                    ],
                    (error, resu, fields) => {
                        if(void 0 !== resu) listData[min].thhn = resu[0].thhn;
                        min++;
                        if(min == max) res(listData);
                    })
            });
        });

        return callback(null, listData)
    },

    updateSecret2FA: (data, callback) => {
        db.query(
            `UPDATE users SET active_2fa = 1, secret_2fa = ?, code_secure = ? WHERE email = ?`,
            [
                data.s,
                null,
                data.e
            ], (error, results, fields) => {
                if(error){
                    return error;
                }
                return callback(null, results)
            }
        )
    },

    Disabled2FA: (email, callback) => {
        db.query(
            `UPDATE users SET active_2fa = 0, secret_2fa = null, code_secure = null WHERE email = ?`,
            [
                email
            ], (error, results, fields) => {
                if(error){
                    return error;
                }
                return callback(null, results)
            }
        )
    },

    updateCodeSecure: (data, callback) => {
        db.query(
            `UPDATE users SET code_secure = ? WHERE email = ?`,
            [
                data.code,
                data.email
            ], (error, results, fields) => {
                if(error){
                    return error;
                }
                return callback(null, results)
            }
        )
    },
	
	getSecrect2FA: (email, callback) => {
		db.query(
            `select secret_2fa from users where email = ?`,
            [
                email, 
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                
                return callback(null, results[0])
            }
        )
	},

    checkCodeSecure2FA: (data, callback) => {
        db.query(
            `select code_secure, password from users where email = ? AND code_secure = ?`,
            [
                data.email, 
                data.code
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
                
                return callback(null, results[0])
            }
        )
    },

    getListAnalytics: async (data, callback) => {
        const obj = {
            nNDK: 0, // số người đăng ký
            nNDXM: 0,  // số người xác minh
            nDL: 0, // số đại lý ( thành viên VIP )
            tsTN: 0, // tổng số tiền nạp

            tsNNT: 0, // tổng số người nạp tiền

            tsNNT7N: 0, // tổng số người nạp tiền 7 ngày qua
            tsFee: 0, // thuế phí
            tsTNFEE: 0, // tổng số thu nhập ( trừ ra thuế phí)
            tsTNPAYPAL: 0, // tổng số thu nhập người dùng

            tsTNUSD: 0, // tổng số tiền nạp USD,
            tsTNBTC: 0, // tổng số tiền nạp Bitcoin
            tsTNETH: 0, // tổng số tiền nạp ETH
            tsTNVN: 0 // tổng số tiền nạp VN
        }

        await new Promise((res, rej) => {
             //=====================
            db.query(
                `SELECT COUNT(id) as nNDK, 
                    SUM(money_paypal) as tsTNPAYPAL, 
                    SUM(money_eth) as tsTNETH, 
                    SUM(money_btc) as tsTNBTC, 
                    SUM(money_usdt) as tsTNUSD, 
                    SUM(money_vn) as tsTNVN 
                    FROM users WHERE active = 1 AND marketing = 0`, (error, results, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.nNDK = results[0].nNDK
                    obj.tsTNPAYPALN = results[0].tsTNPAYPAL

                    obj.tsTNUSDN = results[0].tsTNUSD;
                    obj.tsTNBTCN = results[0].tsTNBTC;
                    obj.tsTNETHN = results[0].tsTNETH;
                    obj.tsTNVNN = results[0].tsTNVN;  
                    res();
            })
        })

        await new Promise((res, rej) => {
            //===================
            db.query(
                `SELECT COUNT(id) as nNDXM FROM users WHERE verified = 1`, (error, results, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.nNDXM = results[0].nNDXM;
                    res();
                })
        })

        await new Promise((res, rej) => {
            //===================
            db.query(
                `SELECT COUNT(id) as nDL FROM users WHERE vip_user = 1`, (error, results, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.nDL = results[0].nDL;
                    res();
                })
        })

        await new Promise((res, rej) => {
            //===================
            //===================
            db.query(
                `SELECT SUM(amount) AS tsTNUSD, SUM(pay_fee) AS Fee, SUM(real_amount) AS tnBNB FROM trade_history WHERE type_key = ? AND status = 1`, 
                [
                    'nt'
                ],
                (error, results, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    obj.tsTNUSD = results[0].tsTNUSD;
                    obj.tsFee = results[0].Fee;
            
                    //let total = results[0].tsTN - results[0].Fee;
                    obj.tsTNThuc = results[0].tnBNB;
                    res();
                })
        })

        await new Promise((res, rej) => {
            //===================
            //===================
            db.query(
                `SELECT COUNT(from_u) as tsNNT FROM trade_history WHERE status = 1 AND type_key = ? GROUP BY from_u`, 
                [
                    'nt'
                ]
                ,(error, results, fields) => {
                    if(error){
                        return callback(error);
                    }
                    
                    if(results.length != 0){
                        obj.tsNNT = results[0].tsNNT;
                    }
                    res();
                })
        })

        await new Promise((res, rej) => {
             //===================
             db.query(
                `SELECT COUNT(from_u) as tsNNT7N FROM trade_history WHERE status = 1 AND type_key = ? AND WEEKOFYEAR(created_at) = WEEKOFYEAR(NOW()) GROUP BY from_u`, 
                [
                    'nt'
                ]
                ,(error, results, fields) => {
                    if(error){
                        return callback(error);
                    }

                    obj.tsNNT7N = results.length > 0 ? results[0].tsNNT7N : 0;
                    res();
                })
        })

        await new Promise((res, rej) => {
            //===================
            db.query(
               `SELECT SUM(amount_win) AS tsWin, SUM(amount_lose) AS tsLose FROM bet_history WHERE marketing = ? AND status = 1 AND type_account = ?`, 
               [
                   0,
				   1 // tài khoản thực
               ]
               ,(error, results, fields) => {
                   if(error){
                       return callback(error);
                   }

                   obj.tsWin = results.length > 0 ? results[0].tsWin : 0;
                   obj.tsLose = results.length > 0 ? results[0].tsLose : 0;
                   res();
               })
		})

        await new Promise((res, rej) => {
            //===================
            db.query(
               `SELECT SUM(pending_commission) AS tsHHong FROM commission_history WHERE marketing = ? AND type = ?`, 
               [
                0,
                'klgd',
               ]
               ,(error, results, fields) => {
                   if(error){
                       return callback(error);
                   }
                   obj.tsHHong = results.length > 0 ? results[0].tsHHong : 0;
                   res();
               })
		})

        return callback(null, obj);

    },

    changeAccType: async (data, callback) => {
        if (data.type === 1) {
            await new Promise((resolve, reject) => {
                db.query(`SELECT COUNT(ref_code) as isParent FROM users WHERE ref_code = (select upline_id from users WHERE id = ?)`, [data.id], (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    if (res[0].isParent > 0) {
                        return callback(null, -1);
                    } else {
                        return resolve("");
                    }
                })
            });
        }

        db.query(
            `UPDATE users SET marketing = ?, updated_at=now() WHERE id = ?`,
            [
                data.type, 
                data.id
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                 }
				 db.query(
                    `SELECT nick_name FROM users WHERE id = ?`,
                    [
                        data.id
                    ], (error, results, fields) => {
                        let nick = results[0].nick_name;
                        if(data.type == 1){
                            Tele.sendMessThongBao(`🧑ADMIN vừa thực hiện <i>BẬT</i> Marketing người dùng: <b>${nick}</b>`);
                        }else{
                            Tele.sendMessThongBao(`🧑ADMIN vừa thực hiện <i>TẮT</i> Marketing người dùng: <b>${nick}</b>`);
                        }
                    }); 
                 return callback(null, results)
            }
        )
    },

    changPassAd: (data, callback) => {
        db.query(
            `UPDATE users SET password = ? WHERE id = ?`,
            [
                data.pass,
                1
            ], (error, results, fields) => {
                if(error){
                    return callback(error);
                }
                return callback(null, results)
            }
        )
    },

    getListF1F7: async (data, callback) => {
        let refID = data.ref;
        //let listCap = [];
        // lấy danh sách 7 cấp dưới của mình 
		let listData = {
			"cap1": [],
			"cap2": [],
			"cap3": [],
			"cap4": [],
			"cap5": [],
			"cap6": [],
			"cap7": [],
			"cap8": [],
			"cap9": [],
			"cap10": [],
			"cap11": [],
			"cap12": [],
			"cap13": [],
			"cap14": [],
			"cap15": []
		};
        // let listCap = {
		// 	"cap1": [],
		// 	"cap2": [],
		// 	"cap3": [],
		// 	"cap4": [],
		// 	"cap5": [],
		// 	"cap6": [],
		// 	"cap7": []
		// };
        //listCap['cap1'].push(refID);
        
        let obj = {};

        // let uIdAccount = await new Promise((resolve, reject)=>{
        //     // get account name
        //     db.query(
        //         `SELECT u_id FROM account WHERE email = ? AND type = 1`, 
        //         [
        //             data.email
        //         ],
        //         (error, results, fields) => {
        //             if(error){
        //                 return callback(error);
        //             }
        //             resolve(results[0].u_id);
        //         })
        // })

        await new Promise((resolve, reject)=>{
            // tổng số lượng giao dịch cấp dưới tháng này
            //SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE from_upid = ? AND ref_id = ? AND MONTH(created_at) = MONTH(NOW())
            db.query(
                `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW())`, 
                [
                    //uIdAccount,
                    refID,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD1 = results[0].tslgdCD || 0;
                    resolve();
            })
            
        })
        await new Promise((resolve, reject)=>{
            // tổng số lượng giao dịch cấp dưới cách 1 tháng

            db.query(
                `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 1`, 
                [
                    //uIdAccount,
                    refID,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD2 = results[0].tslgdCD || 0;
                    resolve();
            })
            
        })
        await new Promise((resolve, reject)=>{
            
            // tổng số lượng giao dịch cấp dưới cách 2 tháng

            db.query(
                `SELECT SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 2`, 
                [
                    //uIdAccount,
                    refID,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD3 = results[0].tslgdCD || 0;
                    resolve();
            })
            
           
        })
        await new Promise((resolve, reject)=>{
            // cách 3 tháng
            db.query(
                `select SUM(personal_trading_volume) AS tslgdCD FROM commission_history WHERE upline_id = ? AND type = ? AND MONTH(created_at) = MONTH(NOW()) - 3`, 
                [
                    //uIdAccount,
                    refID,
                    'klgd'
                ],(error, results, fields) => {
                    if(error){
                        resolve([]);
                    }
                    obj.tslgdCD4 = results[0].tslgdCD || 0;
                    resolve();
            })
           
        })

        // lấy danh sách 7 cấp
        // let max = false;

        // for(let i = 0; i < 7; i++){
        //     db.query(
        //         `SELECT ref_code FROM users WHERE upline_id = ?`, 
        //         [
        //             refID
        //         ], (error, result, fields) => {
        //             if(result.length > 0){
        //                 result.forEach((ele) => {
        //                     listCap['cap1'].push(ele.ref_code);
        //                 })
        //                 //refID = result[0].ref_code;
        //             }else{
        //                 max = true;
        //             }
        //         }
        //     )
        //     if(max) break;
        //     await sleep(200);
        // }
		
        let cap1 = false, cap2 = false, cap3 = false, cap4 = false, cap5 = false, cap6 = false, cap7 = false;
        // lấy cấp 1
        await new Promise((res, rej) => {
            db.query(
                `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name, email FROM users WHERE upline_id = ?`, 
                [
                    refID
                ], async (error, result, fields) => {
                    if(result.length > 0){
                        await Promise.all(result.map(async (ele) => {
                            const res = await new Promise((resolve, reject)=>{
                                db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (error, results)=>{
                                    if(error){
                                        return reject(error);
                                    }
                                    return resolve(results);
                                });
                            });
                            ele.amt = res[0].amount || 0;
                            listData['cap1'].push(ele);
                            cap1 = true;
                        }))
                    }

					res();
                    
                }
            )
        })

        if(cap1){
            for(let i = 0; i < listData['cap1'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap1'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap2'].push(ele);
                            }));
                            cap2 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap2){
            for(let i = 0;  i < listData['cap2'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap2'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap3'].push(ele);
                            })); 
                            cap3 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }
	
        if(cap3){
            for(let i = 0;  i < listData['cap3'].length; i++){
			
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap3'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap4'].push(ele);
                            }));
                            cap4 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap4){
            for(let i = 0;  i < listData['cap4'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap4'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap5'].push(ele);
                            }));
                            cap5 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap5){
            for(let i = 0;  i < listData['cap5'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap5'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap6'].push(ele);
                            }));
                            cap6 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }

        if(cap6){
            for(let i = 0;  i < listData['cap6'].length; i++){
                db.query(
                    `SELECT level_vip, pricePlay AS tklgd, priceWin, priceLose, ref_code, upline_id, nick_name FROM, email users WHERE upline_id = ?`, 
                    [
                        listData['cap6'][i].ref_code
                    ], async (error, result, fields) => {
                        if(result.length > 0){
                            await Promise.all(result.map(async (ele) => {
                                const res = await new Promise((resolve, reject) => {
                                    db.query(`SELECT sum(amount) as amount from trade_history WHERE email = ? AND type_key ='nt'`, [ele.email], (err, res) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        return resolve(res);
                                    })
                                })
                                ele.amt = res[0].amount || 0;
                                listData['cap7'].push(ele);
                            }));
                            cap7 = true;
                        }
                    }
                )
                await sleep(50);
            }
        }
		
        //if(cap7){
         //   for(let i = 0;  i < listData['cap7'].length; i++){
          //      db.query(
         //           `SELECT level_vip, pricePlay AS tklgd, ref_code, upline_id, nick_name FROM users WHERE upline_id = ?`, 
           //         [
         //               listData['cap7'][i].ref_code
          //          ], (error, result, fields) => {
          //              if(result.length > 0){
         //                   result.forEach((ele) => {
          //                      listData['cap7'].push(ele);
         //                   });
                            //cap7 = true;
         //               }
         //           }
          //      )
          //      await sleep(50);
          //  }
       // }


        // await new Promise((res, rej) => {
		// 	//SELECT  upline_id, ref_code 
		// 	//FROM (SELECT * FROM users
        //     //            ORDER BY upline_id) users_sorted,
        //     //            (SELECT @pv := 'RYIFCWS') initialisation
        //     //    WHERE find_in_set(upline_id, @pv)
        //     //    AND length(@pv := concat(@pv, ',', ref_code));
				
        //     db.query(`with recursive cte (level_vip, tklgd, ref_code, upline_id, nick_name) as (
		// 			  select     level_vip,
		// 						 pricePlay,
		// 						 ref_code,
		// 						 upline_id,
		// 						 nick_name
		// 			  from       users
		// 			  where      upline_id = ?
		// 			  union all
		// 			  select     p.level_vip,
		// 						 p.pricePlay,
		// 						 p.ref_code,
		// 						 p.upline_id,
		// 						 p.nick_name
		// 			  from       users p
		// 			  inner join cte
		// 					  on p.upline_id = cte.ref_code
		// 			)
		// 			select * from cte;`, 
        //         [
		// 			refID
		// 		], (error, result, fields) => {
					
        //             let count = result.length;
		// 			if(count === 0) res();
        //             if(count > 0){
        //                 let i = 0, u = 0, check = '';
        //                 result.forEach((ele) => {
		// 					if(check != ele.upline_id){
		// 						u++;
		// 						check = ele.upline_id
		// 					} 
		// 					if(u <= 7){
		// 						listData[`cap${u}`].push(ele);
		// 					}
		// 					res();
        //                 })
					
        //             }
        //         }
        //     )
            
        // });

        let listD = {
            data : listData,
            obj: obj
        }

        return callback(null, listD);
    },


    getListCmsHis: async (data, callback) => {
        let email = data.e;

        let rs = [];
        await new Promise((resolve, reject)=>{
    
            db.query(
                `SELECT * FROM commission_history WHERE email = ? AND type = ?`, 
                [
                    email,
                    'klgd'
                ],(error, results, fields) => {
                    rs = results;
                    resolve();
            })
            
        })


        return callback(null, rs);
    },
	
	getListNotifi: async (data, callback) => {
        let email = data.e;

        let rs = [];
        await new Promise((resolve, reject)=>{
    
            db.query(
                // `SELECT * FROM notifi WHERE cu_email = ? OR email = ? ORDER BY id DESC`, 
                `SELECT * FROM notifi WHERE cu_email = ? ORDER BY id DESC`, 
                [
                    email,
					// email
                ],(error, results, fields) => {
                    rs = results;

                    resolve();
            })
            
        })


        return callback(null, rs);
    },

    updateListNotifi: async (data, callback) => {
        let email = data.e;

        await new Promise((resolve, reject)=>{
    
            db.query(
                `UPDATE notifi SET views = ? WHERE cu_email = ?`, 
                [
                    1,
                    email
                ],(error, results, fields) => {
                    resolve();
            })
            
        })

        return callback(null);
    }
	
}