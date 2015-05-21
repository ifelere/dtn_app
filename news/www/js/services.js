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
				} else {
					localStorage.setItem(key, String(value));
				}
			} else {
				__cache[key] = value;
			}
		}
	};

})

.provider("RssParser", function () {
	var pref = "GoogleFeedApi"; // "GoogleFeedApi"; //RssXmlParser
	this.$get = [pref/*, "GoogleFeedApi"*/, function (P) {
		return P;
	}];
})

.factory("RssXmlParser", function ($http, $q, dtnAnchor) {
	return {
		get : function (url) {
			var deferred = $q.defer();
			$http.get(url)
			.success(function (xml) {
				var x2js = new X2JS();
		    	var xmlDoc = x2js.parseXmlString(xml);
				deferred.resolve(null);
			}).error(function (err) {
				deferred.reject(err);
			});
			return deferred.promise;
		}
	};
})

.factory("CatchedFeeds", function (Database, $q) {
	return {
		get : function (url) {
			var deferred = $q.defer();
			Database.entity("feed")
			.first({
				link : url
			}).then(function (feed) {
				if (feed) {
					Database.entity("entry")
					.find({
						$filter : {
							sourceId : feed.id
						},
						$order : {
							cIndex : 1
						}
					}).then(function (entries) {
						feed.entries = entries;
						deferred.resolve({
							feed : feed
						});
					}, function (err) {
						deferred.reject(err);
					});
				} else {
					deferred.resolve(null);
				}
			}, function (err) {
				deferred.reject(err);
			});

			return deferred.promise;
		},

		store : function (url, data) {
			var deferred = $q.defer();

			var entry = Database.entity("entry"),
				feedEntity = Database.entity("feed");

			var cacheImpl = function (sourceId) {
				var doSave = function (sid, index, successCount) {
					if (index === undefined) {
						index = 0;
					}
					if (successCount == undefined) {
						successCount = 0;
					}
					if (index < data.entries.length) {
						var et = data.entries[index];
						entry.insert({
							sourceId : sid,
							link : et.link || et.url,
							jsonData : angular.toJson(et),
							cIndex : index
						}).then(function () {
							doSave(sid, index + 1, successCount + 1);
						}, function (err) {
							deferred.reject(err);
						});
					}else {
						deferred.resolve(successCount);
					}
				};

				if (sourceId) {
					feedEntity.update(
					sourceId,
					{
						lastFetched : String(new Date())
					})
					.then(function (feed) {
						doSave(sourceId, 0, 1);
					});
				}else {
					feedEntity.insert({
						link : url,
						jsonData : angular.toJson(_.omit(data, "entries")),
						lastFetched : String(new Date())
					})
					.then(function (feed) {
						doSave(feed._id, 0, 1);
					});
				}

			};

			feedEntity.first(
				['_id'], {
				link : url
			}).then(function (feed) {
				if (feed) {
					//first remove previous entries
					entry.remove({
						sourceId : feed._id
					}).then(function () {
						cacheImpl(feed._id);
					});
				}else {
					cacheImpl(null);
				}
			});

			return deferred.promise;
		}
	};
})

.factory("GoogleFeedApi", function ($http, $q, dtnAnchor) {
	return {
		get : function (url) {
			var deferred = $q.defer();

			var options = {};

			options.params = {
				q : url,
				v : "1.0",
				callback : "JSON_CALLBACK",
				num : 30
			};

			$http.jsonp("http://ajax.googleapis.com/ajax/services/feed/load", options).
			success(function (data, status) {
				data = data.responseData || data;
				angular.forEach(data.feed.entries, function (e) {
					var c = dtnAnchor.targetBlank(e.content);
					if (c) {
						e.content = c;
					}
				});
				deferred.resolve(data);
			}).error(function (err) {
				deferred.reject(err);
			});
			return deferred.promise;
		}
	};
})

.factory("SourceItem", function ($http, $q, dtnAnchor, dtnStore, Database, CatchedFeeds, RssParser) {
	var cached = {};
	var KEY_LAST_CACHE = "last.cache";

	var tryGetFromHttp = function (url) {
		return RssParser.get(url);
	};

	var tryGetCached = function (url) {
		return CatchedFeeds.get(url);
	};

	return {
		get : function (url, tryCachedFirst) {
			var cachKey = KEY_LAST_CACHE + "_" + url;

			if (angular.isUndefined(tryCachedFirst)) {
				var lastCache = dtnStore.get(cachKey);
				if (lastCache) {
					lastCache = new Date(parseInt(lastCache, 10));
					var now = new Date();
					tryCachedFirst = (
						(now.getDate() === lastCache.getDate()) &&
						(now.getMonth() === lastCache.getMonth()) &&
						(now.getYear() === lastCache.getYear()));
				}
			}

			var tryOrders = [];
			if (tryCachedFirst) {
				tryOrders.push(tryGetCached);
				tryOrders.push(tryGetFromHttp);
			} else {
				tryOrders.push(tryGetFromHttp);
				tryOrders.push(tryGetCached);
			}

			var deferred = $q.defer();

			var tryGet = function (index, data, error) {
				if (index < tryOrders.length) {
					fn = tryOrders[index];
					fn(url)
					.then(function (d) {
						if (d) {
							deferred.resolve(d);
							//if it is http then store the last time fetched
							if (fn === tryGetFromHttp) {
								dtnStore.set(cachKey, Date.now());
								CatchedFeeds.store(d, url);
							}
						} else {
							tryGet(index + 1, d, error);
						}
					}, function onError(err) {
						tryGet(index + 1, null, err);
					});
				} else {
					if (error) {
						deferred.reject(error);
					} else {
						deferred.resolve(data);
					}
				}
			};

			tryGet(0, null);
			return deferred.promise;
		},
		getNextEntryLink : function (sourceId, offset) {
			var deferred = $q.defer();
			Database.entity("entry")
			.first(
			['link'],
			{
				sourceId : sourceId,
				cIndex : offset
			}).then(function (e) {
				if (e) {
					deferred.resolve(e.link);
				}else {
					deferred.resolve(null);
				}
			}, function (err) {
				deferred.reject(err);
			});
			return deferred.promise;
		},
		/**
		 * @param url
		 * @param index {Number, String} if a string then the string is the link.url
		 * */
		getEntry : function (url, index) {
			return Database.entity("feed")
			.first(
			['_id'],
			{
				link : url
			}).then(function (feed) {
				if (feed) {
					var options = {
						sourceId : feed.id
					};
					if (angular.isString(index)) {
						options.link = index;
					}else {
						options.cIndex = index;
					}
					return Database.entity("entry")
					.first(options);
				}
				return null;
			});
		}
	};
})

