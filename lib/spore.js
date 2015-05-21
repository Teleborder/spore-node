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
Spore.prototype.loadEnv = function (envName, callback) {
  var self = this;

  this.loadApp(process.cwd(), function (err, app) {
    if(err) throw err;

    app.get(envName || self.defaultEnv(), function (err, envValues) {
      if(err) throw err;

      Object.keys(envValues).forEach(function (key) {
        process.env[key] = envValues[key];
      });

      callback(null, process.env);
    });
  });
};

Spore.prototype.loadEnvSync = function (envName) {
  return deasync(this.loadEnv).call(this, envName);
};
