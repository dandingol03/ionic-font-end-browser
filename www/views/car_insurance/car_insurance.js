/**
 * Created by yiming on 16/9/7.
 */
angular.module('starter')

  .controller('carInsuranceController',function($scope,$state,$http, $location,
                                                $rootScope,$ionicActionSheet,$ionicModal){

    $scope.tabIndex=0;

    $scope.tab_change=function(i) {
      $scope.tabIndex=i;
    };

    $scope. modal_tab_change=function(i) {
      $scope.modalTabIndex=i;
    };



//从服务器取得险种
    $scope.tabs=[
      {type:'基础套餐',insurances:$scope.basic_meal},

      { type:'建议套餐',
        insurances:[

          { name:'车上人员责任险',
            specials:[
              {name:'驾驶员',price:1000},
              {name:'乘客',seats:[2,5,8,10]}
            ]
          },
          {name:'交强险',price:400},
          {name:'车船税',price:800},
          {name:'车辆损失险',price:1205},
          {name:'第三者责任险',prices:[1104,870,999]}
        ]
      },

      {type:'自定义套餐',insurances:[]}
    ];








    //选择公司
    $scope.companys=[
      {name:"太平洋保险"},{name:"平安保险"},{name:"新华保险"},
      {name:"太平洋保险"},{name:"太平洋保险"},{name:"太平洋保险"},
      {name:"太平洋保险"},{name:"太平洋保险"},{name:"太平洋保险"}
      ];
    $scope.company={name:"选择公司"};
    $scope.selectCompany=function(companyName){
      $scope.company.name=companyName;
      $scope.apply();
      $scope.closeCompanyModal();

    }


    //获得险种的基础套餐列表

    $http.get("http://202.194.14.106:9030/motor_insurance/basic_meal")
    .then(function(response){
      var data=response.data;
      if(data.projects!=null&&data.projects!=undefined)
      {
        var projects=data.projects;
        if(Object.prototype.toString.call(projects)!='[object Array]')
          projects=JSON.parse(projects);

        $scope.basic_meal=projects;//从测试服务器取到险种列表,付给coverages数组。
        return true;
      }else{
        return false;
      }

    }).then(function(re){
      $scope.tabs=[
        {type:'基础套餐',insurances:$scope.basic_meal},

        { type:'建议套餐',
          insurances:[

            { name:'车上人员责任险',
              specials:[
                {name:'驾驶员',price:1000},
                {name:'乘客',seats:[2,5,8,10]}
              ]
            },
            {name:'交强险',price:400},
            {name:'车船税',price:800},
            {name:'车辆损失险',price:1205},
            {name:'第三者责任险',prices:[1104,870,999]}
            ]
        },

        {type:'自定义套餐',insurances:[]}
      ];
    });



    //选择车辆人员责任险模态框

    /*** bind special_tab_modal ***/
    $ionicModal.fromTemplateUrl('views/modal/special_tab_modal.html',{
      scope:  $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.special_tab_modal = modal;
    });

    //待定
    $scope.openSpecialModal= function(){
      $scope.special_tab_modal.show();
    };


    $scope.closeSpecialModal= function() {
      $scope.special_tab_modal.hide();
    };
    /*** bind special_tab_modal ***/


   /* $scope.apply=function () {//选好险种提交时做的动作

      $scope.car_insurance.state='pricing';//状态是估价中订单

      $rootScope. car_insurance=$scope.car_insurance;


      $scope.coverages.map(function (coverages, i) {
        if($scope.coverage.flag==true){
          $scope.selected.push(coverage);
        }
      });

      //TODO:push selected to back-end
      //TODO:receive the shemes from back-end


      $state.go('motor_plan',{plan:[]});//跳到车险方案列表页面,并传递选中的险种和相应保额作为参数。

    }*/




    $scope.go_back=function(){
      window.history.back();
    }

    //车险保额选择
    $scope.price_select=function(item,prices) {
      if (prices !== undefined && prices !== null &&prices.length > 0)
      {
        var buttons=[];
        prices.map(function(price,i) {
          buttons.push({text: price});
        });
        $ionicActionSheet.show({
          buttons:buttons,
          titleText: '选择你的保额',
          cancelText: 'Cancel',
          buttonClicked: function(index) {
            item.price = prices[index];
            return true;
          },
          cssClass:'motor_insurance_actionsheet'
        });
      }
      else
      {}
    }




    $scope.actionSheet_show = function() {

      // Show the action sheet
      var hideSheet = $ionicActionSheet.show({
        buttons: [
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: '<b>Share</b> This' },
          { text: 'Move' }
        ],
        titleText: 'select your favourite project ',
        cancelText: 'Cancel',
        cancel: function() {
          // add cancel code..
        },
        buttonClicked: function(index) {
          return true;
        },
        cssClass:'center'
      });
    };






    /**************方案详情模态框*************************/
    $ionicModal.fromTemplateUrl('views/modal/car_detail_modal.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.car_detail_modal = modal;
    });
    $scope.openModal = function() {
      $scope.car_detail_modal.show();
    };
    $scope.closeModal = function() {
      $scope.car_detail_modal.hide();
    };
    /**************方案详情模态框*************************/


    /**************选择公司模态框*************************/
    $ionicModal.fromTemplateUrl('views/modal/car_company_modal.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function(modal) {
      $scope.car_company_modal = modal;
    });
    $scope.openCompanyModal = function() {
      $scope.car_company_modal.show();
    };
    $scope.closeCompanyModal = function() {
      $scope.car_company_modal.hide();
    };
    /**************选择公司模态框*************************/




    $scope.apply=function(){
      switch($scope.tabIndex)
      {
        case 0: //基础套餐
        case 1: //建议套餐
          var flag=true;
          var meals = $scope.tabs[$scope.tabIndex];
          var selected=meals.insurances.map(function(meal,i) {
              if(meal.price!==undefined&&meal.price!==null)
                return meal;
              else
              {
                flag=false;
                  return null;
              }
          });

          if(flag!=true){
            alert('请填写完成您的套餐选择');
          }else{
              //TODO:pass the meals to next step
           $state.go('car_orders',{selected:JSON.stringify(selected)})


          }

          break;
        case 2: //自定义套餐
          var meals=$scope.basic_meal.map(function(meal,i) {
            if(meal.checked==true)
              return meal;
          });

          if(flag!=true){
            alert('请填写完成您的基础套餐');
          }else{
            //TODO:pass the meals to next step
          }

          break;
        default:
          break;
      }
    }



  });
