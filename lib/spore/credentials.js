var debug = require('debug')('spore'),
    async = require('async');

module.exports = Credentials;

function Credentials() {}

Credentials.prototype.getKey = function (callback) {
  if(!this.deployment) {
    return this._getLocalKey(callback);
  }

  return this._getDeploymentKey(callback);
};

Credentials.prototype._getDeploymentKey = function (callback) {
  var parsed = this.parseDeployment(),
      self = this;

  debug("Getting key for Spore pod from Deployment environment variable");

  this.api(function (err, api) {
    if(err) return callback(err);

    debug("Setting credentials in this instance of the api");
    api.setCredentials({ name: parsed.name, key: parsed.key });

    callback(null, { name: parsed.name, key: parsed.key });
  });
};

Credentials.prototype._getLocalKey = function (callback) {
  var self = this;

  debug("Getting key for Spore pod from local netrc file");

  async.parallel({
    host: function (next) {
      self.parseHost(next);
    },
    netrc: function (next) {
      self.netrc(next);
    },
    api: function (next) {
      self.api(next);
    }
  }, function (err, results) {
    if(err) return callback(err);

    var hostname = results.host.hostname,
        netrc = results.netrc,
        api = results.api,
        key,
        email;

    try {
      if(netrc.hasHost(hostname)) {
        debug(".netrc contains an entry for " + hostname + " - retrieving");

        key = netrc.host(hostname).password;
        email = netrc.host(hostname).login;
      } else {
        debug(".netrc contains no entry for " + hostname);
      }
    } catch(e) {
      return callback(e);
    }

    if(!key) return callback(null, false);
    if(!email) return callback(null, false);

    debug("Setting credentials in this instance of the api");

    api.setCredentials({ email: email, key: key });

    callback(null, { email: email, key: key });
  });
};
