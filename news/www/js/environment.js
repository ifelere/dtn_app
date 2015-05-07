(function (global) {
    var __listeners = [],
        __isDbReady = false,
        __db;

    global.DTN_SCOPE = {
    notifyDatabaseReady : function (db) {
        __db = db;
        __isDbReady = true;
        if (__listeners.length > 0) {
            for (var j = 0, len = __listeners.length; j < len; j++) {
                var p = __listeners.pop();
                p(__db);
            }
        }
    },
    database : {
        ready : function (action) {
            if (__isDbReady) {
                return action(__db);
            }else {
                __listeners.push(action);
            }
        }
    },
    entities : [
    		{
    			name : "feed",
                table : "tbl_app_feeds",
    			fields : {
    				link : "TEXT NOT NULL",
    				jsonData : "TEXT NOT NULL",
    				lastFetched : "TEXT"
    			}
    		},
    		{
    			name : "applicationCache",
                table : "tbl_app_cache",
    			fields : {
    				ckey : "TEXT NOT NULL",
    				cvalue :  "TEXT"
    			}
    		},
    		{

    			name : "entry",
                table : "tbl_app_entries",
    			fields : {
    				link : "TEXT NOT NULL",
    				jsonData : "TEXT",
    				imageSource : "TEXT",
                    sourceId : "INTEGER NOT NULL",
                    cIndex : "NUMBER"
    			}
    		}
    	]

    };
}(window));
