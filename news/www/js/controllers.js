angular.module('dtn.controllers', [])

.controller("HomeCtrl", function ($scope, FeedSource) {
    $scope.sources = FeedSource.all();
})

.controller("EntryCtrl", function () {
    


})

.controller("SourceCtrl", function ($scope,
    $stateParams, SourceItem,
    FeedSource, $timeout, $state) {
    $scope.loading = true;
    function loadItems(source) {
        SourceItem.get(source.url)
        .then(function (data) {
            $scope.items = data.feed.entries;
            delete data.feed.entries;
            $scope.source = data.feed;
            $scope.loading = false;
        }).catch(function (err) {
            //todo log error
            $scope.errorMessage = err;
            $scope.loading = false;
        });
    }
    FeedSource.getByName($state.current.data.name)
    .then(function (src) {
        $scope.source = src;
        $timeout(function () {
            loadItems(src);
        }, 100);
    });

    $scope.showAll = function () {
        $scope.showDetails = false;
        delete $scope.item;
    };

    $scope.details = function(item) {
        $scope.detailItem = item;
        $scope.showDetails = angular.isDefined(item);
    };

    $scope.openInBrowser = function (url) {
        window.open(url, "_blank");
    };
})

.controller('DashCtrl', function($scope) {})

.controller('ChatsCtrl', function($scope, Chats) {
  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  }
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('AccountCtrl', function($scope) {
  $scope.settings = {
    enableFriends: true
  };
});
