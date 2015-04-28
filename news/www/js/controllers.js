angular.module('dtn.controllers', [])

.controller("HomeCtrl", function ($scope, FeedSource) {
    $scope.sources = FeedSource.all();
})

.controller("EntryCtrl", function ($scope,
    $stateParams, FeedSource,
    SourceItem, $state
     ) {

    $scope.loading = true;
    $scope.$state = $state;

    function loadEntry(source) {
        SourceItem.getEntry(source.url, parseInt($stateParams.index, 10))
        .then(function (entry) {
            if (entry) {
                $scope.title = entry.title;
            }
            $scope.entry = entry;
            $scope.loading = false;
        }, function (err) {
            $scope.errorMessage = err.message || err || "Error occured";
            $scope.loading = false;
        });
    }

    FeedSource.getByName($state.current.data.name)
    .then(function (src) {
        loadEntry(src);
    });


    $scope.goBack = function() {
        $state.go("^." + $state.current.data.name);
    };


    $scope.openInBrowser = function (url) {
        window.open(url, "_blank");
    };
})

.controller("SourceCtrl", function ($scope,
    $stateParams, SourceItem,
    FeedSource, $timeout, $state) {
    $scope.loading = true;
    $scope.$state = $state;
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
        $scope.title = src.title;
        $timeout(function () {
            loadItems(src);
        }, 100);
    });

    $scope.details = function(item, index) {
        $scope.showDetails = true;
        $state.go("^." + $state.current.data.name + "-entry", {index : index});
    };

    $scope.openInBrowser = function (url) {
        window.open(url, "_blank");
    };
});
