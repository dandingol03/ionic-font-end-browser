var Promise = require('bluebird');
var Q = require('q');
var ftpRoot = require('../config.js').ftpRoot;
var mysql = require('mysql');
Promise.promisifyAll(mysql);
Promise.promisifyAll(require("mysql/lib/Connection").prototype);
Promise.promisifyAll(require("mysql/lib/Pool").prototype);
var using = Promise.using;

var pool = null;
var logger = null;

function init(dbConf, lg) {
    pool = mysql.createPool(dbConf);
    if (lg) {
        logger = lg;
    } else {
        var log4js = require('log4js');
        logger = log4js.getLogger();
    }
}

function getSqlConnection() {
    return pool.getConnectionAsync().disposer(function(connection) {
        connection.release();
    });
}



function registerUser(cellphone, passwd) {
    var tmpStr =  new Buffer(passwd);
    var passwdBase64 = tmpStr.toString('base64');
    var sql_base = "INSERT INTO info_person_info" +
        " (`perTelephone`, `perTypeCode`, `secondPerType`)" +
        " VALUES (?, ?, ?)";
    var sql_inserts = [cellphone, , '2', '11'];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    var personId = null;
    var perNum = null;
    return using(getSqlConnection(), function(conn) {
        return conn.beginTransactionAsync().then(function(result) {
            return conn.queryAsync(info_query_sql);
        },function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        }).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.')
                return conn.rollbackAsync();
            } else {
                personId = result.insertId;
                sql_base = "INSERT INTO insurance_car_customer"
                    + " (`personId`, `registerDate`, `isBuyInsurance`, "
                    + "`isCheckCar`, `isChackLicense`, `isUseRescueService`)"
                    + " VALUES (?, ?, ?, ?, ?, ?)";
                sql_inserts = [personId, new Date(), 0, 0, 0, 0];
                var sys_user_sql = mysql.format(sql_base, sql_inserts);
                return conn.queryAsync(sys_user_sql);
            }
        }, function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        }).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('insurance_car_customer not affected or no id generated.')
                return conn.rollbackAsync();
            } else {
                perNum = "C" + ("000000" + result.insertId).slice(-6);
                sql_base = "UPDATE info_person_info SET perNum = ? where personId = ?";
                sql_inserts = [perNum, personId];
                var sys_user_sql = mysql.format(sql_base, sql_inserts);
                return conn.queryAsync(sys_user_sql);
            }
        }, function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        }).then(function (result) {
            if (result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.')
                return conn.rollbackAsync();
            } else {
                sql_base = "INSERT INTO sys_user (`loginName`,`password`, `userid`, usertype) VALUES (?, ?, ?, ?)";
                sql_inserts = [cellphone, passwdBase64, personId, 'S'];
                var sys_user_sql = mysql.format(sql_base, sql_inserts);
                return conn.queryAsync(sys_user_sql);
            }
        }, function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        }).then(function (result) {
            if (result.affectedRows == 0) {
                logger.error('user_group not affected.')
                return conn.rollbackAsync();
            }
            return conn.commitAsync();
        }, function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        }).then(function (result) {
            return personId;
        }, function (err) {
            logger.error(err);
            return conn.rollbackAsync();
        })
    })
}

function addCarInfo(personId, carInfo) {
    var sql = "SELECT customerId FROM ?? WHERE ?? = ?";
    var inserts = ['insurance_car_customer', 'personId', personId];
    sql = mysql.format(sql, inserts);
    var customerId = null;
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0) {
                customerId = results[0].customerId;
            }
            var sql = "INSERT into insurance_car_info"
                + " (`carNum`, `engineNum`, `frameNum`, `factoryNum`, " +
                "`firstRegisterTime`, `ownerName`, `ownerIdCard`, `ownerAddress`, "+
                "`customerId`, `modifyTime`)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            var inserts = [
                carInfo.carNum,
                carInfo.engineNum,
                carInfo.frameNum,
                carInfo.factoryNum,
                carInfo.firstRegisterTime,
                carInfo.ownerName,
                carInfo.ownerIdCard,
                carInfo.ownerAddress,
                customerId,
                new Date()
            ];
            sql = mysql.format(sql, inserts);
            return conn.queryAsync(sql);
        }, function (err) {
            logger.error(err);
            return (err);
        });
    });
}


//TODO:squash photo to carInfo
function getCarAndOwnerInfo(personId) {
    var deferred= Q.defer();
    var customerId=null;
    getCustomerIdByPersonId(personId).then(function (json) {
        if(json.re==1)
        {
            customerId=json.id;
            var sql = "select `carNum`, `engineNum`, `frameNum`, `factoryNum`, " +
                "`firstRegisterTime`, `ownerName`, `ownerIdCard`, `ownerAddress`, " +
                "`modifyTime` from insurance_car_info where ?? =?";
            var inserts = ['customerId', customerId];
            sql = mysql.format(sql, inserts);
            using(getSqlConnection(), function(conn) {
                conn.queryAsync(sql).then(function(records) {
                    if(records!=null&&records.length>0)
                        deferred.resolve({re: 1, data: records});
                    else
                        deferred.resolve({re: 2, data: null});
                });

            });
        }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject(str);
    });

    return deferred.promise;
}

function verifyUserPasswd(cellphone, passwd) {
    var tmpStr =  new Buffer(passwd);
    var passwdBase64 = tmpStr.toString('base64');
    var sql = "SELECT userid from ?? WHERE ?? = ? and ?? =?";
    var inserts = ['sys_user', 'loginName', cellphone, 'password', passwdBase64];
    sql = mysql.format(sql, inserts);
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql);
    }).then(function(result) {
        if (result && result.length == 1) {
            return(result[0].userid);
        } else if(!result || result.length == 0) {
            return;
        } else {
            logger.error('Multiple studentId:' + studentId);
            return(result[0].userid);
        }
    }, function (err) {
        logger.error(err);
        return null;
    });
}

function getPersonId(cellphone) {
    var sql = "SELECT userid from ?? WHERE ?? = ?";
    var inserts = ['sys_user', 'loginName', cellphone];
    var sql = mysql.format(sql, inserts);
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql);
    }).then(function(result) {
        if (result && result.length == 1) {
            return(result[0].userid);
        } else if(!result || result.length == 0) {
            return;
        } else {
            logger.error('Multiple username:' + studentId);
            return(result[0].userid);
        }
    }, function (err) {
        logger.error(err);
        return null;
    });
}

