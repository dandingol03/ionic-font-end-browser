var log4js = require('log4js');
var logConf = require('../config.js').logConf;
log4js.configure(logConf);
var logger = log4js.getLogger('securityCodeProc');
var redis = require('redis'),
  redisConf = require('../config.js').redisConf;
var request = require('request');

var db = redis.createClient(redisConf);


function gen253(cellphone,callback){
  var msg = 'hi,it is a msg callback';
  var url='http://222.73.117.156/msg/HttpBatchSendSM?account=jiekou-bjcs-01&pswd=BGHhuhj5ss&mobile='+
      cellphone+'&msg='+msg+'&needstatus=true';
  request
      .get(url)
      .on('response', function(response) {
        console.log(response.statusCode) // 200
        callback(null,'1234');
      });
}

function generateVerifyCode(cellphone, callback) {
  callback(null, "1234");
}

module.exports = function(req, res) {
  if (!req.query.cellphone) {
    return res.json({result: 'error', errMsg: "missing_cellphone_num"});
  }

  gen253(req.query.cellphone,function (codeErr, code) {
    if (!codeErr) {
      var args = [req.query.cellphone, code, "EX", 300];
      db.set(args, function (redisErr, redisRes) {
        if (!redisErr) {
          res.json({result: 'ok'});
        } else {
          res.json({result: 'error', errMsg: "redis_op_error"});
        }
      });
    } else {
      res.json({result: 'error', errMsg: "generate_verify_code_fail"});
    }
  });



}
