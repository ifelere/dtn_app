

angular.module("dtn.database", [])



.service("Database", function ($q, $cordovaSQLite) {
	var ID_COLUMN = "_id";
	
	var normalizeFields = function (fields) {
		if (angular.isString(fields)) {
			return fields.replace(/(\s*|\,)?id/i, ID_COLUMN);
		}
		for (var i = 0, len = fields.length; i < len; i++) {
			if ("id" === fields[i]) {
				fields[i] = ID_COLUMN;
			}
		}
		return fields;
	};
	
    var Entity = function (definition) {
        this.definition = definition;
		this.table = definition.table || definition.name;
    };

	var preprocessRow = function (row) {
		if (row.jsonData) {
			if (angular.isString(row.jsonData)) {
				var d = angular.fromJson(row.jsonData);
				row = angular.extend(d, _.omit(row, 'jsonData'));
			}else {
				row = _.extend(row, row.jsonData);
				delete row.jsonData;
			}

		}
		if (angular.isUndefined(row.id)) {
			row.id = row[ID_COLUMN];	
		}
		return row;
	};



	var buildWhereClause = function (options) {

		var whereClause = '';

		var params = [];

		if (options) {
			var addLogical = function (anded, buffer) {
				if (buffer.length > 0) {
					if (anded) {
						buffer += " and ";
					}else {
						buffer += " or ";
					}
				}
				return buffer;
			};

			angular.forEach(options.$filter || options, function (value, key) {
				if ('id' === key) {
					key = ID_COLUMN;
				}
				whereClause = addLogical(true, whereClause);
				if ('$or' === key) {
					whereClause += "(";
					var lw = '';
					angular.forEach(value, function (o, k) {
						lw = addLogical(false, lw);
						lw += (k + '=?');
						params.push(o);
					});
					whereClause += lw + ")";
				}else {
					whereClause += (key + '=?');
					params.push(value);
				}
			});
		}


		return {
			filter : whereClause,
			params : params
		};
	};

	Entity.prototype.remove = function (options) {
		var where = buildWhereClause(options);

		var statement = "DELETE FROM " + this.table;
		if (where.filter.length > 0) {
			statement += (" WHERE " + where.filter);
		}


		var deferred = $q.defer();
		
		DTN_SCOPE.database.ready(function (db) {
			$cordovaSQLite.execute(db, statement, where.params)
			.then(function (res) {
				deferred.resolve(res.rowsAffected);
			}, function (err) {
				deferred.reject(err);
			});	
		});
		
		return deferred.promise;

	};


	Entity.prototype.insert = function (data) {
		var keys = _.keys(data);
		var fields = keys.join(",");
		var args = _.reduce(keys, function (m, k) {
			if (m.length > 0) {
				return m + ",?";
			}
			return "?";
		}, '');

		var deferred = $q.defer();

		var statement = "INSERT INTO " + this.table + "(" + fields + ") VALUES (" + args + ")";
		
		DTN_SCOPE.database.ready(function (db) {
			$cordovaSQLite.execute(db, statement, _.values(data))
			.then(function (res) {
				data.id = data[ID_COLUMN] = res.insertId;
				
				deferred.resolve(preprocessRow(data));
			}, function (err) {
				deferred.reject(err);
			});	
		});
		
		return deferred.promise;
	};



	var findImpl = function (definition, fields, options, single) {
		var where = buildWhereClause(options);

		if (!fields) {
			fields = _.keys(definition.fields);
			fields.splice(0, 0, ID_COLUMN);
		}else {
			fields = normalizeFields(fields);
		}

		options = options || {};

		var order = null;

		if (options.$order) {
			order = options.$order;
		}

		var statement = "SELECT ";

		if (angular.isArray(fields)) {
			fields = fields.join(",");
		}

		statement += (fields + " FROM " + (definition.table || definition.name));

		if (where.filter.length > 0) {
			statement += (" WHERE " + where.filter);
		}

		if (order) {
			statement += " ORDER BY";
			angular.forEach(order, function (v, f) {
				statement += (" " + f);
				if ((/asc|desc/i).test(v)) {
					statement += (" " + v);
				} else if (v < 1 || v === '-1'){
					statement += " DESC";
				}else {
					statement += " ASC";
				}
			});
		}
		if (single) {
			statement += " LIMIT 1";
		}
		var deferred = $q.defer();

		DTN_SCOPE.database.ready(function (db) {
			$cordovaSQLite.execute(db, statement, where.params)
			.then(function (res) {
				if (single) {
					if (res.rows.length > 0) {
						deferred.resolve(
							preprocessRow(res.rows.item(0)));
					}else {
						deferred.resolve(null);
					}
				}else {
					var data = [];
					for (var j = 0, len = res.rows.length; j < len; j++) {
						data.push(
							preprocessRow(res.rows.item(j))
						);
					}
					deferred.resolve(data);	
				}
			}, function (err) {
				deferred.reject(err);
			});	
		});
		
		return deferred.promise;
	};

	Entity.prototype.update = function(id, data) {
		var params = [],
		fields = _.keys(data),
		statement = "UPDATE " + this.table + " SET";
		statement += _.reduce(fields, function (m, f) {
			params.push(data[f]);
			return (m + ' ' + f + '=?');
		}, '');

		statement += (" WHERE " + ID_COLUMN + "=?");
		params.push(id);

		var deferred = $q.defer();

        DTN_SCOPE.database.ready(function (db) {
			$cordovaSQLite.execute(db, statement, params)
			.then(function (res) {
				deferred.resolve(res.rowsAffected);
			}, function (err) {
				deferred.reject(err);
			});	
		});

		
		return deferred.promise;
	};

	Entity.prototype.first = function (options) {
		if (arguments.length > 1) {
			return findImpl(this.definition, arguments[0] , arguments[1], true);
		}
		return findImpl(this.definition, null, options, true);
	};

	Entity.prototype.find = function (options) {
		if (arguments.length > 1) {
			return findImpl(this.definition, arguments[0] , arguments[1], false);
		}
		return findImpl(this.definition, null, options, false);
	};

	return {
		entity : function (name) {
			var e = _.findWhere(DTN_SCOPE.entities, {name : name});
			if (!e) {
				throw new Error(name + " entity not found");
			}
			return new Entity(e);
		},

		execute : function (statement, params) {
			var deferred = $q.defer();
			DTN_SCOPE.database.ready(function (db) {
				$cordovaSQLite.execute(db, statement, params)
				.then(function (r) {
					deferred.resolve(r);
				}, function (err) {
					deferred.reject(err);
				});	
			});
			return deferred.promise;
		}
	};


})

