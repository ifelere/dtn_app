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

.factory("SourceItem", function ($http, $q, dtnAnchor, dtnStore, Database) {
	var cached = {};
	var KEY_LAST_CACHE = "last.cache";

	var tryGetCached = function (url) {
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
	};

	var tryGetCachedOld = function (url) {
		var deferred = $q.defer();
		if (angular.isDefined(localStorage)) {
			var data = localStorage.getItem(url);
			if (data) {
				deferred.resolve(angular.fromJson(data));
			} else {
				deferred.resolve(null);
			}
		} else if (angular.isDefined(cached[url])) {
			deferred.resolve(cached[url]);
		} else if (lastError) {
			deferred.reject(lastError);
		} else {
			deferred.resolve(null);
		}
		return deferred.promise;
	};

	var cacheImpl = function (data, url,  sourceId) {


		var doSave = function (sid) {
			var entry = Database.entity("entry");
			angular.forEach(data.entries, function (et, index) {
				entry.insert({
					sourceId : sid,
					link : et.link || et.url,
					jsonData : angular.toJson(et),
					cIndex : index
				});
			});
		};

		if (sourceId) {
			doSave(sourceId);
		}else {
			Database.entity("feed").insert({
				link : url,
				jsonData : angular.toJson(_.omit(data, "entries")),
				lastFetched : String(new Date())
			})
			.then(function (feed) {
				doSave(feed._id);
			});
		}

	};

	var cacheResult = function (data, url) {
		var entry = Database.entity("entry");
		var e = Database.entity("feed");
		e.first(
			['_id'], {
			link : url
		}).then(function (feed) {
			if (feed) {
				//first remove previous entries
				entry.remove({
					sourceId : feed._id
				}).then(function () {
					cacheImpl(data, url, feed._id);
				});
			}else {
				cacheImpl(data, url, null);
			}
		});

	};

	var cacheResultOld = function (data, url) {
		dtnStore.set(url, data);
		// if (angular.isDefined(localStorage)) {
		// localStorage.setItem(url, angular.toJson(data));
		// }else {
		// cached[url] = data;
		// }
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
		success(function (data, status) {
			data = data.responseData || data;
			angular.forEach(data.feed.entries, function (e) {
				var c = dtnAnchor.targetBlank(e.content);
				if (c) {
					e.content = c;
				}
			});
			deferred.resolve(data);
			cacheResult(data.feed, url);
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
							//if it is http then store the last time fetched
							if (fn === tryGetFromHttp) {
								dtnStore.set(cachKey, Date.now());
							}
							deferred.resolve(d);
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

			// tryGetFromHttp(url)
			// .then(function (data) {
			// if (data) {
			// deferred.resolve(data);
			// }else {
			// return tryGetCached(url);
			// }
			// })
			// .then(function (data) {
			// deferred.resolve(data);
			// })
			// .catch (function (err) {
			// tryGetCached(url, true, err)
			// .then(function (data) {
			// deferred.resolve(data);
			// }, function () {
			// deferred.reject(err);
			// });
			// });
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
			// var deferred = $q.defer();
			// tryGetCached(url)
			// .then(function (data) {
				// if (data && data.feed) {
					// if (angular.isString(index)) {
						// deferred.resolve(_.find(data.feed.entries, function (e) {
								// return (e.link === index || e.url === index);
							// }));
					// } else {
						// deferred.resolve(data.feed.entries[index]);
					// }
				// } else {
					// deferred.resolve(null);
				// }
			// });
			// return deferred.promise;
		}
	};
})

.constant("defaultTitle", "Daily Times Nigeria")

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
	var sources = [{
			name : "news",
			title : "News",
			url : "http://dailytimes.com.ng/category/news/feed/"
		}, {
			name : "politics",
			title : "Politics",
			url : "http://dailytimes.com.ng/category/politics/feed/"
		}, {
			url : "http://dailytimes.com.ng/category/business/feed/",
			name : "business",
			title : "Business"
		}, {
			name : "sport",
			url : "http://dailytimes.com.ng/category/sport/feed/",
			title : "Sport",
			display : false
		}, {
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
