// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('dtn', ['ionic', 'dtn.controllers', 'dtn.services'])

.run(function($ionicPlatform, $rootScope) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleLightContent();
    }
  });
  if (console) {
      $rootScope.$on("$stateChangeError", function (event, toState, toParams, fromState, fromParams, error) {
          console.error("State change erro");
          console.log(unfoundState.toState); // "lazy.state"
          console.log(unfoundState.toParams); // {a:1, b:2}
          console.log(error); // {inherit:false} + default options
      });

      $rootScope.$on('$stateNotFound',
        function(event, unfoundState, fromState, fromParams){
            console.error("State not found");
            console.log(unfoundState.to); // "lazy.state"
            console.log(unfoundState.toParams); // {a:1, b:2}
            console.log(unfoundState.options); // {inherit:false} + default options
        });
  }
})

.config(function($stateProvider, $urlRouterProvider, $httpProvider) {

    // $httpProvider.defaults.useXDomain = true;
    // delete $httpProvider.defaults.headers.common['X-Requested-With'];

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js



  var p = $stateProvider

  // setup an abstract state for the tabs directive
    .state('sources', {
        url: "/sources",
        abstract: true,
        templateUrl: "templates/tabs.html"
    })
    .state("demo", {
        url : "/demo",
        templateUrl : "templates/demo.html"
    });



    angular.forEach(['news', 'politics', 'business', 'sport', 'sports'], function (t) {
        var views = {};
        views[t] = {
            templateUrl : "templates/tab-source.html",
            controller : "SourceCtrl"
        };


        var key = "sources." + t, url = "/" + t;
        p = p.state(key, {
          url: url,
          data : {
              name : t
          },
          views: views
      });
      views = {};

      //this state should be a sibbling
      //make a template for displaying details
      views[t] = {
          templateUrl : "templates/sources/entry.html",
          controller : "EntryCtrl"
      };

      p = p.state(key + "-entry", {
          url : "/" + t + "/entry/{index}",
          data : {
              name : t
          },
          views : views
      });

    });
// Each tab has its own nav history stack:


  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/sources/news');
  // $urlRouterProvider.otherwise('/demo');

});
