"use strict";

module.exports = exports = unpublish;

exports.usage = 'Unpublishes pre-built binary (requires qn)';

var fs = require('fs');
var versioning = require('./util/versioning.js');
var qn = require('./util/qn');
var url = require('url');
var config = require('rc')("node_pre_gyp",{acl:"public-read"});

function unpublish(gyp, argv, callback) {
  var package_json = JSON.parse(fs.readFileSync('./package.json'));
  var opts = versioning.evaluate(package_json, gyp.opts);
  var uri = url.parse(opts.hosted_path);
  config.prefix = (!uri.pathname || uri.pathname == '/') ? '' : uri.pathname.replace('/','');
  var key_name = url.resolve(config.prefix, opts.package_name);
  var client = qn(config, package_json);
  var remote_package = url.resolve(package_json.binary.host, key_name);

  client.stat(key_name, function (err, stat) {
    if (!stat || !stat.fsize) {
      console.log('[%s] Not found: %s', package_json.name, remote_package);
      return callback();
    }
    if (err) {
      return callback(err);
    }
    client.delete(key_name, function (err) {
      if (err) {
        err.message += ', key: ' + key_name;
        return callback(err);
      }
      console.log('[%s] Success: removed %s', package_json.name, remote_package);
      return callback();
    });
  });
}
