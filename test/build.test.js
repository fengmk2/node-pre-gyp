"use strict";

var assert = require('assert');
var cp = require('child_process');
var path = require('path');
var existsSync = require('fs').existsSync || require('path').existsSync;
var abi_crosswalk = require('../lib/util/abi_crosswalk.json');
var os = require('os');
var fs = require('fs');

var cmd_path = path.join(__dirname,'../bin/');
var sep = ':';
if (process.platform === 'win32') {
    sep = ';';
}
process.env.PATH = cmd_path + sep + process.env.PATH;
process.env.NODE_PATH = path.join(__dirname,'../lib/');

function run(command,app,opts,cb) {
    if (!opts.cwd) {
        command += ' -C ' + path.join(__dirname,app.name);
    }
    if (process.platform === 'win32') {
        command += ' --msvs_version=2013 ';
    }
    command += ' ' + app.args;
    cp.exec(command,opts, cb);
}

var apps = [
    {
        'name': 'app1',
        'args': ''
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include'
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include --debug'
    },
    {
        'name': 'app2',
        'args': '--custom_include_path=../include --toolset=cpp11'
    },
    {
        'name': 'app3',
        'args': ''
    },
    {
        'name': 'app4',
        'args': ''
    }
];


function getPreviousVersion(current_version) {
    var current_parts = current_version.split('.').map(function(i) { return +i; });
    var major = current_parts[0];
    var minor = current_parts[1];
    var patch = current_parts[2];
    while (patch > 0) {
        --patch;
        var new_target = '' + major + '.' + minor + '.' + patch;
        if (new_target == current_version) {
            break;
        }
        if (abi_crosswalk[new_target]) {
            return new_target;
        }
    }
    // failed to find suitable future version that we expect is ABI compatible
    return undefined;
}

function on_error(err,stdout,stderr) {
    var msg = err.message;
    msg += '\nstdout: ' + stdout;
    msg += '\nstderr: ' + stderr;
    throw new Error(msg);
}

describe('build', function() {
    var current_version = process.version.replace('v','');
    var previous_version = getPreviousVersion(current_version);
    var target_abi;
    var testing_crosswalk;
    if (previous_version !== undefined && previous_version !== current_version) {
        target_abi = {};
        target_abi[previous_version] = abi_crosswalk[previous_version];
        testing_crosswalk = path.join(os.tmpdir(),'fake_abi_crosswalk.json');
        fs.writeFileSync(testing_crosswalk,JSON.stringify(target_abi));
    }

    apps.forEach(function(app) {

        it(app.name + ' builds ' + app.args, function(done) {
            run('node-pre-gyp rebuild --fallback-to-build --loglevel=silent', app, {}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                assert.ok(stdout.search(app.name+'.node') > -1);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                done();
            });
        });

        it(app.name + ' passes --nodedir down to node-gyp ' + app.args, function(done) {
            run('node-pre-gyp rebuild --fallback-to-build --nodedir=invalid-value', app, {}, function(err,stdout,stderr) {
                assert.ok(err);
                assert.ok(stdout.search(app.name+'.node') > -1);
                assert.ok(stderr.indexOf('common.gypi not found' > -1));
                done();
            });
        });

        if (target_abi) {
            var new_env = JSON.parse(JSON.stringify(process.env));
            new_env.NODE_PRE_GYP_ABI_CROSSWALK = testing_crosswalk;
            var opts = { env : new_env };
            it(app.name + ' builds with custom --target='+previous_version+' that is greater than known version in ABI crosswalk ' + app.args, function(done) {
                run('node-pre-gyp rebuild --fallback-to-build --target='+previous_version, app, opts, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    assert.ok(stdout.search(app.name+'.node') > -1);
                    // no stderr checking here since downloading a new version will bring in various expected stderr from node-gyp
                    done();
                });
            });

            it(app.name + ' cleans up after installing custom --target='+previous_version+' that is greater than known in ABI crosswalk ' + app.args, function(done) {
                run('node-pre-gyp clean --target='+previous_version, app, opts, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

        } else {
            it.skip(app.name + ' builds with custom --target that is greater than known in ABI crosswalk ' + app.args, function() {});
            it.skip(app.name + ' builds with custom --target='+previous_version+' that is greater than known in ABI crosswalk ' + app.args, function() {});
        }

        // note: the above test will result in a non-runnable binary, so the below test must succeed otherwise all future test will fail

        it(app.name + ' builds with custom --target ' + app.args, function(done) {
            run('node-pre-gyp rebuild --fallback-to-build --target='+process.versions.node, app, {}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                assert.ok(stdout.search(app.name+'.node') > -1);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                done();
            });
        });

        it(app.name + ' is found ' + app.args, function(done) {
            run('node-pre-gyp reveal module_path --silent', app, {}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                var module_path = stdout.trim();
                assert.ok(module_path.search(app.name) > -1);
                assert.ok(existsSync(module_path));
                var module_binary = path.join(module_path,app.name+'.node');
                assert.ok(existsSync(module_binary));
                done();
            });
        });

        it(app.name + ' passes tests ' + app.args, function(done) {
            run('npm test', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                assert.notEqual(stdout,'');
                done();
            });
        });

        it(app.name + ' packages ' + app.args, function(done) {
            run('node-pre-gyp package', app, {}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                done();
            });
        });

        it(app.name + ' package is valid ' + app.args, function(done) {
            run('node-pre-gyp testpackage', app, {}, function(err,stdout,stderr) {
                if (err) return on_error(err,stdout,stderr);
                if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                    assert.equal(stderr,'');
                }
                done();
            });
        });

        if (process.env.AWS_ACCESS_KEY_ID || process.env.node_pre_gyp_accessKeyId) {

            it(app.name + ' publishes ' + app.args, function(done) {
                run('node-pre-gyp unpublish publish', app, {}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

            it(app.name + ' info shows it ' + app.args, function(done) {
                run('node-pre-gyp reveal package_name --silent', app, {}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    assert.equal(stderr,'');
                    assert.notEqual(stdout,'');
                    var package_name = stdout.trim();
                    run('node-pre-gyp info', app, {}, function(err,stdout,stderr) {
                        if (err) return on_error(err,stdout,stderr);
                        if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                            assert.equal(stderr,'');
                        }
                        assert.ok(stdout.indexOf(package_name) > -1);
                        done();
                    });
                });
            });

            it(app.name + ' can be uninstalled ' + app.args, function(done) {
                run('node-pre-gyp clean', app, {}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

            it(app.name + ' can be installed via remote ' + app.args, function(done) {
                run('npm install --fallback-to-build=false --silent', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

            it(app.name + ' can be reinstalled via remote ' + app.args, function(done) {
                run('npm install --update-binary --fallback-to-build=false --silent', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

            it(app.name + ' via remote passes tests ' + app.args, function(done) {
                run('npm test', app, {cwd: path.join(__dirname,app.name)}, function(err,stdout,stderr) {
                    if (err) return on_error(err,stdout,stderr);
                    if (stderr.indexOf("child_process: customFds option is deprecated, use stdio instead") == -1) {
                        assert.equal(stderr,'');
                    }
                    assert.notEqual(stdout,'');
                    done();
                });
            });

        } else {
            it.skip(app.name + ' publishes ' + app.args, function() {});
        }

    });
});
