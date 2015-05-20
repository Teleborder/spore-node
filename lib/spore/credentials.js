var debug = require('debug')('spore'),
    async = require('async');

module.exports = Credentials;

function Credentials() {}

Credentials.prototype.getKey = function () {
  if(!this.deployment) {
    return this._getLocalKey();
  }

  return this._getDeploymentKey();
};

Credentials.prototype._getDeploymentKey = function () {
  var parsed = this.parseDeployment();

  debug("Getting key for Spore pod from Deployment environment variable");

  this.credentials = { name: parsed.name, key: parsed.key };

  return this.credentials;
};

Credentials.prototype._getLocalKey = function () {

  debug("Getting key for Spore pod from local netrc file");
  var netrc = this.netrc();


  if(netrc.hasHost(this.hostname())) {
    debug(".netrc contains an entry for " + this.hostname() + " - retrieving");

    key = netrc.host(this.hostname()).password;
    email = netrc.host(this.hostname()).login;
  } else {
    debug(".netrc contains no entry for " + this.hostname());
  }

  if(!key || !email) return false;

  this.credentials = { email: email, key: key };

  return this.credentials;
};
