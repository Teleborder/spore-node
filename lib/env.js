var debug = require('debug')('spore'),
    async = require('async'),
    merge = require('merge'),
    slug = require('slug'),
    Cell = require('./cell');

module.exports = Env;

function Env(app, name, ids) {
  var self = this;
  this.app = app;
  this.name = slug(name);
  this.cells = [];

  Object.keys(ids || {}).forEach(function (key) {
    self.cells.push(new self.constructor.Cell(self, key, ids[key]));
  });

  debug(name + " environment initialized");
}

Env.Cell = Cell;

Env.prototype.api = function () {
  return this.app.api.apply(this.app, [].slice.call(arguments));
};

Env.prototype.isDeployment = function () {
  return this.app.isDeployment.apply(this.app, [].slice.call(arguments));
};

Env.prototype.remotePath = function () {
  return this.app.remotePath() + '/' + this.name;
};

Env.prototype.fullName = function () {
  return this.app.fullName() + '/' + this.name;
};

Env.prototype.newCell = function (key, id) {
  var cell = new this.constructor.Cell(this, key, id);
  this.cells.push(cell);
  return cell;
};

Env.prototype.findCellByKey = function (key) {
  for(var i=0; i<this.cells.length; i++) {
    if(this.cells[i].key === key) return this.cells[i];
  }

  return this.newCell(key);
};

Env.prototype.get = function (key, callback) {
  debug("Getting " + key + " for " + this.fullName());

  var cell = this.findCellByKey(key);

  return cell.getValue(callback);
};

Env.prototype.getAll = function (callback) {
  debug("Getting all values for " + this.fullName());

  if(!this.cells.length) {
    debug("No cells found for " + this.fullName());

    process.nextTick(function () {
      callback(null, {});
    });
    return;
  }

  debug("Loading " + this.cells.length + " for " + this.fullName());

  async.mapLimit(this.cells, 100, function (cell, next) {
    cell.getKv(next);
  }, function (err, vals) {
    if(err) return callback(err);

    callback(null, merge.apply(null, vals));
  });
};