function getCustomerIdByPersonId(personId)
{
    var deferred= Q.defer();
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    var customerId = null;
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if (result && result.length > 0) {
                customerId = result[0].customerId;
                deferred.resolve({re: 1, id: customerId});
            }
            else
                deferred.reject({re: -1, data: 'there is no customer matches'});
        });
    });
    return deferred.promise;
}


function getLifeInfo (companyId) {
    var sql = "SELECT * FROM ?? WHERE ?? = ?";
    var inserts = ['insurance_life_product', 'companyId', companyId];
    sql = mysql.format(sql, inserts);
    var productId = null;
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0) {
                productId = results[0].productId;
            }
            var sql = "select `productNum`, `productName`, `feeYearCount`, `insuranceQuota`, " +
                "`insuranceFee`, `insuranceFeeYear`, `insuranceDuringType`, `businesserId`, "+
                "`customerId` , `insuranceFeeYear`from insurance_car_info where ?? =?";
            var inserts = ['customerId', customerId];
            sql = mysql.format(sql, inserts);
            return conn.queryAsync(sql).then(function(result) {
                return result;
            });
        }, function (err) {
            logger.error(err);
            return (err);
        });
    });
}

function changePassword(personId,info){
    var sql = "SELECT password FROM ?? WHERE ?? = ?";
    var inserts = ['sys_user', 'userid', personId];
    var oldPassword=info.oldPwd;
    var newPassword=info.pwd;
    sql = mysql.format(sql, inserts);
    var password = null;
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0) {
                var pwd =results[0].password ;
                //password=base64_decode(pwd);
                password=new Buffer(pwd,'base64').toString();
            }
            if(password==oldPassword){
                password=new Buffer(newPassword).toString('base64');
                var sql ="update sys_user set password='"+password+"' where userid="+personId;
                return conn.queryAsync(sql).then(function(result) {
                    if(result.affectedRows>0){
                        return {re:1};
                    }
                    else{
                        return {re:2};
                    }
                });

            }else{
                return {re:2};

            }
        })
    });
}


function getInsuranceCompanyInfo(companyId,callback){
    var sql = "select * from insurance_company_info";
    if(companyId!==undefined&&companyId!==null&&companyId!='')
        sql+=' where companyId ='+companyId+'';
    sql = mysql.format(sql,null);
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(records) {
            if (records && records.length > 0) {

                if(callback!==undefined&&callback!==null)
                {
                    callback({re:1,data:records});
                }else{
                    return ({re:1,data:records});
                }
            }else{
                if(callback!==undefined&&callback!==null)
                    callback({re:2,data:null});
                else
                    return ({re: 2, data: null});
            }
        })
    });
}

function getLifeInsuranceByCompanyId(companyId){
    var sql = "select * from insurance_life_product where " ;
    if(companyId!==undefined&&companyId!==null&&companyId!='')
        sql+=' and companyId ='+companyId+'';
    sql = mysql.format(sql,null);
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(records) {
            if (records && records.length > 0) {
                return ({re: 1, data: records});
            }else{
                return ({re: 2, data: null});
            }
        })
    });
}

//根据主险Id获取附加险列表
function getAttachLifeInsurancesByOwnerId(ownerId)
{
    var sql = "select * from insurance_life_product where ?? =?";
    var inserts = ['ownerId',ownerId];
    sql =mysql.format(sql,inserts);
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(records) {
            if (records && records.length > 0) {
                return records;
            }else{
                return null;
            }
        })
    });
}

function t(records){
    var life_insurance_plans=[];

    var deferred = Q.defer();
    records.map(function(record,i) {
        getInsuranceCompanyInfo(record.companyId,null).then(function(json) {
            if(json.re==1)
            {
                var info=json.data[0];
                var plan={
                    companyName:info.companyName,
                    companyPhone:info.companyPhone,
                    companyAddress:info.companyAddress,
                    main:record
                }




                getAttachLifeInsurancesByOwnerId(record.productId).then(function(json){
                    if(json!==undefined&&json!==null)
                    {
                        plan.attachs=json;
                    }
                    else{
                        plan.attachs=null;
                    }
                    life_insurance_plans.push(plan);
                    if(i==records.length-1)
                        deferred.resolve(life_insurance_plans);
                });
            }
        });
    });
    return deferred.promise;
}


//获取寿险产品列表
function getLifeInsuranceProducts()
{
    var deferred = Q.defer();

    //获取主险列表,其中寿险计划以主险名字命名
    var sql = "select * from insurance_life_product where ownerId is null";
    sql = mysql.format(sql,null);
    using(getSqlConnection(), function(conn) {

        return conn.queryAsync(sql).then(function(records) {
            if (records && records.length > 0) {

                t(records).then(function(data) {
                    deferred.resolve({re:1,data:data});
                });

            }else{
                deferred.resolve({re:2});
            }
        })
    });
    return deferred.promise;
}

function getCarOrders(personId)
{
    var deferred = Q.defer();
    getCustomerIdByPersonId(personId).then(function(json) {
        if(json.re==1)
        {
            var sql = "select * from insurance_car_order where ??=?";
            var inserts=['customerId',json.id];
            sql =mysql.format(sql,inserts);
            using(getSqlConnection(), function(conn) {
                conn.queryAsync(sql).then(function (records) {
                    if (records && records.length > 0) {
                        deferred.resolve({re: 1, data: records});
                    } else {
                        deferred.resolve({re: 2});
                    }
                });
            });
        }else{}
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject({re: 1, data: str});
    });
    return deferred.promise;
}

function getScore(personId){

    var sql = 'select scoreTotal from insurance_customer where ?? =?';
    var inserts=['personId',personId];
    sql =mysql.format(sql,inserts);
    return using(getSqlConnection(),function(conn){
        return conn.queryAsync(sql).then(function(result){
            if(result && result.length > 0){
                return {re:1,total:result[0].scoreTotal};
            }else
                return {re: 2};
        })
    })

}

