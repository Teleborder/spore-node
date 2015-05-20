var fs = require('fs-extra'),
    debug = require('debug')('spore'),
    jsonComment = require('json-comment'),
    Env = require('./env'),
    GetSet = require('./app/get_set'),
    Errors = require('spore-errors'),
    resolvePath = require('./utils/resolve_path'),
    mixin = require('./utils/mixin');

module.exports = App;

function App(dir, spore) {
  mixin(this, this.constructor.GetSet);

  this.dir = dir;
  this.spore = spore;

  this.name = null;
  this.id = null;
  this.envs = [];

  debug("App initialized in " + this.dir);
}

App.Env = Env;
App.GetSet = GetSet;

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
  return this.spore.api.apply(this.spore, [].slice.call(arguments));
};

App.prototype.isDeployment = function () {
  return this.spore.isDeployment.apply(this.spore, [].slice.call(arguments));
};

App.prototype.load = function (callback) {
  var self = this,
      sporeFilePath = resolvePath(this.dir, this.spore.sporeFile());

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

