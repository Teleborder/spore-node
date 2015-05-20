var debug = require('debug')('spore'),
    async = require('async'),
    merge = require('merge');

module.exports = SporeAppGetSet;

function SporeAppGetSet() {}

SporeAppGetSet.prototype.get = function (envName, key, callback) {
  var env = this.findEnv(envName);

  if(arguments.length < 3) {
    callback = key;

    return env.getAll(callback);
  }

  env.get(key, callback);
};

SporeAppGetSet.prototype.getAll = function (key, callback) {
  var self = this,
      allKeys = false;

  if(arguments.length < 2) {
    allKeys = true;
    callback = key;
    key = null;
  }

  debug("Getting " + (allKeys ? "all keys" : key) + " for all environments of " + this.fullName());

  if(!this.envs.length) {
    debug("No environments on " + this.fullName() + " to retrieve values from");
    return callback(null, {});
  }

  async.map(this.envs, function (env, next) {

    var args = [env.name];

    if(!allKeys) {
      args.push(key);
    }

    args.push(function (err, kv) {
      if(err) return next(err);

      envValue = {};
      envValue[env.name] = kv;

      callback(null, envValue);
    });

    self.get.apply(self, args);

  }, function (err, envValues) {
    if(err) return callback(err);

    callback(null, merge.apply(null, envValues));
  });
};