.constant("defaultTitle", "The Kuramo Report")

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

.factory("FeedSource", function ($q, dtnStore, Database) {
	// var sources = [{
	// 		name : "news",
	// 		title : "News",
	// 		url : "http://dailytimes.com.ng/category/news/feed/"
	// 	}, {
	// 		name : "politics",
	// 		title : "Politics",
	// 		url : "http://dailytimes.com.ng/category/politics/feed/"
	// 	}, {
	// 		url : "http://dailytimes.com.ng/category/business/feed/",
	// 		name : "business",
	// 		title : "Business"
	// 	}, {
	// 		name : "sport",
	// 		url : "http://dailytimes.com.ng/category/sport/feed/",
	// 		title : "Sport",
	// 		display : false
	// 	}, {
	// 		name : "sports",
	// 		url : "http://dailytimes.com.ng/category/sport/feed/",
	// 		title : "Sports"
	// 	}
	// ];

	var sources = [
		{
			name : "trk",
			title : "The Kuramo Report",
			url : "http://tkr.com.ng/rss.xml",
			display : true
		}
	];

	// var sources = [
	// 	{
	// 		name : "trk",
	// 		title : "The Kuramo Report",
	// 		url : "http://tkr.com.ng/rss.xml",
	// 		display : true
	// 	}
	// ];

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
		getCached : function (link) {
			// var self = this;
			if (angular.isString(link)) {
				link = {
					link : link
				};
			}
			return Database.entity("feed")
			.first(link);
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
		find : function (options) {
			var defered = $q.defer();
			if (angular.isFunction(options)) {
				defered.resolve(_.find(sources, options));
			} else {
				defered.resolve(_.findWhere(sources, options));
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

.filter("cleanContent", function () {
	return function (str) {
		var replace = '&lt;!-- google_ad_section_start --&gt;';
		if (str) {
			return str.replace(replace, '');
		}
		return str;
	};
})

.service("entryImageExtractor", function ($q) {
	var extractInline = function (source, cb) {
		var content = source.content;
		if (content) {
			var PATTERN_OG = /rel\=["']og\:image/,
				PATTERN_IMAGE = /<img .*src\=["'](\S+)["']/i;
			var orgLocation = PATTERN_OG.exec(content);

			if (orgLocation) {
				PATTERN_IMAGE.lastIndex =
					orgLocation.index + orgLocation[0].length;
				var imageMatch = PATTERN_IMAGE.exec(content);
				if (imageMatch) {
					cb(imageMatch[1]);
				}else {
					cb(null);
				}
			}else {
				cb(null);
			}
		}else {
			cb(null);
		}
	};

	var extractors = [];
	extractors.push(extractInline);

	var tryExtractors = function (index, source, cb) {
		if (index < extractors.length) {
			extractors[index](source, function (d, err) {
				if (err) {
					tryExtractors(index + 1, source, cb);
				}else if (d) {
					cb(d);
				}else {
					tryExtractors(index + 1, source, cb);
				}
			});
		}else {
			cb(null, new Error("not found"));
		}
	};

	var DISABLE_OP = false;
	var getImpl = function (entry) {
		var deferred = $q.defer();
		if (DISABLE_OP) {
			deferred.resolve(null);
		}else {
			tryExtractors(0, entry, function (d, err) {
				if (err) {
					deferred.reject(err);
				}else {
					deferred.resolve(d);
				}
			});
		}
		return deferred.promise;
	};

	return {
		get : getImpl
	};
})

.factory("entryImageProvider", function ($http, dtnStore, Database) {
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

	function useCache(link, callback) {
		Database.entity("applicationCache")
		.first(
		['cvalue'],
		{
			ckey : link
		}).then(function (data) {
			if (data) {
				callback(data.cvalue || data.cValue);
			}else {
				callback(null);
			}
		}, function (err) {
			if (console) {
				console.error(err);
			}
			callback(null);
		});

	}



	function useHttp(link, callback) {
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
					var content = angular.isString(meta) ?
						contentGrabber.exec(meta)[1] : meta.content;
					//first cache
					Database.entity("applicationCache")
						.insert({
							ckey : link,
							cvalue : content
						});
					return callback(content);
				}
			}
			callback('');
		});

	}
	return {
		get : function (link, callback, defaultValue) {
			var getters = [
				useCache,
				useHttp
			];
			var f = function (index) {
				if (index < getters.length) {
					getters[index](link, function (d) {
						if (d) {
							return callback(d);
						}
						f(index + 1);
					});
				}else {
					callback(defaultValue);
				}
			};
			f(0);
		}
	};
});
