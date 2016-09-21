exports.logConf = {
    appenders: [ {
        type: "dateFile",
        filename: "logs/main.log",
        pattern: "-yyyy-MM-dd",
        alwaysIncludePattern: false,
        category: 'main'
    }, {
        type: "dateFile",
        filename: "logs/svrProc.log",
        pattern: "-yyyy-MM-dd",
        alwaysIncludePattern: false,
        category: 'svrProc'
    }, {
        type: "dateFile",
        filename: "logs/securityCodeProc.log",
        pattern: "-yyyy-MM-dd",
        alwaysIncludePattern: false,
        category: 'securityCodeProc'
    }, {
        type: "dateFile",
        filename: "logs/dbOperator.log",
        pattern: "-yyyy-MM-dd",
        alwaysIncludePattern: false,
        category: 'dbOperator'
    }],
}

exports.redisConf = {
  host: '127.0.0.1',
  port: 6379,
};

exports.dbConf = {
  host: '202.194.14.106',
  port: 3306,
  user: 'insurance_admin',
  password: 'insurance_demo',
  database: 'insurancems',
  connectionLimit : 128,
}

exports.ftpRoot={
    base:'/data/ftpRoot/',
    branches:
    {
        'companyLogo':'insurance/company/logo',
        'carPhoto':'insurance/car/photo',
        'carLicense':'insurance/car/license',
        'perDriver':'insurance/person/driver',
        'perIdCard':'insurance/person/idcard',
        'lifeProduct':'insurance/life/product'
    }
}