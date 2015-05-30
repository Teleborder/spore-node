var debug = require('debug')('spore'),
    Config = require('./spore/config'),
    App = require('./app'),
    async = require('async'),
    deasync = require('deasync');

module.exports = Spore;

function Spore() {
  this.config = new this.constructor.Config(this);
}

Spore.App = App;
Spore.Config = Config;

Spore.prototype.api = function () {
  return this.config.api.apply(this.config, [].slice.call(arguments));
};

Spore.prototype.isDeployment = function () {
  return this.config.isDeployment.apply(this.config, [].slice.call(arguments));
};

Spore.prototype.loadApp = function (dir, callback) {
  return this.constructor.App.load(dir, this, callback);
};

// Load an environment into the current process
Spore.prototype.loadEnv = function (envName, clobber, callback) {
  var self = this;

  if(arguments.length < 3) {
    callback = clobber;
    clobber = false;
  }

  if(clobber !== true) {
    clobber = false;
  }

  this.loadApp(process.cwd(), function (err, app) {
    if(err) throw err;

    app.get(envName || self.config.defaultEnv(), function (err, envValues) {
      if(err) throw err;

      if(envValues[self.config.appEnv()] != null) {
        debug(self.config.appEnv() + " environment variable found. Translating to NODE_ENV");
        envValues.NODE_ENV = self.config.appEnv();
      }

      if(clobber) {
        self._setEnvClobber(envValues);
      } else {
        self._setEnv(envValues);
      }

      callback(null, process.env);
    });
  });
};

Spore.prototype._seEnvClobber = function (envValues) {
  Object.keys(envValues).forEach(function (key) {
    process.env[key] = envValues[key];
  });
};

Spore.prototype._setEnv = function (envValues) {
  Object.keys(envValues).forEach(function (key) {
    if(process.env[key] === undefined) {
      process.env[key] = envValues[key];
    }
  });
};

Spore.prototype.loadEnvSync = function (envName, clobber) {
  var args = [envName];

  if(clobber === true) {
    args.push(clobber);
  }

  return deasync(this.loadEnv).apply(this, args);
};