.run(function ($ionicPlatform, $cordovaSQLite) {
	var ID_COLUMN = "_id";

	$ionicPlatform.ready(function() {
		if(window.cordova && window.cordova.plugins.Keyboard) {
			cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
		}
		if(window.StatusBar) {
			StatusBar.styleDefault();
		}
		var db, dbName = "dtn.database";
		if (window.cordova) {
		  db = $cordovaSQLite.openDB({ name: dbName }); //device
		}else{
		  db = window.openDatabase(dbName, '1', 'dtn', 1024 * 1024 * 100); // browser
		}
		//db = $cordovaSQLite.openDB("dtn.database");
		DTN_SCOPE.database.db = db;
        var createEntity = function (index) {
            if (index < DTN_SCOPE.entities.length) {
                var entity = DTN_SCOPE.entities[index];
                var sql = "CREATE TABLE IF NOT EXISTS " + (entity.table || entity.name) + "(" + ID_COLUMN + " INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL";
    			angular.forEach(entity.fields, function (type, name) {
    				sql += (", " + name + " " + type);
    			});
    			sql += ")";
    			$cordovaSQLite.execute(db, sql)
                .then(function () {
                    createEntity(index + 1);
                }, function (err) {
                    if (console) {
                        console.error(err);
                    }
                });
            }else {
                DTN_SCOPE.notifyDatabaseReady(db);
            }
        };
        createEntity(0);
	});

});
