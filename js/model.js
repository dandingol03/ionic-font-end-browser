var model = module.exports,
  util = require('util'),
  redis = require('redis'),
  redisConf = require('../config.js').redisConf,
  dbConf = require('../config.js').dbConf,
  logConf = require('../config.js').logConf,
  log4js = require('log4js'),
  dbOperator = require('../js/dbOperator.js'),
  logger = log4js.getLogger('dbOperator');

dbOperator.init(dbConf, logger);

var db = redis.createClient(redisConf);

const CLEINT_ID = "FakeClinetId";
const CLIENT_SECRET = "FakeClinetSecret";

var keys = {
  token: 'tokens:%s',
  client: 'clients:%s',
  refreshToken: 'refresh_tokens:%s',
  grantTypes: 'clients:%s:grant_types',
  user: 'users:%s'
};

model.getAccessToken = function (bearerToken, callback) {
  db.hgetall(util.format(keys.token, bearerToken), function (err, token) {
    if (err) return callback(err);

    if (!token) return callback();

    callback(null, {
      accessToken: token.accessToken,
      clientId: token.clientId,
      expires: token.expires ? new Date(token.expires) : null,
      userId: token.userId
    });
  });
};

model.getClient = function (clientId, clientSecret, callback) {

  callback(null, {
    clientId: clientId,
    clientSecret: clientSecret
  });
};

model.getRefreshToken = function (bearerToken, callback) {
  db.hgetall(util.format(keys.refreshToken, bearerToken), function (err, token) {
    if (err) return callback(err);

    if (!token) return callback();

    callback(null, {
      refreshToken: token.accessToken,
      clientId: token.clientId,
      expires: token.expires ? new Date(token.expires) : null,
      userId: token.userId
    });
  });
};

model.grantTypeAllowed = function (clientId, grantType, callback) {
  /*
  db.sismember(util.format(keys.grantTypes, clientId), grantType, callback);
  */
  callback(null,true);
};

model.saveAccessToken = function (accessToken, clientId, expires, user, callback) {
  db.hmset(util.format(keys.token, accessToken), {
    accessToken: accessToken,
    clientId: clientId,
    expires: expires ? expires.toISOString() : null,
    userId: user.id
  }, callback);
};

model.saveRefreshToken = function (refreshToken, clientId, expires, user, callback) {
  db.hmset(util.format(keys.refreshToken, refreshToken), {
    refreshToken: refreshToken,
    clientId: clientId,
    expires: expires ? expires.toISOString() : null,
    userId: user.id
  }, callback);
};

model.getUser = function (username, password, callback) {

  dbOperator.getPersonId(username).then(function (getRes) {
    if (getRes) {
      callback(null, {id: getRes});
    } else {
      dbOperator.registerUser(username, password).then(function (regRes) {
        callback(null, {id:regRes});
      }, function(regErr){
        callback(null, null);
      })
    }
  });
  /*
  db.get(username, function (redisErr, redisRes) {
    if (redisRes == password) {
      dbOperator.getPersonId(username).then(function (getRes) {
        if (getRes) {
          callback(null, {id: getRes});
        } else {
          dbOperator.registerUser(username, password).then(function (regRes) {
            callback(null, {id:regRes});
          }, function(regErr){
            callback(null, null);
          })
        }
      }, function (getErr) {
        callback(null, null);
      })
    } else {
      callback(null, null);
    }
  })
  */
};
