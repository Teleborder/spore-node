var path = require('path'),
    merge = require('merge'),
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

function Config(spore) {
  this.spore = spore;

  this.envPrefix = 'SPORE_';
  this.deployment = process.env[this.envPrefix + 'DEPLOYMENT'];
  this.homeDir = process.env[this.envPrefix + 'HOME'] || '~/.spore';
  this.configFile = 'config.json';
  this._config = null;
  this.defaultConfig = defaultConfig;
  this.load();
}

Config.prototype.isDeployment = function () {
  return !!this.deployment;
};

Config.prototype.path = function () {
  return resolvePath(this.sporePath(), this.configFile);
};

Config.prototype.sporePath = function () {
  return resolvePath(this.homeDir);
};

Config.prototype.host = getSet('host');
Config.prototype.sporeFile = getSet('sporeFile');
Config.prototype.defaultEnv = getSet('defaultEnv');
Config.prototype.defaultEnvs = getSet('defaultEnvs');

function getSet(key) {
  return function(val) {
    if(arguments.length) {
      return this.set(key, val);
    }

    return this.get(key);
  };
}

Config.prototype.proxy = function () {
  if(!this.get('useProxy')) {
    return false;
  }
  var proxy = this.get('proxy') || {};

  return proxy.host || ('http://127.0.0.1:' + proxy.port);
};

Config.prototype.parseProxy = function () {
  var proxy = this.proxy();

  if(!proxy) return false;

  return this._parse(proxy);
};

Config.prototype.parseHost = function () {
  return this._parse(this.host());
};

Config.prototype._parse = function (host) {
  var parsed = url.parse(host);

  // for some reason `url.parse` includes the final `:`
  // in the protocol
  parsed.protocol = parsed.protocol.slice(0, -1 * ':'.length);

  return parsed; 
};

Config.prototype.parseDeployment = function () {
  if(!this.isDeployment()) throw new Error("No deployment string to parse");

  var deploymentRe = /(http|https):\/\/([a-zA-Z0-9-]+)\+([a-zA-Z0-9-]+)\+([a-f0-9-]+):([^@]+)@(.+)/,
      parsed = deploymentRe.exec(this.deployment);

  return {
    name: parsed[2],
    environment: parsed[3],
    app: parsed[4],
    key: parsed[5],
    host: parsed[1] + '://' + parsed[6]
  };
};

Config.prototype.api = function (setCredentials) {
  var apiOptions,
      credentials;

  setCredentials = setCredentials === false ? false : true;

  if(!this._api) {
    this._api = new Api(this.parseProxy() || this.parseHost());

    if(setCredentials) {
      credentials = this.getCredentials();

      if(credentials) {
        this._api.setCredentials(credentials);
      }
    }
  }

  return this._api;
};

Config.prototype.netrc = function () {
  if(!this._netrc) {
    this._netrc = netrc;
    this._netrc.file(resolvePath(this.get('netrc')));
  }

  return this._netrc; 
};

Config.prototype.getCredentials = function () {
  if(!this.isDeployment()) {
    return this._getLocalCreds();
  }

  return this._getDeploymentCreds();
};

Config.prototype._getDeploymentCreds = function () {
  var parsed = this.parseDeployment();

  debug("Getting key for Spore pod from Deployment environment variable");

  return { name: parsed.name, key: parsed.key };
};

Config.prototype._getLocalCreds = function () {
  var key,
      email;

  debug("Getting key for Spore pod from local netrc file");
  var netrc = this.netrc(),
      hostname = this.parseHost().hostname;

  if(netrc.hasHost(hostname)) {
    debug(".netrc contains an entry for " + hostname + " - retrieving");

    key = netrc.host(hostname).password;
    email = netrc.host(hostname).login;
  } else {
    debug(".netrc contains no entry for " + hostname);
  }

  if(!key || !email) {
    debug("no key or email available from .netrc");
    return false;
  }

  return { email: email, key: key };
};

Config.prototype.get = function (key, callback) {
  var self = this;

  if(!this._config) {
    throw new Error("Config not yet initialized when accessing `" + key + "`");
  }

  return this._config[key];
};

Config.prototype.set = function (key, value, callback) {
  var self = this;

  if(!this._config) {
    throw new Error("Config not yet initialized");
  }

  return this._config[key] = value;
};

// Get the current spore configuration, or create a config file
// with the default configuration if no config file exists
Config.prototype.load = function () {

  debug("Using default config as our baseline");
  this._config = merge(true, this.defaultConfig);

  if(this.isDeployment()) {
    debug("This is a deployment, loading from environment");

    return this._loadDeployment();
  }

  debug("Reading config file at " + this.path());

  try { 
    merge(this._config, fs.readJsonSync(this.path(), { encoding: 'utf8' }));
  } catch(e) {
    if(e.code !== 'ENOENT') {
      throw e;
    }

    debug("No config file found, sticking with defaults");
  }

  return this._config;
};

Config.prototype._loadDeployment = function () {
  var self = this;

  debug("Setting host based on deployment key");
  this.host(this.parseDeployment().host);

  debug("Setting default environment based on deployment key");
  this.defaultEnv(this.parseDeployment().environment);

  debug("Setting proxy use to false in deployment");
  this.set('useProxy', false);

  debug("Checking for any specific environment variables for overrides");
  Object.keys(this._config).forEach(function (key) {

    var configEnvName = self.envPrefix + key.toUpperCase();

    if(process.env[configEnvName] !== undefined) {
      debug(configEnvName + " was set in the environment");
      self.set(key, process.env[configEnvName]);
    }
  });
};