//返回寿险订单
function getLifeInsuranceOrders(personId){
    var deferred = Q.defer();
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    var customerId = null;
    return using(getSqlConnection(),function(conn){
        return conn.queryAsync(sql).then(function(result) {
            if(result &&result.length > 0){
                customerId = result[0].customerId;
            }
            var sql = "select * from insurance_life_order where ?? = ? ";
            var inserts = ['customerId', customerId];
            sql = mysql.format(sql, inserts);
            return conn.queryAsync(sql).then(function (records) {
                if (records && records.length > 0) {
                    t(records).then(function (data) {
                        deferred.resolve({re: 1, data: data});
                    });
                } else {
                    deferred.resolve({re: 2});
                }
            })
        });
        return deferred.promise;
    })
}



function addCarInfo(personId, carInfo) {
    var sql = "SELECT customerId FROM ?? WHERE ?? = ?";
    var inserts = ['insurance_car_customer', 'personId', personId];
    sql = mysql.format(sql, inserts);
    var customerId = null;
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0) {
                customerId = results[0].customerId;
            }
            var sql = "INSERT into insurance_car_info"
                + " (`carNum`, `engineNum`, `frameNum`, `factoryNum`, " +
                "`firstRegisterTime`, `ownerName`, `ownerIdCard`, `ownerAddress`, "+
                "`customerId`, `modifyTime`)"
                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            var inserts = [
                carInfo.carNum,
                carInfo.engineNum,
                carInfo.frameNum,
                carInfo.factoryNum,
                carInfo.firstRegisterTime,
                carInfo.ownerName,
                carInfo.ownerIdCard,
                carInfo.ownerAddress,
                customerId,
                new Date()
            ];
            sql = mysql.format(sql, inserts);
            return conn.queryAsync(sql);
        }, function (err) {
            logger.error(err);
            return (err);
        });
    });
}

function getCurDayOrderNum(type,customerId){
    var deferred = Q.defer();
    if(type!==undefined&&type!==null)
    {
        var table=null;
        switch(type)
        {
            case 'lifeInsurance':
                table='insurance_life_order';
                break;
            case 'carInsurance':
                table = 'insurance_car_order';
                break;
            default:
                break;
        }
        var date=new Date();
        var date_str=date.getFullYear()+((date.getMonth()+1).toString().length==1?('0'+(date.getMonth()+1)):(date.getMonth()+1))+
            (date.getDate().toString().length==1?('0'+date.getDate()):date.getDate());
        var sql = "select orderNum from insurance_life_order where orderNum like '%L"+date_str+"%' and customerId="+customerId;
        using(getSqlConnection(),function(conn) {
            conn.queryAsync(sql).then(function (results) {
                var num=0;
                if (results && results.length > 0) {
                    results.map(function(record,i) {
                        var subNum = record.orderNum.substring(9);
                        if(subNum>num)
                            num=subNum;
                    });

                }else{}


                num=parseInt(num)+1;
                if(num.toString().length<4)
                {
                    for(var i=num.toString().length;i<4;i++)
                        num='0'+num;
                }
                num=date_str+num;
                switch(type)
                {
                    case 'carInsurance':
                        num='C'+num;
                        break;
                    case 'lifeInsurance':
                        num='L'+num;
                        break;
                    default:
                        break;
                }
                deferred.resolve({re: 1, num: num});
            });
        });

    }else{
        deferred.resolve({re: -1});
    }
    return deferred.promise;
}

//生成寿险订单,orderNum为序列号
function generateLifeInsuranceOrder(personId,info)
{

    var deferred = Q.defer();
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    using(getSqlConnection(),function(conn){
        conn.queryAsync(sql).then(function(result) {
            var customerId=null;
            if(result &&result.length > 0){
                customerId = result[0].customerId;
            }
            //TODO:get the date last serial
            getCurDayOrderNum('lifeInsurance',customerId).then(function(json) {
                if(json.re==1)
                {
                    var orderNum=json.num;
                    var sql = "INSERT into insurance_life_order"
                        + "(`customerId`,`orderNum`,`orderState`,`insurancederId`,`insurerId`,`benefiterId`,`insuranceType`,"
                        +"`hasSocietyInsurance`,`hasCommerceInsurance`,`planInsuranceFee`,`orderStartDate`)"
                        + " VALUES (?,?,?,?,?,?,?,?,?,?,?)";

                    var inserts = [
                        customerId,
                        orderNum,
                        1,
                        info.insurancederId,
                        info.insureId,
                        info.benefiterId,
                        info.insuranceType,
                        info.hasSocietyInsurance,
                        info.hasCommerceInsurance,
                        info.planInsuranceFee,
                        new Date()
                    ];

                    sql = mysql.format(sql, inserts);
                    conn.queryAsync(sql).then(function(res) {
                        deferred.resolve({re: 1, data: res.insertId});
                    }).catch(function(err)
                    {
                        if(err.message!==undefined&&err.message!==null)
                        {
                            var str='';
                            for(var field in err.message)
                                str+=err.message[field];
                            console.error('error=\r\n'+str);
                        }
                        deferred.resolve({re: -1});
                    });
                }
            });


        });
    });
    return deferred.promise;
}


//获取关系用户
function getRelativePersons(personId) {
    var deferred = Q.defer();
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            var customerId = null;
            if (result && result.length > 0) {
                customerId = result[0].customerId;
            }
            sql="select perId from insurance_customer_relatives where ?? =?";
            inserts=['customerId',customerId];
            sql =mysql.format(sql,inserts);
            conn.queryAsync(sql).then(function(peoples) {
                var peos=[];
                if(peoples!=null&&peoples.length>0)
                {
                    peoples.map(function(people,i) {

                        sql='select personId from insurance_person where ?? =?';
                        inserts=['perId',people.perId];
                        sql =mysql.format(sql,inserts);
                        conn.queryAsync(sql).then(function(data){
                            var personId=data.personId;
                            sql='select perName from info_person_info where ?? =?';
                            inserts=['personId',personId];
                            conn.queryAsync(sql).then(function(data) {
                                var perName=data.perName;
                                peos.add({perId: people.perId, perName: perName});
                                if(i==peoples.length-1)
                                    deferred.resolve({re:1,data:peos});
                            });
                        });
                    });
                }else{
                    deferred.resolve({re: 2, data: null});
                }
            }).catch(function(err) {
                var str='';
                for(var field in err)
                    str+=field+':'+err[field];
                console.log('error=\r\n' + str);
                deferred.resolve({re: -1, data: null});
            });
        });
    });
    return deferred.promise;
}

