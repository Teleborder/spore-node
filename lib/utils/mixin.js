module.exports = mixin;

function mixin(obj, plugin) {
  Object.keys(plugin.prototype).forEach(function (k) {
    if(!obj.constructor.prototype[k]) {
      obj.constructor.prototype[k] = plugin.prototype[k];
    }
  });

  plugin.call(obj);
}
