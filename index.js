var clues = require("clues"),
    bluebird = require("bluebird");

bluebird.onPossiblyUnhandledRejection(function(e, promise){});

// Standard adaptor for the `when` library to be plugged into `clues.js`
var adapter = clues.prototype.adapter =  {};
adapter.fulfilled = bluebird.resolve;
adapter.rejected = bluebird.reject;
adapter.pending = function () {
  var deferred = bluebird.defer();
  return {
    promise: deferred.promise,
    fulfill: function(d) { deferred.resolve(d);},
    reject: function(d) { deferred.reject(d);}
  };
};

// Allow for resolution of multiple clues simultaneously.  The output is an associative
// array with each requested resolution (either the solution or the error).
// simply include argument data with a comma delimited list of the requested 
// clues.

function multi(data,resolve) {
  if (data.split) data = data.split(",");
  var defer = bluebird.defer();
  d = [].concat(data);
  var cnt = d.length,
      res = {};

  // Place the inputs into the res
  Object.keys(this.facts).forEach(function(key) {
    if (key !== 'data' && key !=='multi') res[key] = this.facts[key];
  },this);

  var update = function (key) {
    return function(d) {
      res[key] = d;
      if (!(--cnt)) {
        defer.resolve(res);
      }
    };
  };
  d.forEach(function(key) {
    this.self.solve(key)
      .then(update(key),update(key));
  },this);
  return defer.promise;
}

// Help simply returns all available API functions
function help() {
  return Object.keys(this.self.logic);
}

module.exports = function(api) {
  api = api || {};
  api.multi = multi;
  api.help = help;

  return function(req,res) {
    clues(api,req.query)
      .solve(req.param("fn"),{req:req,res:res})
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
        res.set('Content-Type','application/json');
        res.end(JSON.stringify(d,null,2));
      });
  };
};