//创建用户亲属依赖
function createInsuranceCustomerRelative(relType,customerId,perId)
{
    var deferred = Q.defer();
    var sql_base = "INSERT INTO insurance_customer_relatives" +
        " (`relType`,`customerId`,`perId`)" +
        " VALUES (?,?,?)";
    var sql_inserts = [relType,customerId,perId];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.');
                deferred.reject({re: -1, data: 'record insert encounter error'});
                conn.rollbackAsync();
            }else{
                deferred.resolve({re: 1,data:'insert successfully'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.log('error=\r\n' + str);
        });
    });
    return deferred.promise;
}

function createInsurancePerson(perType,personId){
    var deferred = Q.defer();
    var sql_base = "INSERT INTO insurance_person" +
        " (`perType`,`personId`)" +
        " VALUES (?,?)";
    var sql_inserts = [perType,personId];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.');
                deferred.reject({re: -1, data: 'record insert encounter error'});
                conn.rollbackAsync();
            }else{
                var id=result.insertId;
                deferred.resolve({re: 1,id:id});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.log('error=\r\n' + str);
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function createRelativePerson(personId,info) {
    var deferred = Q.defer();
    var sql_base = "INSERT INTO info_person_info" +
        " (`perName`)" +
        " VALUES (?)";
    var sql_inserts = [info.perName];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    var perId=null;
    var infoPersonInfoId=null;
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.');
                deferred.reject({re: -1, data: 'record insert encounter error'});
                conn.rollbackAsync();
                deferred.reject({re: -1, data: 'data insert encounter error'});
            }else{
                infoPersonInfoId=result.insertId;
                return {re: 1,perType:info.perType, id: infoPersonInfoId};
            }
        }).then(function(json){
            if(json.re==1) {
                return  createInsurancePerson(json.perType, json.id);
            }
            else
                deferred.reject({re: 2, data: ''});
        }).then(function(json) {
            perId=json.id;
            return getCustomerIdByPersonId(personId);
        }).then(function(json) {
            if(json.re==1)
            {
                return createInsuranceCustomerRelative(info.relType,json.id,perId);
            }
        }).then(function(json) {
            if(json.re==1)
            {
                var perIdCardPhoto=info.perIdCardPhoto;
                var carPhotoFilename = "data/perIdCard_" + infoPersonInfoId+'.'+perIdCardPhoto.type;
                return fs.writeFileAsync(carPhotoFilename, perIdCardPhoto.bin, "binary");
            }
            else
                deferred.reject({re: -1, data: 'error lastly'});
        }).then(function (json) {
            console.log('....');
            deferred.resolve({re: 1, data: 'successfully'});
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.log('error=\r\n' + str);
        });
    });

    return deferred.promise;
}

function rollbackTest(personId,info)
{
    var deferred = Q.defer();
    var sql_base = "INSERT INTO info_person_info" +
        " (`perName`)" +
        " VALUES (?)";
    var sql_inserts = [info.perName];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    var perId=null;
    using(getSqlConnection(),function(conn) {
        conn.beginTransaction(function(err) {
            if(err)
            {
                conn.rollback(function () {
                    promise.reject({re: -1, data: 'transaction begin error'});
                })
            }
            conn.queryAsync(info_query_sql).then(function (result) {
                if (!result.insertId || result.affectedRows == 0) {
                    deferred.reject({re: -1, data: 'data insert encounter error'});
                } else {
                    var id = result.insertId;
                    conn.rollbackAsync();
                    deferred.resolve({re: 1, data: 'rollback successfully'});
                }
            });
        });

    });

    return deferred.promise;
}

//创建附件
function createAttachment(personId,info)
{
    var deferred = Q.defer();
    var sql_base = "INSERT INTO base_attachment_info" +
        " (`ownerId`,`docType`,`urlAddress`)" +
        " VALUES (?,?,?)";
    var sql_inserts = [personId,info.docType,info.url];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.');
                deferred.reject({re: -1, data: 'record insert encounter error'});
            }else{
                deferred.resolve({re: 1,data:'insert successfully'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.log('error=\r\n' + str);
            deferred.reject({re: -1});
        });
    });

    return deferred.promise;
}


function insertCarOrderPriceItem(priceId,productId,info) {
    var deferred= Q.defer();
    var sql = "INSERT into insurance_car_order_price_item"
        + "(`priceId`,`productId`,`irrespective`)"
        + " VALUES (?,?,?)";
    var params = [
        priceId,
        productId,
        info.irrespective==true?true:null
    ];
    sql = mysql.format(sql, params);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.insertId!==undefined&&result.insertId!==null)
            {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        });
    });

    return deferred.promise;
}

function generateCarOrderPriceItem(priceId,products)
{
    var deferred= Q.defer();
    var tasks={
        count:0,
        target:products.length
    }

    for(var i=0;i<products.length;i++)
    {
        var product=products[i];
        var func=function(ob) {
            insertCarOrderPriceItem(priceId,product.productId,product).then(function(json) {
                if(json.re==1)
                {
                    ob.count++;
                    if(ob.count==ob.target)
                        deferred.resolve({re: 1});
                }
            });
        };
        func(tasks);
    }


    return deferred.promise;
}

function generateCarOrderPriceItems(priceIds,info)
{
    var deferred= Q.defer();
    var statistics={
        count:0,
        target:info.products.length
    }
    for(var i=0;i<priceIds.length;i++)
    {
        var priceId=priceIds[i];
        var func=function(ob){
            generateCarOrderPriceItem(priceId,info.products).then(function(json) {
                if(json.re==1)
                {
                    ob.count++;
                    if(ob.count==ob.target)
                        deferred.resolve({re: 1});
                }
            });
        }
        func(statistics);
    }
    return deferred.promise;
}

