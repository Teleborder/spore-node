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

function Config() {
  this.deployment = process.env.SPORE_DEPLOYMENT;
  this.homeDir = process.env.SPORE_HOME || '~/.spore';
  this.configFile = 'config.json';
  this._config = null;
  this.defaultConfig = defaultConfig;
  this._loadConfig();
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

Config.prototype.host = getSet('host');
Config.prototype.sporeFile = getSet('sporeFile');
Config.prototype.defaultEnv = getSet('defaultEnv');
Config.prototype.defaultEnvs = getSet('defaultEnvs');

Config.prototype.parseHost = function (callback) {

  var parsed = url.parse(this.host());

  // for some reason `url.parse` includes the final `:`
  // in the protocol
  parsed.protocol = parsed.protocol.slice(0, -1 * ':'.length);

  return parsed;
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

Config.prototype.api = function () {
  var self = this;

  if(!this._api) {
    this._api = new Api(this.parseHost());
    this._api.setCredentials(this.credentials);
  }

  return this._api;
};

Config.prototype.netrc = function () {
  var self = this;

  if(!this._netrc) {
    this._netrc = netrc;
    this._netrc.file(resolvePath(this.getConfig('netrc')));
  }

  return this._netrc; 
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
Config.prototype._loadConfig = function () {
  debug("Reading config file at " + this.configPath());

  try { 
    this._config = fs.readJsonSync(this.configPath(), { encoding: 'utf8' });
  } catch(e) {
    if(e.code !== 'ENOENT') {
      throw e;
    }

    debug("No config file found, using defaults");

    this._config = merge(true, this.defaultConfig);

    if(this.isDeployment()) {
      debug("This is a deployment, loading from environment");

      return self._loadConfigForDeployment();
    }

    debug("We're working locally, creating one.");

    fs.ensureDirSync(path.dirname(this.configPath()));

    fs.writeFileSync(this.configPath(), stringify(this._config));

    debug("Config written to " + self.configPath());
  }

  return this._config;
};

Config.prototype._loadConfigForDeployment = function () {
  var self = this;

  debug("Setting host based on deployment key");
  this.host(this.parseDeployment().host);

  debug("Setting default environment based on deployment key");
  this.defaultEnv(this.parseDeployment().environment);

  debug("Checking for any specific environment variables for overrides");
  Object.keys(this._config).forEach(function (key) {

    var configEnvName = 'SPORE_' + key.toUpperCase();

    if(process.env[configEnvName] !== undefined) {
      debug(configEnvName + " was set in the environment");
      self.set(key, process.env[configEnvName]);
    }
  });
};

function getSet(key, val) {
  if(arguments.length > 1) {
    return this.set(key, val);
  }

  return this.get(key);
}
