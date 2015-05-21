var fs = require('fs-extra'),
    debug = require('debug')('spore'),
    async = require('async'),
    merge = require('merge'),
    jsonComment = require('json-comment'),
    Env = require('./env'),
    Errors = require('spore-errors'),
    resolvePath = require('./utils/resolve_path');

module.exports = App;

function App(dir, spore) {
  this.dir = dir;
  this.spore = spore;

  this.name = null;
  this.id = null;
  this.envs = [];

  debug("App initialized in " + this.dir);
}

App.Env = Env;

App.load = function (dir, spore, callback) {
  var App = this,
      app;

  app = new App(dir, spore);
  return app.load(callback);
};

App.prototype.remotePath = function () {
  return this.id;
};

App.prototype.fullName = function () {
  return this.name;
};

App.prototype.api = function () {
  return this.spore.config.api.apply(this.spore.config, [].slice.call(arguments));
};

App.prototype.isDeployment = function () {
  return this.spore.config.isDeployment.apply(this.spore.config, [].slice.call(arguments));
};

App.prototype.load = function (callback) {
  var self = this,
      sporeFilePath = resolvePath(this.dir, this.spore.config.sporeFile());

  debug("Loading sporeFile at " + sporeFilePath);
  fs.readJson(sporeFilePath, { encoding: 'utf8' }, function (err, json) {
    if(err && err.code === 'ENOENT') {
      return callback(Errors.noAppFound.build(sporeFile, self.dir));
    }
    if(err) return callback(err);

    json = jsonComment.strip(json);

    self._load(json);

    callback(null, self);
  });

  return this;
};

App.prototype._load = function (json) {
  var self = this;

  this.name = json.name;
  this.id = json.id;

  Object.keys(json.envs || {}).forEach(function (envName) {
    self.newEnv(envName, json.envs[envName]);
  });
};

App.prototype.newEnv = function (envName, ids) {
  var env = new this.constructor.Env(this, envName, ids);
  this.envs.push(env);
  return env;
};

App.prototype.findEnv = function (envName) {
  var env;

  debug("Finding environment " + envName);

  for(var i=0; i<this.envs.length; i++) {
    if(this.envs[i].name === envName) {
      env = this.envs[i];
      break;
    }
  }

  if(!env) {
    debug("Environment " + envName + " does not exist");
    env = this.newEnv(envName);
  }

  return env;
};

App.prototype.get = function (envName, key, callback) {
  var env = this.findEnv(envName);

  if(arguments.length < 3) {
    callback = key;

    return env.getAll(callback);
  }

  env.get(key, callback);
};

App.prototype.getAll = function (key, callback) {
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
