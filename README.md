spore-node
==========

This is the module for interacting with [Spore](https://spore.sh) for Node.js.
See the [Spore Website](https://spore.sh) for full documentation and information.

Installation
------------

```
$ npm install --save spore-node
```

or:

```
$ npm install --save git://git@github.com:spore-sh/spore-node.git
```

Usage
-----

### Synchronous

To load enviornment variables, put the following at the top of
your main javascript file:

```
require('spore-node').loadEnvSync();
```

Environment variables will then be available on the familiar `process.env` object.

With no arguments, `loadEnvSync` will load the default environment (on your local machine,
this is likely `development`, when using a `SPORE_DEPLOYMENT` it will default to that
deployment's environment). To load a specific environment, pass it as an argument to `loadEnvSync`:

```
require('spore-node').loadEnvSync('staging');
```

By default, environment variables set in the environment take precendence over those set in Spore.
To have Spore override the environment, use a second argument with the value `true`:

```
require('spore-node').loadEnvSync('staging', true);
```

### Asynchronous

You can also load the environment asynchronously, with a callback that gets called when it's done loading:

```
require('spore-node').loadEnv(function () {
  // variables will be loaded now
});
```

The `loadEnv` method has the same signature as the synchronous version for overriding the environment and
loading a particular environment.


Configuration
-------------

Spore has some configuration stored locally on your machine in a file called `config.json`, by default in `~/.spore`.
You can adjust the location of Spore's home directory by setting the `SPORE_HOME` environment variable.

The default values for `config.json` are [located here](lib/spore/config/default.json).

You can change any of your configuration by changing it in your local `config.json` file.

Notes
-----

### `APP_ENV`

All Spore implementations are supposed to translate the more general `APP_ENV` environment variable into a framework
or language specific equivalent. This module translates `APP_ENV` to `NODE_ENV` based on the popularity of Express.js,
the framework that popularized its usage.

Contributing
------------
1. Fork
2. Branch
3. Write Code (& Tests)
4. Submit a Pull Request

