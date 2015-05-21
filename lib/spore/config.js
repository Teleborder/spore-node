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

  this.envPrefix = 'SPORE_'
  this.deployment = process.env.SPORE_DEPLOYMENT;
  this.homeDir = process.env.SPORE_HOME || '~/.spore';
  this.configFile = 'config.json';
  this._config = null;
  this.defaultConfig = defaultConfig;
  this._load();
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

Config.prototype.parseHost = function (callback) {

  var parsed = url.parse(this.host());

  // for some reason `url.parse` includes the final `:`
  // in the protocol
  parsed.protocol = parsed.protocol.slice(0, -1 * ':'.length);

  return parsed;
};

Config.prototype.parseDeployment = function () {
  if(!this.isDeployment()) throw new Error("No deployment string to parse");

  var deploymentRe = /([a-zA-Z0-9-]+)\+([a-zA-Z0-9-]+)\+([a-f0-9-]+):([^@]+)@(.+)/,
      parsed = deploymentRe.exec(this.deployment);

  return {
    name: parsed[1],
    environment: parsed[2],
    app: parsed[3],
    key: parsed[4],
    host: parsed[5]
  };
};

Config.prototype.api = function () {
  var self = this;

  if(!this._api) {
    this._api = new Api(this.parseHost());
    this._api.setCredentials(this.getCredentials());
  }

  return this._api;
};

Config.prototype.netrc = function () {
  var self = this;

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

  if(!key || !email) return false;

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
Config.prototype._load = function () {
  debug("Reading config file at " + this.path());

  try { 
    this._config = fs.readJsonSync(this.path(), { encoding: 'utf8' });
  } catch(e) {
    if(e.code !== 'ENOENT') {
      throw e;
    }

    debug("No config file found, using defaults");

    this._config = merge(true, this.defaultConfig);

    if(this.isDeployment()) {
      debug("This is a deployment, loading from environment");

      return self._loadDeployment();
    }

    debug("We're working locally, creating one.");

    fs.ensureDirSync(path.dirname(this.path()));

    fs.writeFileSync(this.path(), stringify(this._config));

    debug("Config written to " + self.path());
  }

  return this._config;
};

Config.prototype._loadDeployment = function () {
  var self = this;

  debug("Setting host based on deployment key");
  this.host(this.parseDeployment().host);

  debug("Setting default environment based on deployment key");
  this.defaultEnv(this.parseDeployment().environment);

  debug("Checking for any specific environment variables for overrides");
  Object.keys(this._config).forEach(function (key) {

    var configEnvName = self.envPrefix + key.toUpperCase();

    if(process.env[configEnvName] !== undefined) {
      debug(configEnvName + " was set in the environment");
      self.set(key, process.env[configEnvName]);
    }
  });
};
