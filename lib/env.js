var debug = require('debug')('spore'),
    slug = require('slug'),
    mixin = require('./utils/mixin'),
    Cell = require('./cell'),
    GetSet = require('./env/get_set');

module.exports = Env;

function Env(app, name, ids) {
  mixin(this, GetSet);

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
