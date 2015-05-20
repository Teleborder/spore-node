var EventEmitter = require('events').EventEmitter,
    debug = require('debug')('spore'),
    Config = require('./spore/config'),
    Credentials = require('./spore/credentials'),
    App = require('./app'),
    mixin = require('./utils/mixin');

module.exports = Spore;

function Spore() {
  mixin(this, EventEmitter);
  mixin(this, this.constructor.Config);
  mixin(this, this.constructor.Credentials);
}

Spore.App = App;
Spore.Config = Config;
Spore.Credentials = Credentials;

Spore.prototype.loadApp = function (dir, callback) {
  return this.constructor.App.load(dir, this, callback);
};

// Load an environment into the current process
Spore.prototype.loadEnv = function (envName) {
  var self = this;

  this.loadApp(process.cwd(), function (err, app) {
    if(err) throw err;

    self.defaultEnv(function (err, defaultEnv) {
      if(err) throw err;

      app.get(envName || defaultEnv, function (err, envValues) {
        if(err) throw err;

        Object.keys(envValues).forEach(function (key) {
          process.env[key] = envValues[key];
        });
      });
    });
  });
};
