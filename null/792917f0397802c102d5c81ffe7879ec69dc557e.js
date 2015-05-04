
/*
Nicholas Clawson -2014

To be launched by an Atom Task, uses packages own grunt
installation to parse a projects Gruntfile
 */

(function() {
  var grunt, path;

  grunt = require('grunt');

  path = require('path');

  module.exports = function(gruntfilePath) {
    var e, error, fn;
    fn = null;
    try {
      fn = require(gruntfilePath);
    } catch (_error) {
      e = _error;
    }
    if (!fn) {
      return {
        error: "Gruntfile not found."
      };
    }
    process.chdir(path.dirname(gruntfilePath));
    try {
      fn(grunt);
    } catch (_error) {
      e = _error;
      error = e.code;
      return {
        error: "Error parsing Gruntfile. " + e.message
      };
    }
    return {
      tasks: Object.keys(grunt.task._tasks)
    };
  };

}).call(this);
