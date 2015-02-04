"use strict";

module.exports = exports = publish;

exports.usage = 'Publishes pre-built binary (requires qn)';

var fs = require('fs');
var path = require('path');
var log = require('npmlog');
var versioning = require('./util/versioning.js');
var qn = require('./util/qn');
var existsAsync = fs.exists || path.exists;
var url = require('url');
var config = require('rc')("node_pre_gyp",{acl:"public-read"});

function publish(gyp, argv, callback) {
  var package_json = JSON.parse(fs.readFileSync('./package.json'));
  var opts = versioning.evaluate(package_json, gyp.opts);
  var uri = url.parse(opts.hosted_path);
  config.prefix = (!uri.pathname || uri.pathname == '/') ? '' : uri.pathname.replace('/','');
  var tarball = opts.staged_tarball;

  existsAsync(tarball, function(found) {
    if (!found) {
      return callback(new Error("Cannot publish because " + tarball + " missing: run `node-pre-gyp package` first"));
    }
    log.info('publish', 'Detecting qn credentials');

    var client = qn(config, package_json);

    var key_name = url.resolve(config.prefix, opts.package_name);
    var remote_package = url.resolve(package_json.binary.host, key_name);
    log.info('publish', 'Checking for existing binary at ' + remote_package);
    client.stat(key_name, function (err, stat) {
      if (stat && stat.fsize) {
        log.error('publish','Cannot publish over existing version');
        log.error('publish',"Update the 'version' field in package.json and try again");
        log.error('publish','If the previous version was published in error see:');
        log.error('publish','\t node-pre-gyp unpublish');
        return callback(new Error('Failed publishing to ' + remote_package));
      }

      log.info('publish', 'Uploading %s to %s', tarball, remote_package);
      client.uploadFile(tarball, {key: key_name}, function (err, result) {
        if (err) {
           log.info('publish', 's3 putObject error: "' + err + '"');
           return callback(err);
        }
        log.info('publish', 'returned from putting object: ' + JSON.stringify(result));
        log.info('publish', 'successfully put object');
        console.log('[%s] published to %s', package_json.name, remote_package);
        return callback();
      });
    });
  });
}
