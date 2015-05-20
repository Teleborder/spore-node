var Errors = require('spore-errors'),
    debug = require('debug')('spore'),
    uuid = require('node-uuid').v4;

module.exports = Cell;

function Cell(env, key, id) {
  this.env = env;
  this.key = key;
  this.id = id || uuid();
  this._value = Errors.noValue.build(this.fullName());

  debug(this.fullName() + " cell initialized");
}

Cell.prototype.api = function () {
  return this.env.api.apply(this.env, [].slice.call(arguments));
};

Cell.prototype.isDeployment = function () {
  return this.env.isDeployment.apply(this.env, [].slice.call(arguments));
};

Cell.prototype.remotePath = function () {
  return this.env.remotePath() + '/' + this.id;
};

Cell.prototype.fullName = function () {
  return this.env.fullName() + '/' + this.key;
};

Cell.prototype.value = function (val) {
  if(arguments.length) {
    if(typeof val !== 'string') {
      throw Errors.onlyStrings.build(this.fullName());
    }
    this._value = val;
  }

  if(Errors.noValue.test(this._value)) throw this._value;

  if(typeof this._value !== 'string') {
    throw Errors.onlyStrings.build(this.fullName());
  }

  return this._value;
};

Cell.prototype.getKv = function (callback) {
  var key = this.key;

  this.getValue(function (err, val) {
    if(err) return callback(err);

    var kv = {};
    kv[key] = val;

    callback(null, kv);
  });
};

Cell.prototype.getValue = function (callback) {
  var val;

  debug("Getting cell value for " + this.key);

  try {
    val = this.value();
  } catch(e) {
    if(!Errors.noValue.test(e)) return callback(e);

    this._load(function (err, cell) {
      if(err) return callback(err);

      callback(null, cell.value());
    });
    return;
  }

  callback(null, val);

  return;
};

Cell.prototype._load = function (callback) {
  var self = this;

  debug("Loading remote cell value for " + this.fullName());

  this.api(function (err, api) {
    if(err) return callback(err);

    debug("api.cells.get " + self.remotePath());

    api.cells.get(self.remotePath(), function (err, json) {
      if(err) return callback(err);

      debug("Got cell " + self.fullName() + " from Pod");

      self.loadJson(json, callback);
    });
  });
};

Cell.prototype.loadJson = function (json, callback) {
  debug("Loading cell JSON for " + this.fullName());

  try {

    this.value(json.value);

  } catch(e) {
    return callback(e);
  }

  callback(null, this);
};