function generateCarOrderPrice(orderId,info) {
    var deferred= Q.defer();
    var companys=info.companys;
    var tasks={
        target:companys.length,
        priceIds:[]
    };
    using(getSqlConnection(),function(conn) {
        var sql = "INSERT into insurance_car_order_price"
            + "(`orderId`,`companyId`,`isConfirm`)"
            + " VALUES (?,?,?)";


        for(var i=0;i<companys.length;i++)
        {
            var company=companys[i];
            var inserts = [
                orderId,
                company.companyId,
                0
            ];
            sql = mysql.format(sql, inserts);
            var cb=function(ob,con){
                con.queryAsync(sql).then(function (result) {
                    if (!result.insertId || result.affectedRows == 0) {
                        deferred.reject({re: -1, data: null});
                    }else{
                        ob.priceIds.push(result.insertId);
                        if(ob.priceIds.length==ob.target)
                            deferred.resolve({re: 1, data: ob.priceIds});
                    }
                });
            }
            cb(tasks,conn);
        }
    });

    return deferred.promise;
}

function getCarIdByCarNum(carNum) {
    var deferred= Q.defer();

    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result!=null&&result.length>0)
            {
                deferred.resolve({re: 1, data: result[0].carId});
            }
            else{
                deferred.resolve({re:2,data:null});
            }
        }).catch(function (err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.error('error=\r\n' + str);
        });
    });
    return deferred.promise;
}

function createCarOrder(customerId,orderNum,carId)
{
    var deferred= Q.defer();



    var sql = "INSERT into insurance_car_order"
        + "(`customerId`,`orderNum`,`orderState`,"
        +"`orderDate`,`carId`)"
        + " VALUES (?,?,?,?,?)";
    var inserts = [
        customerId,
        orderNum,
        1,
        new Date(),
        carId
    ];
    var sql =mysql.format(sql,inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function(result) {
            if (!result.insertId || result.affectedRows == 0) {
                deferred.reject({re: -1});
            }
            else
                deferred.resolve({re: 1, data: result.insertId});
        }).catch(function(err) {
            var str='';
            for(var field in err)
            {
                str+=err[field];
            }
            deferred.reject({re: -1, data: str});
        });
    });


    return deferred.promise;
}



function generateCarInsuranceOrder(personId,info) {
    var deferred= Q.defer();
    var customerId=null;
    var orderNum=null;
    getCustomerIdByPersonId(personId).then(function(json) {
        if(json.re==1)
        {
            customerId=json.id;
            return getCurDayOrderNum('carInsurance',customerId);
        }else{
            deferred.reject({re: -1, data: ''});
        }
    }).then(function(json) {
        if(json.re==1)
        {
            orderNum=json.num;
            return createCarOrder(customerId, orderNum,info.carId);
        }
    }).then(function(json) {

        var orderId = json.data;
        return generateCarOrderPrice(orderId, info);

    }).then(function(json) {
        if(json.re==1)
        {
            var priceIds=json.data;
            return generateCarOrderPriceItems(priceIds,info);
        }
    }).then(function(json) {
        if(json.re==1)
        {
            deferred.resolve({re: 1, data: ''});
        }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject({re: -1, data: str});
    });
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            var customerId = null;
            if (result && result.length > 0) {
                customerId = result[0].customerId;
            }
        });
    });

    return deferred.promise;
}

function getCurDayOrderNumTest(personId,info) {
    var deferred= Q.defer();
    var customerId=null;
    getCustomerIdByPersonId(personId).then(function(json) {
        if(json.re==1)
        {
            customerId=json.id;
            return getCurDayOrderNum(info.type,customerId);
        }else{
            deferred.reject({re: -1, data: ''});
        }
    }).then(function(json) {
        if(json.re==1)
        {
            var num=json.num;
            console.log('...');
            deferred.resolve({re: 1, data: num});
        }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str += err[field];
        deferred.reject({re: -1, data: str});
    });


    return deferred.promise;
}


function getCarInsuranceProducts(conn,id)
{
    var deferred= Q.defer();

    var sql_base='select * from insurance_car_product where productId='+id;
    conn.queryAsync(sql_base).then(function (result) {
        deferred.resolve({re: 1, data: result[0]});
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject({re: -1, data: str});
    });

    return deferred.promise;
}


function getProductMeal(conn,mealId)
{
    var deferred= Q.defer();
    sql_base= "select productId from insurance_car_product_meal where mealId ="+mealId;
    info_query_sql = mysql.format(sql_base,null);
    conn.queryAsync(info_query_sql).then(function (pms) {
        var ids=[];
        pms.map(function(pm,i) {
            ids.push(pm.productId);
        });
        deferred.resolve({re: 1, data: ids});
    });

    return deferred.promise;
}

function getCarInsuranceMealsProduct(conn,meals){
    var deferred= Q.defer();
    var mealSize=meals.length;
    var ob={
        meal_set:[]
    };
    for(var i=0;i<meals.length;i++)
    {
        var mealName=meals[i].mealName;
        var cb=function(name,obj){

            getProductMeal(conn,meals[i].mealId).then(function(json) {
                if(json.re==1)
                {
                    var meal={};
                    meal.mealName=name;
                    meal.products=[];
                    var ids=json.data;
                    ids.map(function(id,j) {
                        getCarInsuranceProducts(conn,id).then(function(json) {
                            if(json.re==1)
                            {
                                meal.products.push(json.data);
                                if(meal.products.length==ids.length)
                                {
                                    obj.meal_set.push(meal);
                                    if(obj.meal_set.length==mealSize)
                                        deferred.resolve({re: 1, data: obj.meal_set});
                                }
                            }
                        });
                    });
                }
            }).catch(function(err) {
                var str='';
                for(var field in err)
                    str+=err[field];
                deferred.reject({re: -1, data: str});
            });
        }
        cb(mealName,ob);
    }
    return deferred.promise;
}

function getCarInsuranceMeals()
{
    var deferred= Q.defer();
    var sql_base = "select * from insurance_car_meal";
    var info_query_sql = mysql.format(sql_base, null);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (records) {
            if(records!=null&&records.length>0)
            {
                return getCarInsuranceMealsProduct(conn,records);
            }else{
                deferred.reject({re: -1, data: null});
            }
        }).then(function(json) {
            if(json.re==1)
            {
                deferred.resolve({re: 1, data: json.data});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            console.log('error=\r\n' + str);
            deferred.reject({re: -1});
        });
    });
    return deferred.promise;
};

