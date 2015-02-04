"use strict";

module.exports = exports = unpublish;

exports.usage = 'Lists all published binaries (requires qn)';

var url = require('url');
var fs = require('fs');
var log = require('npmlog');
var qn = require('./util/qn');
var versioning = require('./util/versioning');
var config = require('rc')("node_pre_gyp",{acl:"public-read"});

function unpublish(gyp, argv, callback) {
  var package_json = JSON.parse(fs.readFileSync('./package.json'));
  var opts = versioning.evaluate(package_json, gyp.opts);
  var uri = url.parse(opts.hosted_path);
  config.prefix = (!uri.pathname || uri.pathname == '/') ? '' : uri.pathname.replace('/','');

  var client = qn(config, package_json);
  var prefixUrl = package_json.binary.host + '/' + config.prefix;
  client.list(config.prefix, function (err, meta) {
    if (err && err.code == 'NotFound') {
      return callback(new Error('[' + package_json.name + '] Not found: ' + prefixUrl));
    } else if (err) {
      return callback(err);
    }

    log.verbose(JSON.stringify(meta, null, 2));
    if (meta && meta.items) {
      console.log('Found %s objects on %s', package_json.name, prefixUrl);
      meta.items.forEach(function (obj) {
        console.log(' - %s', obj.key);
      });
    } else {
      console.error('[%s] No objects found at %s', package_json.name, prefixUrl);
    }
    return callback();
  });
}
