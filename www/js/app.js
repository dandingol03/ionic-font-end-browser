// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'ngCordova','ngBaiduMap','ionic-datepicker'])

    .config(function(baiduMapApiProvider) {
      baiduMapApiProvider.version('2.0').accessKey('2me89doy9NE2HgG7FmTXa0XZsedThXDD');
    })


    .run(function($ionicPlatform,$rootScope,$interval) {

    $rootScope.car_orders=[
        [
          {feeDate:"2016-02-01",carNum:"鲁A00003",insuranceFeeTotal:2000},
          {feeDate:"2016-03-17",carNum:"鲁A00003",insuranceFeeTotal:2000},
          {feeDate:"2016-05-20",carNum:"鲁A00003",insuranceFeeTotal:2000}
        ],
      {},
      [
        {companyName:'',products:[]},
        {companyName:'',products:[]}
      ]
    ];

    $rootScope.car_insurance={
      prices:[
        {
          companyName:'永安财产保险',
          products: [
            {
              productId:1,productName:'车辆损失险',insuranceType:null
            },
            {
              productId:null,insuranceType:null,productName:'第三者责任险',
              insuranceTypes:['5万','10万','20万']
            }
          ]
        },
        {
          companyName:'泰山财产保险',
          products:[
            {
              productId:1,productName:'车辆损失险',insuranceType:null
            },
            {
              productId:2,insuranceType:'5万',productName:'第三者责任险'
            }
          ]
        }
      ]

    };

    //定时器刷新获取订单
    var timer=$interval(function(){
      console.log('....timer logging');
    },200,10);
    timer.then(function(){
      console.log('log over');
    },function(){
    });

    $ionicPlatform.ready(function() {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)

      if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        cordova.plugins.Keyboard.disableScroll(true);

      }
      if (window.StatusBar) {
        // org.apache.cordova.statusbar required
        StatusBar.styleDefault();
      }

    });
})

  .config(function (ionicDatePickerProvider) {
    var datePickerObj = {
      inputDate: new Date(),
      setLabel: 'Set',
      todayLabel: 'Today',
      closeLabel: 'Close',
      mondayFirst: false,
      weeksList: ["S", "M", "T", "W", "T", "F", "S"],
      monthsList: ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"],
      templateType: 'popup',
      from: new Date(2012, 8, 1),
      to: new Date(2018, 8, 1),
      showTodayButton: true,
      dateFormat: 'dd MMMM yyyy',
      closeOnSelect: false,
      disableWeekdays: [6]
    };
    ionicDatePickerProvider.configDatePicker(datePickerObj);
  })



.config(function($stateProvider, $urlRouterProvider,$ionicConfigProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js


    $ionicConfigProvider.platform.ios.tabs.style('standard');
    $ionicConfigProvider.platform.ios.tabs.position('bottom');
    $ionicConfigProvider.platform.android.tabs.style('standard');
    $ionicConfigProvider.platform.android.tabs.position('standard');

    $ionicConfigProvider.platform.ios.navBar.alignTitle('center');
    $ionicConfigProvider.platform.android.navBar.alignTitle('left');

    $ionicConfigProvider.platform.ios.backButton.previousTitleText('').icon('ion-ios-arrow-thin-left');
    $ionicConfigProvider.platform.android.backButton.previousTitleText('').icon('ion-android-arrow-back');

    $ionicConfigProvider.platform.ios.views.transition('ios');
    $ionicConfigProvider.platform.android.views.transition('android');


  $stateProvider

  // setup an abstract state for the tabs directive
    .state('tabs',{
      url:'/tabs',
      abstract:true,
      templateUrl:'views/tabs/tabs.html'
    })

    .state('tabs.dashboard',{
      url:'/dashboard',
      views:{
        'dashboard-tab':{
          controller:'dashboardController',
          templateUrl:'views/dashboard/dashboard.html'
        }
      }
    })

    .state('tabs.my',{
      url:'/my',
      views:{
        'my-tab':{
          controller:'myController',
          templateUrl:'views/my/my.html'
        }
      }
    })

    .state('login',{
      url:'/login',
      controller: 'loginController',
      templateUrl:'views/login/login.html'
    })

     .state('car_insurance',{
       url:'/car_insurance',
       controller:'carInsuranceController',
       templateUrl:'views/car_insurance/car_insurance.html'
    })


    .state('orderCluster',{
      url:'/orderCluster',
      controller:'orderClusterController',
      templateUrl:'views/orderCluster/orderCluster.html'
    })


    .state('lifePlanDetail',{
      url:'/life_plan_detail/:plan',
      controller:'lifePlanDetailController',
      templateUrl:'views/life_plan_detail/life_plan_detail.html'
    })

    /**
     * 个人信息=>['修改密码','退出登录']
     */
    .state('myInfo',{
      url:'/myInfo',
      controller:'myInfoController',
      templateUrl:'views/myInfo/myInfo.html'
    })

    .state('passwordModify',{
      url:'/passwordModify',
      controller:'passwordModifyController',
      templateUrl:'views/passwordModify/passwordModify.html'
    })

    .state('car_orders',{
      cache:false,
      url:'/car_orders/:selected',
      controller:'carOrdersController',
      templateUrl:'views/car_orders/car_orders.html'
    })

    .state('life_insurance_orders',{
      cache: false,
      url:'/life_insurance_orders/:tabIndex',
      controller:'lifeInsuranceOrdersController',
      templateUrl:'views/life_insurance_orders/life_insurance_orders.html'
    })


    .state('integration', {
      url: '/integration',
      controller: 'integrationController',
      templateUrl: 'views/integration/integration.html'
    })

    .state('uploadPhoto', {
      url: '/uploadPhoto',
      controller: 'uploadPhotoController',
      templateUrl: 'views/uploadPhoto/uploadPhoto.html'
    })

    .state('car_order_detail',{
      url:'/car_order_detail/:order',
      controller:'carOrderDetailController',
      templateUrl:'views/car_order_detail/car_order_detail.html'

    })

    .state('life_insurance_product_list',{
      url:'/life_insurance_product_list',
      controller:'lifeInsuranceProductList',
      templateUrl:'views/life_insurance_product_list/life_insurance_product_list.html'
    })


  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/login');

})
    .factory('BaiduMapService', function($q, baiduMapApi) {
      return {
        getLocalCity: function() {
          return baiduMapApi.then(function(BMap) {
            var localcity = new BMap.LocalCity();
            return $q(function(resolve, reject) {
              localcity.get(function(r) {
                resolve(r);
              });
            });
          });
        }
        ,
        getBMap:function(callback){
          baiduMapApi.then(function(BMap) {
            callback(BMap);
          });
        }
      };
    })
