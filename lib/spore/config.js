var path = require('path'),
    url = require('url'),
    fs = require('fs-extra'),
    netrc = require('netrc-rw'),
    debug = require('debug')('spore'),
    Api = require('spore-api'),
    Errors = require('spore-errors'),
    resolvePath = require('../utils/resolve_path'),
    stringify = require('../utils/stringify'),
    defaultConfig = require('./config/default.json');

module.exports = Config;

function Config() {
  this.deployment = process.env.SPORE_DEPLOYMENT;
  this.homeDir = process.env.SPORE_HOME || '~/.spore';
  this.configFile = 'config.json';
  this._config = null;
  this.defaultConfig = defaultConfig;
}

Config.prototype.isDeployment = function () {
  return !!this.deployment;
};

Config.prototype.configPath = function () {
  return resolvePath(this.sporePath(), this.configFile);
};

Config.prototype.sporePath = function () {
  return resolvePath(this.homeDir);
};

Config.prototype.host = function (host, callback) {
  if(arguments.length < 2) {
    callback = host;
    return this.getConfig('host', callback);
  }

  this.setConfig('host', host, callback);
};

Config.prototype.parseHost = function (callback) {
  this.host(function (err, host) {
    if(err) return callback(err);

    var parsed = url.parse(host);

    // for some reason `url.parse` includes the final `:`
    // in the protocol
    parsed.protocol = parsed.protocol.slice(0, -1 * ':'.length);

    callback(null, parsed);
  });
};

Config.prototype.parseDeployment = function () {
  if(!this.isDeployment()) throw new Error("No deployment string to parse");

  var parsed = {
        host: null,
        name: null,
        environment: null,
        app: null,
        key: null
      },
      userPassword,
      user;

  userPassword = this.deployment.split('@')[0];
  parsed.host = this.deployment.split('@')[1];
  user = userPassword.split(':')[0];
  parsed.key = userPassword.split(':')[1];
  parsed.name = user.split('+')[0];
  parsed.environment = user.split('+')[1];
  parsed.app = user.split('+')[2];

  return parsed;
};

Config.prototype.netrcFile = function (filename, callback) {
  if(arguments.length < 2) {
    callback = filename;
    return this.getConfig('netrc', callback);
  }

  this.setConfig('netrc', filename, callback);
};

Config.prototype.sporeFile = function (filename, callback) {
  if(arguments.length < 2) {
    callback = filename;
    return this.getConfig('sporeFile', callback);
  }

  this.setConfig('sporeFile', filename, callback);
};

Config.prototype.defaultEnv = function (envName, callback) {
  if(arguments.length < 2) {
    callback = envName;
    return this.getConfig('defaultEnv', callback);
  }

  this.setConfig('defaultEnv', envName, callback);
};

Config.prototype.api = function (callback) {
  var self = this;

  if(this._api) {
    process.nextTick(function () {
      callback(null, self._api);
    });
    return this;
  }

  this.parseHost(function (err, options) {
    if(err) return callback(err);

    self._api = new Api(options);

    callback(null, self._api);
  });

  return this;
};

Config.prototype.netrc = function (callback) {
  var self = this;

  if(this._netrc) {
    process.nextTick(function () {
      callback(null, self._netrc);
    });
    return this;
  }

  this.netrcFile(function (err, netrcFile) {
    if(err) return callback(err);

    self._netrc = netrc;
    self._netrc.file(resolvePath(netrcFile));

    callback(null, self._netrc);
  });

  return this; 
};

Config.prototype.getConfig = function (keys, callback) {
  var self = this;

  debug("Retrieving config for " + keys);

  if(!this._config) {
    debug("Config not yet initialized");

    this._loadConfig(function (err) {
      if(err) return callback(err);

      callback.apply(null, [null].concat(self._getConfig(keys)));
    });

    return;
  }

  process.nextTick(function () {
    callback.apply(null, [null].concat(self._getConfig(keys)));
  });
};

Config.prototype._getConfig = function (keys) {
  var self = this;

  if(!Array.isArray(keys)) {
    keys = [keys];
  }

  return keys.map(function (key) {
    if(self._config[key] === undefined) {
      throw new Error("No configuration for `" + key + "`");
    }
    return self._config[key];
  });
};

// Get the current spore configuration, or create a config file
// with the default configuration if no config file exists
Config.prototype._loadConfig = function (callback) {
  var self = this;

  debug("Reading config file at " + this.configPath());

  fs.readJson(this.configPath(), { encoding: 'utf8' }, function (err, json) {
    if(err && err.code === 'ENOENT') {

      debug("No config file found");

      if(self.isDeployment()) {
        debug("This is a deployment, loading from environment");

        self._loadConfigForDeployment(callback);

        return;
      }

      debug("We're working locally, creating one.");

      fs.ensureDir(path.dirname(self.configPath()), function (err) {
        if(err) return callback(err);

        fs.writeFile(self.configPath(), stringify(self.defaultConfig), function (err) {
          if(err) return callback(err);

          debug("Default config written to " + self.configPath());

          self._loadConfig(callback);
        });
      });

      return;
    }

    if(err) return callback(err);

    debug("Config file found, loading");

    self._config = json;

    callback(null, self);
  });
};

Config.prototype._loadConfigForDeployment = function () {
  var self = this;

  debug("Loading default config for deployment");
  this._config = this.defaultConfig;

  debug("Setting host based on deployment key");
  this._config.host = this.parseDeployment().host;

  debug("Setting default environment based on deployment key");
  this._config.defaultEnv = this.parseDeployment().environment;

  debug("Checking for any specific environment variables for overrides");
  Object.keys(this._config).forEach(function (key) {

    var configEnvName = 'SPORE_' + key.toUpperCase();

    if(process.env[configEnvName] !== undefined) {
      debug(configEnvName + " was set");
      self._config[key] = process.env[configEnvName];
    }
  });
};

Config.prototype.setConfig = function (key, value, callback) {
  var self = this;

  if(!this._config) {
    debug("Config not yet initialized");

    this._loadConfig(function (err) {
      if(err) return callback(err);
      self._setConfig(key, value, callback);
    });

    return;
  }

  process.nextTick(function () {
    self._setConfig(key, value, callback);
  });
};

Config.prototype._setConfig = function (key, value, callback) {
  var self = this;

  this._config[key] = value;

  debug("Writing to config file at " + this.configPath());

  fs.writeFile(this.configPath(), stringify(this._config), function (err) {
    if(err) return callback(err);

    callback(null, self._config);
  });
};