function getOrderState(orderId)
{
    var deferred=Q.defer();
    var sql = "select orderState FROM insurance_life_order WHERE orderId = ?";
    var inserts = [orderId];
    sql = mysql.format(sql, inserts);
    using(getSqlConnection(sql), function(conn) {
        conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0 ) {
                deferred.resolve({re: 1, state:results[0].orderState});

            };
        });
    });
    return deferred.promise;
};



function getInsuranceCompany() {
    var deferred = Q.defer();
    var sql_base = 'select * from insurance_company_info where ownerId is null';
    using(getSqlConnection(), function (conn) {
        conn.queryAsync(sql_base).then(function (records) {
            deferred.resolve({re: 1, data: records});
        }).catch(function (err) {
            var str = '';
            for (var field in err)
                str += err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
};


function getOrderPlan(orderId)
{


    var deferred=Q.defer();
    var sql = "select * FROM insurance_life_order_plan WHERE orderId = ?";
    var inserts = [orderId];
    sql = mysql.format(sql, inserts);

    var data={
        plans:[]
    };
    using(getSqlConnection(sql), function(conn) {
        conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0 ) {
                var statistics={
                    count:0,
                    target:results.length
                };

                for(var i=0;i<results.length;i++)
                {
                    var plan=results[i];
                    var cb=function(ob,item)
                    {
                        getLifeInsuranceCompanyByCompanyId(item.companyId).then(function(json){
                            if(json.re==1){
                                item.companyName=json.data.companyName;
                                getOrderPlanItem(item.planId).then(function(json){
                                    if(json.re==1){
                                        ob.count++;
                                        item.items=json.data;
                                        data.plans.push(item);
                                        if(ob.count==ob.target)
                                            deferred.resolve({re: 1,data:data.plans});
                                    }
                                });

                            }
                        })

                    }
                    cb(statistics,plan);
                }

            };
        });
    });

    return deferred.promise;
}

function getOrderPlanItem(planId)
{
    var deferred=Q.defer();
    var sql = "select * FROM insurance_life_order_plan_item WHERE planId = ?";
    var inserts = [planId];
    sql = mysql.format(sql, inserts);

    using(getSqlConnection(sql), function(conn) {
        conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0 ) {
                var statistics={
                    target:results.length,
                    items:[]
                };

                for(var i=0;i<results.length;i++){
                    var item=results[i];
                    var cb=function(ob,singleton){
                        getLifeInsuranceProductByProductId(singleton.productId)
                            .then(function(json){
                                singleton.productName=json.data.productName;
                                singleton.ownerId=json.data.ownerId;
                                singleton.insuranceQuota=json.data.insuranceQuota;
                                singleton.insuranceFeeYear=json.data.insuranceFeeYear;
                                singleton.insuranceFee=json.data.insuranceFee;
                                if(json.re==1){
                                    ob.items.push(singleton);
                                    if(ob.items.length==ob.target)
                                        deferred.resolve({re:1,data:ob.items});
                                }
                            });
                    }

                    cb(statistics,item);
                };

            };
        });
    });
    return deferred.promise;
}

function getLifeInsuranceCompanyByCompanyId(companyId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_company_info where ?? = ?';
    var inserts=['companyId',companyId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                var company=records[0];
                deferred.resolve({re:1,data:company});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });


    return deferred.promise;
}

