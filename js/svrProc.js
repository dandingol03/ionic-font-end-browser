var log4js = require('log4js');
var logConf = require('../config.js').logConf;
log4js.configure(logConf);
var logger = log4js.getLogger('svrProc');
var dblogger = log4js.getLogger('dbOperator');
var dbConf = require('../config.js').dbConf;
var ftpRoot=require('../config.js').ftpRoot;
var dbOperator = require('../js/dbOperator.js');
var fs = require('fs');
var Promise = require('bluebird');
var formidable = require('formidable');
Promise.promisifyAll(fs);

dbOperator.init(dbConf, dblogger);

function uploadCarAndOwnerInfo(personId, carInfo, httpResponse) {
  if (carInfo && carInfo.carPhoto && carInfo.ownerIdPhoto) {
    var carPhotoFilename = "data/carPhoto_" + personId;
    var ownerIdFilename = "data/ownerIdPhoto_" + personId;
    return fs.writeFileAsync(carPhotoFilename, carInfo.carPhoto, "binary").then(function(res){
      return fs.writeFileAsync(ownerIdFilename, carInfo.ownerIdPhoto, "binary");
    }).then(function (res) {
      return dbOperator.addCarInfo(personId, carInfo);
    }).then(function (res) {
      httpResponse.json({result: "ok"});
    }, function(err){
      logger.error(JSON.stringify(err));
      httpResponse.json({result: "error", errMsg: "svr_fail"});
    });
  } else {
    httpResponse.json({result: "error", errMsg: "missing_image"});
  }
}

function uploadPhoto(personId,imageType,suffix,req,httpResponse)
{
  var form = new formidable.IncomingForm();
  form.uploadDir =__dirname+'/../data/';
  var dir=__dirname+'/../data/';
  dir=ftpRoot.base+ftpRoot.branches[imageType]+'/'+personId;

  form.parse(req, function(error, fields, files) {
    fs.renameSync(files.file.path, dir+'/'+imageType+'.'+suffix);
    httpResponse.json({re: 1});
  });

  httpResponse.json({result: "ok"});
}

module.exports = function(req, res) {
  var personId = req.user.id;
  var cmd = "";
  if (req.body.request) {
    cmd = req.body.request;
  } else if (req.params.request) {
    cmd = req.params.request;
  } else {
    cmd = req.query.request;
  }
  switch (cmd) {
    case 'getInsuranceCompany':
      dbOperator.getInsuranceCompany().then(function (re) {
        res.json(re);
      })
      break;
    case "uploadCarAndOwnerInfo":
      uploadCarAndOwnerInfo(personId, req.body.info, res);
      break;

    case "getOrderState":
      dbOperator.getOrderState(req.body.orderId).then(function (result) {
        res.json({result: "ok", carInfo: result});
      })
      break;

    case "getOrderPlan":
      dbOperator.getOrderPlan(req.body.orderId).then(function (result) {
        res.json(result);
      })
      break;

    case "getCarAndOwnerInfo":
      dbOperator.getCarAndOwnerInfo(personId).then(function (result) {
        res.json({result: "ok", carInfo: result});
      })
      break;
    case  "getLifeInsuranceList":
      var companyId=req.body.companyId;
      if(companyId!==undefined&&companyId!==null&&!isNaN(parseInt(companyId)))
      {
        dbOperator.getLifeInfo(companyId).then(function(result){
          res.json({result:"ok",lifeInfo:result});
        });
      }
      break;
    case  "passwordModify":
      dbOperator.changePassword(personId,req.body.info).then(function(re){
        res.json(re);
      })
      break;
    case "getLifeInsuranceProducts":
      dbOperator.getLifeInsuranceProducts().then(function(re){
        res.json(re);
      })
      break;
    case "uploadPhoto":
      uploadPhoto(personId, req.query.imageType,req.query.imageName, req,res);
      break;
    case 'getCarOrders':
      dbOperator.getCarOrders(personId).then(function (re) {
        res.json(re);
      });
      break;
    case 'getScore':
      dbOperator.getScore(personId).then(function (re) {
        res.json(re);
      });
      break;
    case 'getLifeInsuranceOrders':
      dbOperator.getLifeInsuranceOrders(personId,req.body.info).then(function (re) {
        res.json(re);
      });
      break;
    case 'generateLifeInsuranceOrder':
      dbOperator.generateLifeInsuranceOrder(personId,req.body.info).then(function (re) {
        res.json(re);
      });
      break;
    case 'getRelativePersons':
      dbOperator.getRelativePersons(personId).then(function (re) {
        res.json(re);
      });
      break;
    case 'createRelativePerson':
      dbOperator.createRelativePerson(personId,req.body.info).then(function (re) {
        res.json(re);
      });
      break;
    case 'rollbackTest':
      dbOperator.rollbackTest(personId,req.body.info).then(function (re) {
        res.json(re);
      });
      break;
    case 'getCurDayOrderNumTest':
      dbOperator.getCurDayOrderNumTest(personId,req.body.info).then(function (re) {
        res.json(re);
      });
      break;
    case 'getCarInsuranceMeals':
      dbOperator.getCarInsuranceMeals(personId).then(function (re) {
        res.json(re);
      });
      break;
    case 'generateCarInsuranceOrder':
        dbOperator.generateCarInsuranceOrder(personId,req.body.info).then(function(re) {
          res.json(re);
        });
      break;
    case 'checkCarOrderState':
      dbOperator.checkCarOrderState(req.body.orderId).then(function(re) {
        res.json(re);
      });
      break;
    case 'getCarOrderPriceItems':
      dbOperator.getCarOrderPriceItems(req.body.orderId).then(function(re) {
        res.json(re);
      });
      break;
    case 'userApplyUnchangedLifeOrder':
      dbOperator.userApplyUnchangedLifeOrder(personId,req.body.info).then(function(re) {
        res.json(re);
      });
      break;
    case 'userUpdateLifeOrder':
      dbOperator.userUpdateLifeOrder(req.body.info).then(function(re) {
        res.json(re);
      });
      break;
    default:
      logger.info(JSON.stringify(req.params));
      res.json({result: "ok"});
      // res.json({result: "error", errMsg: "unknown request: " + req.params.request});
  }
}
