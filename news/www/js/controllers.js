angular.module('dtn.controllers', [])

.controller("FeaturesCtrl", function ($scope, $ionicSlideBoxDelegate, FeedSource, SourceItem, $state) {
	$scope.loading = true;

	var remainingFeaturedLength = 6;

	$scope.featuredSectionLength = remainingFeaturedLength / 2;

	$scope.remainingFeaturedSectionLength = -(remainingFeaturedLength - $scope.featuredSectionLength - 1);

	var loadEntries = function (index) {
		if (index < $scope.items.length) {
			SourceItem.get($scope.items[index].url)
			.then(function (feed) {
				if (feed.feed) {
					feed = feed.feed;
				}
				angular.extend($scope.items[index], {
					featured : {
						primary : feed.entries[0],
						others : feed.entries.slice(1, remainingFeaturedLength + 1)
					},
					entries : feed.entries
				});
				loadEntries(index + 1);
			});
		} else {
			$scope.item = $scope.items[0];
			$scope.loading = false;
			$ionicSlideBoxDelegate.$getByHandle("featured-slides").update();
		}
	};

	var others = {};

	var refresh = function () {
		others = {};
		$scope.loading = false;
		FeedSource.all()
		.then(function (list) {
			$scope.items = _.filter(list, function (item) {
					return (item.display !== false);
				});
			_.defer(function () {
				loadEntries(0);
			});
		});
	};



	$scope.getOtherFeatured = function (src, offset, length) {
		if (src) {
			var key = (src.feedUrl || src.link || src.url) + "_" + offset;
			if (angular.isUndefined(others[key])) {
				var data = src.featured.others || [];
				if (length) {
					others[key] = data.slice(offset, length);
				}else {
					others[key] = data.slice(offset);
				}
			}
			return others[key];
		}
		return [];
	};


	$scope.open = function (source) {
		$state.go("feed", {
			sourceUrl : source.url || source.link
		});
	};

	$scope.openEntry = function(item, source, event) {
		if (event) {
			event.stopPropagation();
		}
		$state.go("entry", {
			sourceUrl : source.url || source.feedUrl || source.link,
			entryUrl: item.link || item.url
		});
	};

	$scope.$on("$ionicView.enter", function () {
		refresh();
	});
	//refresh();
})
.controller("EntryCtrl", function ($scope,
		$stateParams, FeedSource,
		SourceItem, $state, $ionicScrollDelegate) {

	$scope.loading = true;
	$scope.$state = $state;
	var __scrollingKilled = false;
	$scope.disableScrolling = function () {
		__scrollingKilled = true;
		var v = $ionicScrollDelegate.getScrollView();
		v.__enableScrollY = false;
	};

	$scope.tryEnableScrolling = function () {
		if (__scrollingKilled) {
			var v = $ionicScrollDelegate.getScrollView();
		v.__enableScrollY = true;
		}
	};

	function loadEntry(source) {
		SourceItem.getEntry(source.feedUrl || source.link || source.url, $stateParams.entryUrl)
		.then(function (entry) {
			if (entry) {
				$scope.title = entry.title;
			} else {
				$scope.errorMessage = "Entry not found";
			}
			$scope.entry = entry;
			$scope.loading = false;
		}, function (err) {
			$scope.errorMessage = err.message || err || "Error occured";
			$scope.loading = false;
		});
	}

	$scope.showNextArticle = function (offset) {
		offset = $scope.entry.cIndex + offset;
		SourceItem.getNextEntryLink($scope.source._id, offset)
		.then(function (link) {
			if (link) {
				$state.go("entry", {
					sourceUrl : $scope.source.url || $scope.source.feedUrl || $scope.source.link,
					entryUrl: link
				});
			}
		});
	};
	FeedSource.getCached($stateParams.sourceUrl)
	.then(function (src) {
		$scope.source = src;
		loadEntry(src);
	});

	// FeedSource.find({
		// url : $stateParams.sourceUrl
	// })
	// .then(function (src) {
		// $scope.source = src;
		// loadEntry(src);
	// });

	$scope.openInBrowser = function (url) {
		window.open(url, "_blank");
	};
})

.controller("SourceCtrl", function ($scope,
		$stateParams, SourceItem,
		FeedSource, $timeout, $state, defaultTitle) {
	$scope.loading = true;
	$scope.$state = $state;
	$scope.title = defaultTitle;

	function loadItems(source, forceRefresh) {
		SourceItem.get(source.url, forceRefresh)
		.then(function (data) {
			$scope.items = data.feed.entries;
			delete data.feed.entries;
			$scope.source = data.feed;
			$scope.loading = false;
		}).catch (function (err) {
			//todo log error
			$scope.errorMessage = err;
			$scope.loading = false;
		});
	}

	FeedSource.find({
		url : $stateParams.sourceUrl
	})
	.then(function (src) {
		$scope.source = src;
		$scope.title = src.title;
		$timeout(function () {
			loadItems(src);
		});
	});

	$scope.refresh = function () {
		$scope.loading = true;
		$timeout(function () {
			loadItems($scope.source, true);
		});
	};

	$scope.details = function (item) {
		$state.go("entry", {
			sourceUrl : $scope.source.url || $scope.source.feedUrl || $scope.source.link,
			entryUrl: item.link || item.url
		});
	};

	var __subSet = [];

	$scope.getItems = function (offset) {
		if ($scope.items) {
			if (__subSet.length < $scope.items.length - offset) {
				__subSet.length = 0;
				Array.prototype.push.apply(__subSet, $scope.items.slice(offset));
			}
		}
		return __subSet;
	};

	$scope.openInBrowser = function (url) {
		window.open(url, "_blank");
	};
});
