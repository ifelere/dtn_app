angular.module("dtn.directives", [])

.directive("slidesControl", function ($ionicSlideBoxDelegate) {
	var slideBy = function (offset, handle, wrap) {
		var h = $ionicSlideBoxDelegate.$getByHandle(handle);
		var idx = h.currentIndex() + offset,
			count = h.slidesCount();
		if (idx < 0) {
			if (!wrap) {
				return;
			}
			idx = count + idx;
		}else if (idx > count) {
			if (!wrap) {
				return;
			}
			idx = idx - count;
		}
		h.slide(idx);
	};

	var callers = {
		next : function (handle, wrap) {
			slideBy(1, handle, wrap);
		},
		previous : function (handle, wrap) {
			slideBy(-1, handle, wrap);
		},
		prev : function (handle, wrap) {
			slideBy(-1, handle, wrap);
		}
	};

	return {
		restrict : "AC",
		link : function (scope, elemt, att) {
			elemt.bind("click", function (e) {
				e.stopPropagation();
				scope.$apply(function () {
					var key = att.slidesControl;
					(callers[key] || angular.noop)(att.handle, att.wrap === 'true');
				});
			});
		}
	};
})

.directive("onErrorSrc", function () {
	return function (scope, element, attr) {
		var errorOccured = false;
		var event = "error";
		element.bind(event, function () {
			element.unbind(event);
			if (!errorOccured) {
				errorOccured = true;
				var src = element.attr("src");
				if (src != attr.onErrorSrc) {
					scope.$apply(function () {
						element.attr("src", attr.onErrorSrc);
					});
				}
			}
		});
	};
})

.directive("onErrorBackground", function () {
	return function (scope, element, attr) {
		var errorOccured = false;
		var event = "error";
		element.bind(event, function () {
			element.unbind(event);
			if (!errorOccured) {
				errorOccured = true;
				var src = element.css("background-image");
				var replaceWith = "url(\"" + attr.onErrorBackground + "\")"
				if (src != replaceWith) {
					scope.$apply(function () {
						element.css("background-image", replaceWith);
					});
				}
			}
		});
	};


})

