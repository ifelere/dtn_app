angular.module('dtn.services', [])

.factory("SourceItem", function ($http, $q, dtnAnchor) {
    var cached = {};
    var tryGetCached = function (url) {
        var deferred = $q.defer();
        if (angular.isDefined(localStorage)) {
            var data = localStorage.getItem(url);
            if (data) {
                deferred.resolve(angular.fromJson(data));
            }else {
                deferred.resolve(null);
            }
        }else if (angular.isDefined(cached[url])) {
            deferred.resolve(cached[url]);
        }else {
            deferred.resolve(null);
        }
        return deferred.promise;
    };

    var cacheResult = function (data, url) {
        if (angular.isDefined(localStorage)) {
            localStorage.setItem(url, angular.toJson(data));
        }else {
            cached[url] = data;
        }
    };

    var tryGetFromHttp = function (url) {
        var deferred = $q.defer();
        var options = {};
        options.params = {
            q : url,
            v : "1.0",
            callback : "JSON_CALLBACK",
            num : 25
        };

        $http.jsonp("http://ajax.googleapis.com/ajax/services/feed/load", options).
        success(function(data, status) {
            data = data.responseData || data;

            angular.forEach(data.feed.entries,function (e) {
                e.content = dtnAnchor.targetBlank(e.content);
            });

            deferred.resolve(data);
            cacheResult(data, url);
        }).error(function (err) {
            deferred.reject(err);
        });
        return deferred.promise;
    };


    return {
        get : function (url) {
            var deferred = $q.defer();
            tryGetFromHttp(url)
            .then(function (data) {
                if (data) {
                    deferred.resolve(data);
                }else {
                    return tryGetCached(url);
                }
            })
            .then(function (data) {
                deferred.resolve(data);
            }).catch (function (err) {
                deferred.reject(err);
            });
            return deferred.promise;
        },
        getEntry : function (url, index) {
            var deferred = $q.defer();
            tryGetCached(url)
            .then(function (data) {
                if (data && data.feeds) {
                    deferred.resolve(data.feeds.entries[index]);
                }else {
                    deferred.resolve(null);
                }
            });
            return deferred.promise;
        }
    };
})

.service("dtnAnchor", function () {
    //ensure that all anchors target '_blank'
    return {
        targetBlank : function (content) {
            var c = angular.element(content);
            c.find("a").attr("target", "_blank");
            content = c.html();
        }
    };
})

.factory("FeedSource", function($q) {
    var sources = [
        {
            name : "news",
            title : "News",
            url : "http://dailytimes.com.ng/category/news/feed/"
        },
        {
            name : "politics",
            title : "Politics",
            url : "http://dailytimes.com.ng/category/politics/feed/"
        },
        {
            url : "http://dailytimes.com.ng/category/business/feed/",
            name : "business",
            title : "Business"
        },
        {
            name : "sport",
            url : "http://dailytimes.com.ng/category/sport/feed/",
            title : "Sport"
        },
        {
            name : "sports",
            url : "http://dailytimes.com.ng/category/sport/feed/",
            title : "Sports"
        }
    ];
    var id = 0;
    angular.forEach(sources, function (s) {
        s.id = id++;
    });

    return {
        all : function () {
            var defered = $q.defer();
            defered.resolve(sources);
            return defered.promise;
        },
        getByName : function (name) {
            var defered = $q.defer();
            for (var j = 0, len = sources.length; j < len; j++) {
                var src = sources[j];
                if (src.name === name) {
                    defered.resolve(src);
                    break;
                }
            }
            return defered.promise;
        },
        get : function (id) {
            var defered = $q.defer();
            for (var j = 0, len = sources.length; j < len; j++) {
                var src = sources[j];
                if (src.id === id) {
                    defered.resolve(src);
                    break;
                }
            }
            return defered.promise;

        }
    };
})
.filter("toDate", function () {
    return function (val) {
        if (angular.isString(val)) {
            return new Date(val);
        }
        return val;
    };
});