function getLifeInsuranceProductByProductId(productId) {
    var deferred= Q.defer();
    var sql_base='select * from insurance_life_product where ?? = ?';
    var inserts=['productId',productId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                deferred.resolve({re:1,data:records[0]});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function checkCarOrderState(orderId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_car_order where ?? = ?';
    var inserts=['orderId',orderId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                deferred.resolve({re:1,state:records[0].orderState})
            }else{
                deferred.resolve({re: 2, state: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getCarInsuranceProductByProductId(productId) {
    var deferred= Q.defer();
    var sql_base='select * from insurance_car_product where ?? = ?';
    var inserts=['productId',productId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                deferred.resolve({re:1,data:records[0]});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getCarOrderPriceItemsByPriceId(priceId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_car_order_price_item where ?? = ?';
    var inserts=['priceId',priceId];
    var sql = mysql.format(sql_base, inserts);



    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                var statistics={
                    count:0,
                    target:records.length,
                    items:[]
                };
                for(var i=0;i<records.length;i++)
                {
                    var priceItem=records[i];
                    var func=function(ob,singleton){
                        getCarInsuranceProductByProductId(singleton.productId).then(function(json) {
                            if(json.re==1)
                            {
                                var product=json.data;
                                singleton.productName=product.productName;
                                ob.items.push(singleton);
                                if(ob.items.length==ob.target)
                                    deferred.resolve({re:1,data:ob.items});
                            }
                        });
                    }
                    func(statistics,priceItem);
                }
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getCarOrderPrices(orderId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_car_order_price where ?? = ?';
    var inserts=['orderId',orderId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                deferred.resolve({re:1,data:records});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getCarInsuranceCompanyByCompanyId(companyId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_company_info where ?? = ?';
    var inserts=['companyId',companyId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (records) {
            if(records!==null&&records.length>0)
            {
                var company=records[0];
                deferred.resolve({re:1,data:company});
            }else{
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });

    return deferred.promise;
}


function getCarOrderPriceItemsByPriceIds(prices)
{
    var deferred= Q.defer();

    var statistics={
        count:0,
        target:prices.length,
        prices:[]
    }
    for(var i=0;i<prices.length;i++)
    {
        var price=prices[i];
        var cb=function(ob,singleton)
        {
            getCarInsuranceCompanyByCompanyId(singleton.companyId).then(function(json) {
                if(json.re==1)
                {
                    var company=json.data;
                    singleton.companyName=company.companyName;
                    getCarOrderPriceItemsByPriceId(singleton.priceId).then(function(json) {
                        if(json.re==1)
                        {
                            singleton.items=json.data;
                            ob.prices.push(singleton);
                            if(ob.prices.length==ob.target)
                                deferred.resolve({re: 1, data: ob.prices});
                        }
                    });
                }else{
                    deferred.reject({re: 2, data: null});
                }
            });
        }
        cb(statistics,price);
    }
    return deferred.promise;
}

function getCarOrderPriceItems(orderId)
{
    var deferred= Q.defer();
    getCarOrderPrices(orderId).then(function(json) {
        if(json.re==1)
        {
            var prices=json.data;
            return getCarOrderPriceItemsByPriceIds(prices);
        }else{
            deferred.reject({re: 2, data: null});
        }
    }).then(function(json) {
        if(json.re==1)
        {
            deferred.resolve({re: 1, data: json.data});
        }else{
            deferred.resolve({re: 2, data: 'data is null'});
        }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject({re: -1, data: str});
    });
    return deferred.promise;
}

function selectLifeOrderPlan(personId,planId)
{
    var deferred= Q.defer();
    var sql_base='update insurance_life_order_plan set ?? = ?, ?? = ?  where ?? = ?';
    var inserts=['userSelect',1,'modifyId',personId,'planId',planId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.affectedRows>0) {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.reject({re: -1, data: 'update encounter failure'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function setLifeOrderState(orderId,state) {
    var deferred= Q.defer();
    var sql_base='update insurance_life_order set ?? = ? where ?? = ?';
    var inserts=['orderState',state,'orderId',orderId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.affectedRows>0) {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.reject({re: -1, data: 'update encounter failure'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}


/**
 *  接口已测
 */
function userApplyUnchangedLifeOrder(personId,info) {
    var deferred= Q.defer();

    getCustomerIdByPersonId(personId).then(function (json) {
       if(json.re==1)
       {
           var customerId=json.id;
           var orderId=info.orderId;
           setLifeOrderState(orderId,4).then(function(json) {
                if(json.re==1) {
                  var planIds=info.planIds;
                  var statistics={
                      count:0,
                      target:planIds.length
                  }
                  for(var i=0;i<planIds.length;i++) {
                      var planId=planIds[i];
                      var cb=function(ob,perId,item){
                          selectLifeOrderPlan(perId,item).then(function(json) {
                              if(json.re==1) {
                                  ob.count++;
                                  if(ob.count==ob.target)
                                      deferred.resolve({re: 1, data: ''});
                              }
                          });
                      }
                      cb(statistics,personId,planId);

                  };
              }
           });



       }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        console.error('error=\r\n' + str);
    });
    return deferred.promise;
}


function updateLifeOrderPlanItem(item) {
    var deferred= Q.defer();
    var sql_base='';
    var inserts='';
    if(item.ownerId!==undefined&&item.ownerId!==null)//附加险
    {
        sql_base='update insurance_life_order_plan_item set ?? = ? where ?? = ?';
        inserts=['productCount',item.productCount,'itemId',item.itemId];
    }else{
        sql_base='update insurance_life_order_plan_item set ?? = ? , ?? = ? where ?? = ?';
        inserts=['insuranceFee',item.insuranceFee,'insuranceQuota',item.insuranceQuota,'itemId',item.itemId];
    }
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.affectedRows>0) {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.reject({re: -1, data: 'update encounter failure'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function updateLifeOrderPlanItems(items) {
    var deferred= Q.defer();
    var statistics={
        count:0,
        target:items.length
    }
    for(var i=0;i<items.length;i++) {
        var planItem=items[i];
        var cb=function(ob,item) {
            updateLifeOrderPlanItem(item).then(function(json) {
               if(json.re==1)
               {
                   ob.count++;
                   if(ob.count==ob.target)
                       deferred.resolve({re: 1, data: ''});
               }
            });
        };
        cb(statistics, planItem);
    }
    return deferred.promise;
}
function updateLifeOrderPlan(plan) {
    var deferred= Q.defer();
    var sql_base='update insurance_life_order_plan set ?? = ? , ?? = ?  where ?? = ?';
    var inserts=['userSelect',1,'modifyTime',new Date(),'planId',plan.planId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.affectedRows>0) {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.reject({re: -1, data: 'update encounter failure'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });

    return deferred.promise;
}

function updateLifeOrderPlans(plans)
{
    var deferred= Q.defer();
    var statistics={
        count:0,
        target:plans.length
    }
    for(var i=0;i<plans.length;i++) {
        var plan=plans[i];
        var cb=function(ob,item) {
            updateLifeOrderPlan(item).then(function(json) {
               if(json.re==1) {
                   updateLifeOrderPlanItems(item.items).then(function (json) {
                      if(json.re==1)
                      {
                          ob.count++;
                          if(ob.count==ob.target)
                              deferred.resolve({re: 1, data: ''});
                      }
                   });
               }
            });
        };
        cb(statistics,plan);
    }
    return deferred.promise;
}


/***测试此接口***/
function userUpdateLifeOrder(info) {
    var deferred= Q.defer();
    var plans=info.plans;
    var orderId=info.orderId;
    updateLifeOrderPlans(plans).then(function(json) {
       if(json.re==1)
       {
           return setLifeOrderState(orderId, 1);
       }
    }).then(function(json) {
      if(json.re==1)
      {
          deferred.resolve({re: 1, data: ''});
      }else{
          deferred.resolve({re: 2, data: ''});
      }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        console.error('error=\r\n' + str);
    });

    return deferred.promise;
}

function setCarOrderState(orderId,state) {
    var deferred= Q.defer();
    var sql_base='update insurance_car_order set  ?? = ?  where ?? = ?';
    var inserts=['orderState',state,'orderId',orderId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.affectedRows>0) {
                deferred.resolve({re: 1, data: ''});
            }else{
                deferred.reject({re: -1, data: 'update encounter failure'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function insertCarOrderItem(orderId,item)
{
    var deferred= Q.defer();
    var sql_base = "INSERT INTO insurance_car_order_item" +
        " (`orderId`, `productId`, `insuranceFee`)" +
        " VALUES (?, ?, ?)";
    var inserts = [orderId,item.productId , item.insuranceFee];

    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (result) {
            if(result.insertId!==undefined&&result.insertId!==null)
            {
                deferred.resolve({re: 1, data:''});
            }else{
                deferred.reject({re: 1, data: 'inject encounter error'});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function insertCarOrderItems(orderId,price) {
    var deferred= Q.defer();
    var statistics={
        count:0,
        target:price.items.length
    }
    for(var i=0;i<price.items.length;i++)
    {
        var priceItem=price.items[i];
        var cb=function(ob,id,item)
        {
            insertCarOrderItem(id,item).then(function(json) {
                if(json.re==1) {
                    ob.count++;
                    if(ob.count==ob.target)
                        deferred.resolve({re: 1, data: ''});
                }
            })
        }
        cb(statistics,orderId,priceItem);
    }

    return deferred.promise;
}

function userApplyCarOrder(info) {
    var deferred= Q.defer();
    var price=info.price;
    var orderId=info.orderId;
    insertCarOrderItems(orderId,price).then(function(json) {
        if(json.re==1)
        {
            return setCarOrderState(orderId,4);
        }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str += err[field];
        deferred.reject({re: -1, data: str});
    });

    return deferred.promise;
}

function getLifeProductDetail(productId,feeYearCount) {
    var deferred= Q.defer();

    return deferred.promise;
}

function getLifeOrderItemDetailScore(productId) {

    var deferred= Q.defer();
    var sql_base='select * from insurance_life_product_detail where ?? = ?';
    var inserts=['productId',productId];

    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
            if(results.length!==undefined&&results!==null&&results.length>0)
            {

            }
            else
            {
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getLifeOrderPlanItemsByPlanId(planId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_life_order_plan_item where ?? = ?';
    var inserts=['planId',planId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
            if(results.length!==undefined&&results!==null&&results.length>0)
            {
                deferred.resolve({re: 1, data: results});
            }
            else
            {
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getLifeOrderPlanItemScore(itemId)
{
    var deferred= Q.defer();
    var sql_base='select * from insurance_life_order_plan where ?? = ?';
    var inserts=['orderId',orderId];

    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
            if(results.length!==undefined&&results!==null&&results.length>0)
            {
                deferred.resolve({re: 1, data: results});
            }
            else
            {
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getLifeOrderPlanItemsScore(planId) {
    var deferred= Q.defer();
    var sql_base='select * from insurance_life_order_plan_item where ?? = ?';
    var inserts=['planId',planId];

    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
            if(results.length!==undefined&&results!==null&&results.length>0)
            {
                var items=results;
                var statistics={
                    count:0,
                    score:0,
                    target:results.length
                };
                for(var i=0;i<results.length;i++) {
                    var planItem=results[i];
                    var cb=function(ob,item){
                        getLifeOrderPlanItemScore(item.itemId).then(function(json) {
                            if(json.re==1)
                            {
                                var score=json.score;
                                ob.count++;
                                ob.score+=score;
                                if(ob.count==ob.target)
                                    deferred.resolve({re: 1, data: ob.score});
                            }
                        });
                    }
                    cb(statistics,planItem)
                }
            }
            else
            {
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getLifeOrderSelectedPlanItems(personId,plans) {
    var deferred= Q.defer();
    var statistics={
        count:0,
        score:0,
        target:plans.length
    };

    for(var i=0;i<plans.length;i++) {
        var plan=plans[i];

        var cb=function(ob,item)
        {
            getLifeOrderPlanItemsScore(item.planId).then(function(json) {
               if(json.re==1)
               {
                   ob.count++;
                   ob.score+=json.score;
                   if(ob.count==ob.target)
                       deferred.resolve({re: 1, data:ob.score});
               }
            });
        }
        cb(statistics,plan);
    }



    var sql_base='select * from insurance_life_order_plan where ?? = ?';
    var inserts=['orderId',orderId];
    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
            if(results.length!==undefined&&results!==null&&results.length>0)
            {
                deferred.resolve({re: 1, data: results});
            }
            else
            {
                deferred.resolve({re: 2, data: null});
            }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}

function getLifeOrderSelectedPlans(orderId){
    var deferred= Q.defer();
    var sql_base='select * from insurance_life_order_plan where ?? = ?';
    var inserts=['orderId',orderId];

    var sql = mysql.format(sql_base, inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(sql).then(function (results) {
           if(results.length!==undefined&&results!==null&&results.length>0)
           {
               deferred.resolve({re: 1, data: results});
           }
            else
           {
               deferred.resolve({re: 2, data: null});
           }
        }).catch(function(err) {
            var str='';
            for(var field in err)
                str+=err[field];
            deferred.reject({re: -1, data: str});
        });
    });
    return deferred.promise;
}


function getLifeOrderScore(personId,orderId) {
    var deferred= Q.defer();
    getLifeOrderSelectedPlans(orderId).then(function(json) {
        if(json.re==1) {
            var plans=json.data;
            return getLifeOrderSelectedPlanItems(personId,plans);
        }
    }).then(function(json) {
      if(json.re==1)
      {
          deferred.resolve({re: 1, score: json.score});
      }
    }).catch(function(err) {
        var str='';
        for(var field in err)
            str+=err[field];
        deferred.reject({re: -1, data: str});
    });

    return deferred.promise;
}


module.exports = {
    init: init,
    verifyUserPasswd: verifyUserPasswd,
    registerUser: registerUser,
    getPersonId: getPersonId,
    addCarInfo: addCarInfo,
    getCarAndOwnerInfo: getCarAndOwnerInfo,
    getLifeInfo:getLifeInfo,
    changePassword:changePassword,
    getLifeInsuranceProducts:getLifeInsuranceProducts,
    getLifeInsuranceOrders:getLifeInsuranceOrders,
    getCarOrders:getCarOrders,
    getScore:getScore,
    generateLifeInsuranceOrder:generateLifeInsuranceOrder,
    generateCarInsuranceOrder:generateCarInsuranceOrder,
    getRelativePersons:getRelativePersons,
    createRelativePerson:createRelativePerson,
    createInsurancePerson:createInsurancePerson,
    rollbackTest:rollbackTest,
    createAttachment:createAttachment,
    getCurDayOrderNumTest:getCurDayOrderNumTest,
    getCarInsuranceMeals:getCarInsuranceMeals,
    getOrderState:getOrderState,
    getOrderPlan:getOrderPlan,
    getOrderPlanItem:getOrderPlanItem,
    getInsuranceCompany:getInsuranceCompany,
    checkCarOrderState:checkCarOrderState,
    getCarOrderPriceItems:getCarOrderPriceItems,
    userApplyUnchangedLifeOrder:userApplyUnchangedLifeOrder,
    userUpdateLifeOrder:userUpdateLifeOrder,
    userApplyCarOrder:userApplyCarOrder,
    getLifeOrderScore:getLifeOrderScore

}