.directive("bindHtmlRemoveOgImg", function ($sce) {
	return function (scope, element, attr) {
		var onceBindExpression = /^\:\:/;
		var bindOnce = onceBindExpression.test(attr.bindHtmlRemoveOgImg), expression;
		if (bindOnce) {
			expression = attr.bindHtmlRemoveOgImg.replace(onceBindExpression, '');
		}else {
			expression = attr.bindHtmlRemoveOgImg;
		}
		var ogExp = /og\:image/;
		var kill = scope.$watch($sce.parseAsHtml(expression), function(value) {

			if (value) {
				element.empty();
				if (bindOnce) {
					kill();
				}
				var wrapper = angular.element("<div>" + value + "</div>");
				_.some(wrapper.find("div"), function (div) {
					div = angular.element(div);
					if (ogExp.test(div.attr("rel"))) {
						div.remove();
						return true;
					}
					return false;
				});
				element.append(wrapper.children());
			}
	    });
	};
})
.directive("magazineCoverBook", function ($timeout, entryImageExtractor, entryImageProvider) {
	var width = 400,
	height = 600;
	var getCanvas = function () {
		var e = window.document.getElementById("corverCanvas");
		if (!e) {
			e = window.document.createElement("canvas");
			e.setAttribute('width', width);
			e.setAttribute('height', height);
			e.style.display = "none";
			e.id = "corverCanvas";
			window.document.getElementsByTagName("body")[0].appendChild(e);
		}
		return e;
	};

	function getAverageRGB(imgEl) {

		var blockSize = 5, // only visit every 5 pixels
		defaultRGB = {
			r : 0,
			g : 0,
			b : 0
		}, // for non-supporting envs
		canvas = window.document.createElement("canvas"),
		context = canvas.getContext && canvas.getContext('2d'),
		data,
		i = -4,
		length,
		rgb = {
			r : 0,
			g : 0,
			b : 0
		},
		count = 0;

		if (!context) {
			return defaultRGB;
		}

		// height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
		// width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;
		canvas.width = width;

		canvas.height = height;

		context.drawImage(imgEl, 0, 0, width, height);

		try {
			data = context.getImageData(0, 0, width, height);
		} catch (e) {
			/* security error, img on diff domain */
			if (console) {
				console.error(e);
			}
			return defaultRGB;
		}

		length = data.data.length;
		while ((i += blockSize * 4) < length) {
			++count;
			rgb.r += data.data[i];
			rgb.g += data.data[i + 1];
			rgb.b += data.data[i + 2];
		}

		// ~~ used to floor values
		rgb.r = ~~(rgb.r / count);
		rgb.g = ~~(rgb.g / count);
		rgb.b = ~~(rgb.b / count);

		return rgb;

	}


	function getAverageImageRGB(path, callback) {
		var img = new Image();
		img.onload = function () {
			var rgb = getAverageRGB(img);
			callback(rgb);
		};
		img.src = path;
	}

	var drawImage = function (context, src, options, next) {
		var img = new Image();
		if (options.crossOrigin) {
			img.crossOrigin = options.crossOrigin;
		}

		img.onload = function () {

			var imageW = img.width,

			imageH = img.height;

			var x = options.x || 0,
			y = options.y || 0,
			w = options.width || imageW,
			h = options.height || imageH;

			if (options.clip) {
				context.beginPath();
				context.translate(options.clip.x, options.clip.y);
				context.rect(0, 0, options.clip.width, options.clip.height);
				context.clip();
				context.save();
			}
			switch (options.horizontal) {
			case "right":
				x = (w - imageW);
				w = imageW;
				break;
			case "center":
				x = (w - imageW) / 2;
				w = imageW;
				break;
			}
			switch (options.vertical) {
			case "bottom":
				y = (h - imageH);
				h = imageH;
				break;
			case "center":
				y = (h - imageH) / 2;
				h = imageH;
				break;
			}
			context.drawImage(img, x, y, w, h);

			if (options.clip) {
				context.restore();
			}
			next(img);
		};
		img.src = src;
	};

	var renderCover = function (imageSrc, onElement) {
		if (imageSrc) {
			// var e = onElement[0];
			onElement.css("background-image",
				"url('" + imageSrc + "')");

			// onElement.css({
			// "background-image" : imageSrc
			// });
		}
	};

	var renderCoverOld = function (imageSrc, onElement) {
		var c = getCanvas();
		var context = c.getContext("2d");
		context.beginPath();
		context.rect(0, 0, width, height);
		context.fillStyle = 'white';
		context.fill();
		var t = (height * 0.3);
		drawImage(context, "../img/Logo2.png", {
			x : 0,
			y : 0,
			width : width,
			height : t,
			horizontal : "stretch",
			vertical : "stretch"
		}, function () {
			if (imageSrc) {
				drawImage(context, imageSrc, {
					x : 0,
					y : t + 1,
					height : (height - t - 1),
					horizontal : "center",
					vertical : "center",
					crossOrigin : true
				}, function () {
					var url = c.toDataURL();
					onElement.css("background-image", url);
				});
			} else {
				var url = c.toDataURL();
				onElement.css("background-image", url);
			}
		});
	};

	return {
		restrict : "A",
		controller : function () {
			var lookupAndCache = function (entry, destinationElement, options) {
				entryImageProvider.get(entry.link, function (src) {
					if (src) {
						destinationElement.css("background-image",
							"url('" + src + "')");

						// getAverageImageRGB(src, function (rgb) {
							// if (console) {
								// console.log(rgb);
							// }
						// });
					}
				});
			};
			this.style = function (entry, destinationElement, options) {
				entryImageExtractor.get(entry)
				.then(function (src) {
					if (src) {
						destinationElement.css("background-image",
							"url('" + src + "')");
					}else {
						lookupAndCache(entry, destinationElement, options);
					}
				}, function () {
					lookupAndCache(entry, destinationElement, options);
				});

			};
		}
	};
})



.directive("magazineCover", function () {
	var linkFn = function ($scope, element, attr, book) {
		var k = $scope.$watch(function () {
				return $scope.$eval(attr.magazineCover);
			}, function (o) {
				if (o) {
					k();
					book.style(o, element, attr);
				}
			});
	};
	return {
		require : "^magazineCoverBook",
		restrict : "AC",
		link : linkFn
	};
})

