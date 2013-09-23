var express = require("express"),
    clues = require("clues"),
    when = require("when");

// Standard adaptor for the `when` library to be plugged into `clues.js`
var adapter = clues.adapter =  {};
adapter.fulfilled = when.resolve;
adapter.rejected = when.reject;
adapter.pending = function () {
    var deferred = when.defer();
    return {
        promise: deferred.promise,
        fulfill: deferred.resolve,
        reject: deferred.reject
    };
};

// Allow for resolution of multiple clues simultaneously.  The output is an associative
// array with each requested resolution (either the solution or the error).
// simply include argument data with a comma delimited list of the requested 
// clues.

function multi(data) {
  var p = when.defer();
  if (data.split) data = data.split(",");

  d = [].concat(data);
  var cnt = d.length,
      res = {};

  // Place the inputs into the res
  Object.keys(this.facts).forEach(function(key) {
    if (key !== 'data') res[key] = this.facts[key];
  },this);

  var update = function (key) {
    return function(d) {
      res[key] = d;
      if (!(--cnt)) {
        p.resolve(res);
      }
    };
  };

  d.forEach(function(key) {
    this.self.solve(key)
      .then(update(key),update(key));
  },this);
  return p.promise;
}

// Help simply returns all available API functions
function help() {
  return Object.keys(this.self.logic);
}

module.exports = function(api) {
  api = api || {};
  api.multi = multi;
  api.help = help;

  return express()
    .all('/:fn?',function(req,res) {
      clues(api,req.query)
        .solve(req.param("fn"),{res:res})
        .then(function(d) {
          if (req.param("select")) {
            req.param("select").split(".").forEach(function(key) {
              d = d && d[key];
            });
          }
          return d;
        })
        .then(null,function(e) {
          // Convert error object to text  
          if (e.err.message) e.err = { message: e.err.message,stack:e.err.stack};
          return e;
        })
        .then(function(d) {
          res.end(JSON.stringify(d,null,2));
        });
    });
};