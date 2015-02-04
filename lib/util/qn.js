/**!
 * node-pre-gyp - lib/util/qn.js
 *
 * Copyright(c) fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <m@fengmk2.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

module.exports = function (config, package_json) {
  var qn = require('qn');

  return qn.create({
    accessKey: config.qn_accessKeyId,
    secretKey: config.qn_secretAccessKey,
    bucket: config.qn_bucket || package_json.binary.bucket,
    domain: package_json.binary.host,
    // timeout: 3600000, // default rpc timeout: one hour, optional
    // if your app outside of China, please set `uploadURL` to `http://up.qiniug.com/`
    uploadURL: config.qn_uploadUrl || 'http://up.qiniu.com/',
  });
};
