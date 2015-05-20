var Spore = require('./lib/spore');

Spore.spore = new Spore();
Spore.loadEnv = Spore.spore.loadEnv.bind(Spore.spore);

module.exports = Spore;
