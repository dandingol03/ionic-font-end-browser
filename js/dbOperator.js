var Promise = require('bluebird');
var Q = require('q');
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

function getCarInfo(personId) {
    var sql = "SELECT customerId FROM ?? WHERE ?? = ?";
    var inserts = ['insurance_car_customer', 'personId', personId];
    sql = mysql.format(sql, inserts);
    var customerId = null;
    return using(getSqlConnection(), function(conn) {
        return conn.queryAsync(sql).then(function(results) {
            if (results && results.length > 0) {
                customerId = results[0].customerId;
            }
            var sql = "select `carNum`, `engineNum`, `frameNum`, `factoryNum`, " +
            "`firstRegisterTime`, `ownerName`, `ownerIdCard`, `ownerAddress`, "+
            "`modifyTime` from insurance_car_info where ?? =?";
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
    var sql = "select customerId from insurance_customer where ?? =?";
    var inserts = ['personId',personId];
    sql =mysql.format(sql,inserts);
    var customerId = null;
    return using(getSqlConnection(),function(conn){
        return conn.queryAsync(sql).then(function(result) {
            if(result &&result.length > 0){
                customerId = result[0].customerId;
            }
            var sql = "select * from insurance_car_order where ?? = ? ";
            var inserts = ['customerId', customerId];
            sql = mysql.format(sql, inserts);
            return conn.queryAsync(sql).then(function (records) {
                if (records && records.length > 0) {
                    //get orders
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

function getCurDayOrderNum(type){
    var deferred = Q.defer();
    if(type!==undefined&&type!==null)
    {
        var table=null;
        switch(type)
        {
            case 'life_insurance':
                table='insurance_life_order';
                break;
            case 'car_insurance':
                table = 'insurance_car_order';
                break;
            default:
                break;
        }
        var date=new Date();
        var date_str=date.getFullYear()+((date.getMonth().toString()+1).length==1?('0'+(date.getMonth()+1)):(date.getMonth()+1))+
            (date.getDate().toString().length==1?('0'+date.getDate()):date.getDate());
        var sql = "select orderNum from insurance_life_order where orderNum like '%L"+date_str+"%'";
        using(getSqlConnection(),function(conn) {
            conn.queryAsync(sql).then(function (results) {
                if (results && results.length > 0) {
                    var num=0000;
                    results.map(function(record,i) {
                        var subNum = record.orderNum.substring(9);
                        if(subNum>num)
                        num=subNum;
                    });

                }else{}
                if(num!=0000)
                    num=date_str+(num+1);
                else
                    num=date_str+num;
                deferred.resolve({re: 1, orderNum: num});
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
             getCurDayOrderNum.then(function(json) {
                if(json.re==1)
                {
                    var orderNum=json.orderNum;
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
                        deferred.resolve({re: 1, data: res});
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
                deferred.resolve({re: 1,data:id});
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

function createRelativePerson(personId,info) {
    var deferred = Q.defer();
    var sql_base = "INSERT INTO info_person_info" +
        " (`perName`)" +
        " VALUES (?)";
    var sql_inserts = [info.perName];
    var info_query_sql = mysql.format(sql_base, sql_inserts);
    using(getSqlConnection(),function(conn) {
        conn.queryAsync(info_query_sql).then(function (result) {
            if (!result.insertId || result.affectedRows == 0) {
                logger.error('info_person_info not affected or no id generated.');
                deferred.reject({re: -1, data: 'record insert encounter error'});
                conn.rollbackAsync();
                deferred.reject({re: -1, data: 'data insert encounter error'});
            }else{
                var id=result.insertId;
                return {re: 1,perType:info.perType, id: id};
            }
        }).then(function(json){
            if(json.re==1) {
                createInsurancePerson(json.perType, json.id).then(function (json) {
                    if(json.re==1)
                    {
                        return {re:1,perId:json.id};
                    }
                });
            }
            else
                deferred.reject({re: 2, data: ''});
        }).then(function(json) {
            if(json.re==1)
            {
                createInsuranceCustomerRelative(info.relType,info.customerId,json.perId).then(function(json) {
                   if(json.re==1)
                       deferred.resolve({re: 1, data: 'successfully lastly'});
                    else
                       deferred.reject({re: -1, data: 'error lastly'});
                });
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

module.exports = {
    init: init,
    verifyUserPasswd: verifyUserPasswd,
    registerUser: registerUser,
    getPersonId: getPersonId,
    addCarInfo: addCarInfo,
    getCarInfo: getCarInfo,
    getLifeInfo:getLifeInfo,
    changePassword:changePassword,
    getLifeInsuranceProducts:getLifeInsuranceProducts,
    getLifeInsuranceOrders:getLifeInsuranceOrders,
    getCarOrders:getCarOrders,
    getScore:getScore,
    generateLifeInsuranceOrder:generateLifeInsuranceOrder,
    getRelativePersons:getRelativePersons,
    createRelativePerson:createRelativePerson,
    createInsurancePerson:createInsurancePerson
}
