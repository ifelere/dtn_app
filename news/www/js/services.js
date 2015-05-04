angular.module('dtn.services', [])

.factory("dtnStore", function () {
    var __cache = {};
    return {
        get : function (key, json) {
            json = json || false;
            if (angular.isDefined(localStorage)) {
                var v = localStorage.getItem(key);
                if (json) {
                    return angular.fromJson(v);
                }
                return v;
            }
            if (angular.isDefined(__cache[key])) {
                return __cache[key];
            }
            return null;
        },

        set : function (key, value) {
            if (angular.isDefined(localStorage)) {
                if (angular.isObject(value)) {
                    localStorage.setItem(key, angular.toJson(value));
                }else {
                    localStorage.setItem(key, String(value));
                }
            }else {
                __cache[key] = value;
            }
        }
    };

})

.factory("SourceItem", function ($http, $q, dtnAnchor) {
    var cached = {};


    var tryGetCached = function (url, ignoreAge, lastError) {
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
        }else if (lastError) {
            deferred.reject(lastError);
        } else {
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

    var useGoogleApi = function (url, deferred) {
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
            angular.forEach(data.feed.entries, function (e) {
                var c = dtnAnchor.targetBlank(e.content);
                if (c) {
                    e.content = c;
                }
            });
            deferred.resolve(data);
            cacheResult(data, url);
        }).error(function (err) {
            deferred.reject(err);
        });

    };

    var tryGetFromHttp = function (url) {
        var deferred = $q.defer();
        useGoogleApi(url, deferred);
        return deferred.promise;
    };


    return {
        get : function (url, tryCachedFirst) {
            if (angular.isUndefined(tryCachedFirst)) {

            }
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
            })
            .catch (function (err) {
                tryGetCached(url, true, err)
                .then(function (data) {
                    deferred.resolve(data);
                }, function () {
                    deferred.reject(err);
                });
            });
            return deferred.promise;
        },
        getEntry : function (url, index) {
            var deferred = $q.defer();
            tryGetCached(url)
            .then(function (data) {
                if (data && data.feed) {
                    deferred.resolve(data.feed.entries[index]);
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
            //put a in a wrapping tag
            var c = angular.element("<div>" + content + "</div>");
            var aa = c.find("a");
            angular.forEach(aa, function (a) {
                var an = angular.element(a);
                an.attr("href", "#");
            });
            content = c.html();
            return content;
        }
    };
})

.factory("FeedSource", function($q, dtnStore) {
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
})

.factory("entryImageProvider", function($http, dtnStore) {
    var extractors = [];
    extractors.push(function metaSource(html) {
        var metas = html.find("meta");
        for (var i = 0, len = metas.length; i < len; i++) {
            var meta = angular.element(metas[i]);
            var a = meta.attr("property");
            if ("og:image" === a || "og:image:url" === a) {
                return meta.attr("content");
            }
        }
        return false;
    });
    var imageSearch = /\<img\s+src\=["'](\S+)["']/i;
    extractors.push(function (html) {
        var search = imageSearch.exec(html);
        if (search) {
            return search[1];
        }
        return false;
    });

    function findImage(link, callback) {
        var r = /og\:image/,
            contentGrabber = /content=['"](\S+)['"]/;

        var getMetaList = function (results) {
            if (angular.isArray(results)) {
                return results;
            }
            return results.meta || [];
        };

        $http.jsonp("https://query.yahooapis.com/v1/public/yql", {
            params : {
                q : "select * from html where url='" + link + "' and xpath='//meta'",
                callback : "JSON_CALLBACK"
            }
        })
        .success(function (data) {
            var results = data.results;
            if (results) {
                var meta = _.find(getMetaList(results), function (m) {
                    if (angular.isString(m)) {
                        return r.test(m);
                    }
                    return r.test(m.property);
                });
                if (meta) {
                    if (angular.isString(meta)) {
                        return callback(contentGrabber.exec(meta)[1]);
                    }
                    return meta.content;
                }
            }
            callback('');
        });

    }
    return {
        get : function (link, callback) {
            var key = "image_" + link;
            var cachedUrl = dtnStore.get(key);
            //if the enty has not been cached at all then it should be null or undefined
            if (cachedUrl !== null && cachedUrl !== undefined) {
                callback(cachedUrl);
            }else {
                findImage(link, function (src) {
                    //store in cache so that even if an image was not found another attempt is not made to get it
                    dtnStore.set(key, src);
                    callback(src);
                });
            }
        }
    };
})
.directive("entryImage", function ($timeout, entryImageProvider) {
    return {
        restrict : 'AC',
        link : function (scope, ele, attr) {
            if (attr.showPlaceholder !== 'false') {
                var index = parseInt(attr.index || '0', 10);

                var defaultImages = [
                    'img/placeholder1_exp.png',
                    'img/placeholder2_exp.png'
                ];

                ele.attr("src", defaultImages[index % 2]);
            }else {
                ele.addClass("hidden");
            }

            var kill = scope.$watch(function () {
                return scope[attr.entryImage];
            }, function (entry) {
                if (entry) {
                    kill();
                    if (entry.imageSource) {
                        ele.attr("src", entry.imageSource);
                    }else {
                        var link = entry.link;
                        $timeout(function () {
                            entryImageProvider.get(link, function (src) {
                                //change only if not an empty string
                                if (src) {
                                    ele.attr("src", src);
                                    ele.removeClass("hidden");
                                }
                            });
                        });
                    }
                }
            });
        }
    };
});