.directive("toastMessage", function ($timeout) {
	return {
		restrict : "EAC",
		scope : {},
		templateUrl : "templates/toast.html",
		transclude : true,
		link : function (scope, element, attr) {
			element.addClass("message-toast");
			if (attr.hide === 'true') {
				element.addClass("hidden");
			}
			var autoHide = function (duration) {
				duration = duration || parseInt(attr.duration || '4000', 10);
				$timeout(function () {
					element.addClass("hidden");
				}, duration);
			};
			autoHide();
		}
	};
})
.directive("entryBackground", function ($timeout, entryImageExtractor, entryImageProvider) {
	return {
		restrict : 'AC',
		link : function (scope, ele, attr) {
			var setBackground = function (src) {
				if (src) {
					ele.css("background-image", "url('" + src + "')");
				}
			};

			if (attr.placeholder) {
				setBackground(attr.placeholder);
			}
			else if (attr.showPlaceholder !== 'false') {
				var index = parseInt(attr.index || '0', 10);
				var defaultImages = [
					'img/placeholder1_exp.png',
					'img/placeholder2_exp.png'
				];
				setBackground(defaultImages[index % defaultImages.length]);
			}

			var lookupAndCache = function (entry){
				entryImageProvider.get(entry.link, function (src) {
					if (src) {
						ele.removeClass("loading")
							.addClass("loaded");
					}
					setBackground(src);
				});
			};
			var kill = scope.$watch(function () {
					return scope.$eval(attr.entryBackground);
				}, function (entry) {
					if (entry) {
						if (attr.changeAlways !== 'true') {
							kill();
							kill = null;

						}
						$timeout(function () {
							entryImageExtractor.get(entry)
							.then(function (src) {
								if (src) {
									setBackground(src);
								}else {
									lookupAndCache(entry);
								}
							}, function () {
								lookupAndCache(entry);
							});
						});
					}
				});

			scope.$on("$destroy", function () {
				if (kill) {
					kill();
				}
			});
		}
	};
})
.directive("entryImageListener", function () {
	return {
		retrict : "AC",
		controller : ['$element', '$attrs', function (ele) {
			var getSpinner = function () {
				var c = _.find(ele.children(), function (c) {
					var el = angular.element(c);
					return el.hasClass("spinner");
				});
				if (c) {
					return angular.element(c);
				}
				return null;
			};
			this.notifyCompleted = function () {
				var spinner = getSpinner();
				if (spinner) {
					spinner.addClass("hidden");
				}
			};
			this.notifyBegun = function () {
				var spinner = getSpinner();
				if (spinner) {
					spinner.removeClass("hidden");
				}
			};
		}]
	};
})
.directive("hoverTracker", function () {
	return function (scope, element, attr) {
		// element.append(angular.element("<div class='pegged pegged-" + (attr.hoverTracker || 'light') + "'>(--version)</div>"));
	};
})
.directive("entryImage", function ($timeout, entryImageExtractor, entryImageProvider) {
	return {
		restrict : 'AC',
		require : "?^entryImageListener",
		link : function (scope, ele, attr, listener) {
			if (attr.placeholder) {
				ele.attr("src", attr.placeholder);
			}
			else if (attr.showPlaceholder !== 'false') {
				var index = parseInt(attr.index || '0', 10);

				var defaultImages = [
					'img/placeholder1_exp.png',
					'img/placeholder2_exp.png'
				];
				ele.attr("src", defaultImages[index % 2]);
			} else {
				if (listener) {
					listener.notifyBegun();
				}
				ele.addClass("hidden");
			}

			var lookupAndCache = function (entry) {
				entryImageProvider.get(entry.link, function (src) {
					//change only if not an empty string
					if (src) {
						if (listener) {
							listener.notifyCompleted();
						}
						ele.attr("src", src);
						ele.removeClass("hidden");
					}
				});
			};

			var kill = scope.$watch(function () {
					return scope.$eval(attr.entryImage);
				}, function (entry) {
					if (entry) {
						kill();
						var link = entry.link;
						$timeout(function () {
							entryImageExtractor.get(entry)
							.then(function (src) {
								if (src) {
									if (listener) {
										listener.notifyCompleted();
									}
									ele.attr("src", src);
									ele.removeClass("hidden");
								}else {
									lookupAndCache(entry);
								}
							}, function () {
								lookupAndCache(entry);
							});
						});
					}
				});
		}
	};
});
