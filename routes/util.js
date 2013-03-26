var forever  = require('forever');
var _        = require('underscore');
var fs       = require('fs');
var githubAPI  = require('github');
var db         = require('../db');
var mongodb    = require('mongodb');
var moment     = require('moment');
var async      = require('async');
var path       = require('path');

exports.setupBuild = setupBuild = function(opts, cb) {

  async.parallel({
    domain: function(callback) {

      // See if we can find a domain by either a defined Domain_Id or by the Sha/Branch.
      getDomain(opts.domain || opts.sha, function(err, result) {
        if (err) return callback(err, null);
        callback(null, result);
      });

    },
    availablePort: function(callback) {

      // Get the next available port.
      getPort(function(err, availablePort) {
        callback(null, availablePort);
      });

    }
  }, function(err, results) {

    var availablePort, availableURL;

    if (results.domain) {
      // Build the Port and URL form the domain.
      availablePort = results.domain.port;
      availableURL  = 'http://' + results.domain.url;

      if (results.domain.use_port) availableURL += ':' + results.domain.port;
    } else {
      // Use the next available port number.
      availablePort = results.availablePort;
      availableURL  = 'http://' + availablePort + '.' + GLOBAL.config.domain;
    }

    if (err && !availablePort) { 
      if (!availablePort) GLOBAL.messages.push({ type: 'warning', copy: 'No Ports Available to start build.' });
      if (err) GLOBAL.messages.push({ type: 'error', copy: err.message });
      
      return cb(err, null);
    }

    if (!opts.sourceDir) opts.sourceDir = GLOBAL.root + '/tmp/' + opts.sha;

    var path = require('path');

    var d = path.resolve( GLOBAL.root, 'logs');

    var logfile = path.resolve( GLOBAL.root, 'logs' ) + '/proc_' + opts.sha + '.log';
    var errfile = path.resolve( GLOBAL.root, 'logs' ) + '/proc_' + opts.sha + '_err.log';
    var outfile = path.resolve( GLOBAL.root, 'logs' ) + '/proc_' + opts.sha + '_out.log';

    var env = { PORT: parseInt(availablePort) }

    if (opts.configuration) {

      _.each(opts.configuration, function(o,i) {
        if (o.name && o.value) {
          env[o.name] = o.value;
        } else {
          console.log('Configuration has missing name/value fields.')
        }
      });
      
    }

    // Setup the Forever Process Options.
    var options = { 
      max:       opts.max || 100, 
      logFile:   logfile,
      errFile:   errfile,
      outFile:   outfile,
      append:    true,
      checkFile: false,
      fork:      true,
      sourceDir: opts.sourceDir, 
      env:       env,

      // User defined Values.
      ui_name:        opts.name,
      ui_sha:         opts.sha,
      ui_port:        availablePort,
      ui_description: opts.description,
      ui_owner:       opts.owner,
      ui_url:         availableURL,
      ui_type:        opts.type
    };

    var exec = require('child_process').exec;
    var pdir = opts.sourceDir;
    var command = '';

    var path = require('path');
    if (path.existsSync(pdir)) { 
      console.log('Already have a valid Build. Skipping Git steps.');

      // command = 'cd ' + pdir + ';' +
      //           'git fetch origin;' +
      //           'git reset --hard HEAD' + 
      //           'npm install;';

      // var cmd = 'cd ' + pdir + ';' + 
      //           'git fetch origin;' +
      //           'git rebase origin/' + sha + ';' +
      //           'npm install;'

      command = 'cd ' + pdir + ';npm install;';
    } else {
      console.log('No slug found, so build it now.');

      command = 'rm -Rf ' + pdir + '; ' +
                'git clone ' + GLOBAL.config.repository.path + ' ' + pdir + '; ' + 
                'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + opts.sha + '; ' +
                'cd ' + pdir + ';' +
                'npm install;';
    }

    util.logNow({ owner: opts.owner, name: 'Starting a Build Process', message: 'User requested a build process. ' + JSON.stringify(options) });

    GLOBAL.messages.push({ type: 'info', copy: 'Buidling an install from a commit.' });
    GLOBAL.messages.push({ type: 'info', copy: command });

    // This process does the actual startup process for the new site.
    var NowStartProcess = function (error, stdout, stderr) { 

      console.log('Step 2: Reached the Build Process.');

      GLOBAL.messages.push({ type: 'info', copy: 'CD to ' + opts.sourceDir });
      GLOBAL.messages.push({ type: 'info', copy: 'Completed NPM Install for ' + opts.sha });
      GLOBAL.messages.push({ type: 'info', copy: 'Starting site process for ' + opts.sha });

      var child = forever.startDaemon('server.js', options);

      // var child = new (forever.Monitor)('server.js', options);
      // var childProcess = forever.startDaemon('server.js', options);
      // child.start();

      forever.startServer(child);

      // childProcess

      util.logNow({ owner: opts.owner, name: 'Restarted new build process', message: "Completed the build process for '" + opts.name + "'" });

      GLOBAL.messages.push({ type: 'info', copy: 'Starting a site on port ' + availablePort + ' for SHA ' + opts.sha })

      cb(err, child)
    }

    // Star the Actual Process Now.
    exec(command, NowStartProcess);

  });

}

// This function will attempt to find restart, with a update a current process.
//
// sha - Branch or Commit Number
// processUID - UID of an existing process.
// cb (callback) - function().

exports.restartBuild = restartBuild = function(sha, cb) {

  // command = 'cd ' + pdir + ';' +
  //           'git fetch origin;' +
  //           'git reset --hard HEAD' + 
  //           'npm install;';

  // var cmd = 'cd ' + pdir + ';' + 
  //           'git fetch origin;' +
  //           'git rebase origin/' + sha + ';' +
  //           'npm install;'

  console.log('in the restartBuild() function');

  var sys = require('sys');
  var exec = require('child_process').exec;

  var pdir = GLOBAL.root + '/tmp/' + sha;
  var cmd = 'cd ' + pdir + ';' + 
            'git fetch origin;' +
            'git rebase origin/' + sha + ';' +
            'npm install;'

  function puts(error, stdout, stderr) { 

    sys.puts(stdout);

    // Get the current process index.
    getProcessIndexbySHA(sha, function(err, currentProcessIdx) {

      console.log('currentProcessIdx', currentProcessIdx)
      // TODO Handle the err state. If it exists or no process is found.

      forever.restart( currentProcessIdx );

      cb(null, currentProcessIdx);
    });
  }

  exec(cmd, puts);
}

exports.getHeadCommit = getHeadCommit = function(src, cb) {

  var exec = require('child_process').exec;
  var cmd = 'cd ' + src.sourceDir + ';' + 
            'git log -1;';

  var put = function (error, stdout, stderr) {

    if (error) return cb(null, src);

    // Parse the current head commit.
    var c = stdout.split('\n');
    var a = c[1].split(':')[1];
    var d = c[2];
    var name = a.split(' <')[0];
    
    try {
      var commit = {
        commit: c[0].split(' ')[1].trim(),
        author: {
          name: a.split(' <')[0],
          full: c[1].split(':')[1].trim()
        },
        message: c[4].trim(),
        date: d.split('Date:')[1].trim(),
        raw: stdout
      };

    } catch(err) {
      var commit = {
        commit: 'NA',
        author: { name: 'NA', full:'NA' },
        message: 'NA',
        date: 'NA',
        raw: stdout
      }
    }
    src.info = commit;

    cb(null, src)
  }

  // Star the Actual Process Now.
  exec(cmd, put);
}

exports.logNow = logNow = function(data, cb) {

  if (typeof data == 'string') data = { name: data }
  if (!data.owner)     data.owner = 'CI';
  if (!data.timestamp) data.timestamp = moment().format('MM/DD/YYYY HH:mm:ss');
  if (!data.type)      data.type = 'notice';
  if (!data.message)   data.message = '';

  var collection = new mongodb.Collection(DbManager.getDb(), 'logs');
  collection.insert(data, { safe: true }, function(err, result) {
    if (err) return;

    if (cb) cb(null, results);
  });

}
exports.getBranches =  function(session, cb) {

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: session.user.access_token });

  var opt = {
    repo:   GLOBAL.config.repository.repo,
    user:   GLOBAL.config.repository.user,
  };

  github.repos.getBranches(opt, function(err, data) {
    if (err) return cb(err, null);
    cb(null, data);
  });
  
}

exports.getSites = function(cb) {

  forever.list(false, function (err, data) {

    if (err) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the existing processes..'});
      return cb(err, null)
    }

    if (!data) return cb(null, null);

    // Loop and ensure we have config data for all processes.
    _.each(data, function(o) {
      o.ui_port = o.ui_port || 'NA';
      o.ui_name = o.ui_name || 'NA';
      o.ui_description = o.ui_description || '';
      o.ui_owner = o.ui_owner || 'NA';
      o.ui_sha   = o.ui_sha || 'NA';
      o.ui_url   = o.ui_url || '';
      o.ui_type  = o.ui_type || '';
    });

    async.map(data, getHeadCommit, function(err, results) {
      cb(null, results);
    });

  });

}

exports.getBuilds = function(cb) {

 var dir = GLOBAL.root +  '/tmp';

 forever.list(false, function (err, processes) {

    fs.readdir(dir, function (err, list) {

      var builds = [];
      _.each(list, function(o){
        var proc = _.filter(processes, function(i) { if (i.ui_sha) return i.ui_sha == o; });

        var d = { 
          commit: o, 
          process: proc.length == 1 ? proc[0] : undefined
        };

        builds.push(d);
      });

      cb(null, builds);
    });

  });

}

exports.getProcessbyTypeAndID = getProcessbyTypeAndID = function(type, id, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var results = _.filter(data, function(o) {
      console.log(o.ui_type, o.ui_sha, '=?', type, id)
      return o.ui_type == type && o.ui_sha == id;
    });
  
    if (results.length == 1) {
      cb(null, results[0]);
    } else {
      cb(null, null);
    }

  })

}

exports.getProcessIndexbyID = getProcessIndexbyID = function(uid, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var UIDs = [];
    _.each(data, function(o) { UIDs.push(o.uid); });
    var indexNum = _.indexOf(UIDs, uid);
    if (indexNum == -1) indexNum = null;

    cb(null, indexNum);
  })

}

exports.getProcessIndexbySHA = getProcessIndexbySHA = function(sha, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var UIDs = [];
    _.each(data, function(o) { UIDs.push(o.ui_sha || 222); });
    var indexNum = _.indexOf(UIDs, sha);
    //if (indexNum == -1) indexNum = null;

    cb(null, indexNum);
  })

}

exports.getProcessByID = function(uid, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var element = _.find(data, function(o) { return o.uid == uid;});
    cb(null, element);
  })

}

exports.getUsedPorts = function(cb) {

 forever.list(false, function (err, data) {
    if (err) return cb(err, null);

    var ports = [];
    _.each(data, function(o) {
      if (o.ui_port && typeof o.ui_port != undefined) ports.push( parseInt(o.ui_port));
    });

    cb(null, ports);
  })

}

exports.getPort = getPort = function(cb) {
 
  forever.list(false, function (err, data) {
    if (err) return cb(err, null);

    var ports = [];
    _.each(data, function(o) {
      if (o.ui_port && typeof o.ui_port != undefined) ports.push( parseInt(o.ui_port));
    });

    for (var i=3010; i<3020;i++) { 
      if (_.indexOf(ports, i) == -1) return cb(null, i);
    }

    cb(null, null);
  });

}

exports.getDomain = getDomain = function(id, cb) {
 
  var collection = new mongodb.Collection(DbManager.getDb(), 'domains');

  // TODO: Validate that we have a read domain. 
  // 1. Must be an object.
  // 2. Must have a valid set of key values.
  
  async.series({
    getbyID: function(callback) {

      try {
        var query = { _id: new mongodb.ObjectID( id.toString() ) };
        collection.findOne(query, function(err, result) {
          if (err) return callback(null, null);
          callback(null, result);
        });
      } catch(err) {
        callback(null, null);
      }

    },
    getbyName: function(callback) {

      try {
        var query = { name: id };
        collection.findOne(query, function(err, result) {
          if (err) return callback(null, null);
          if (!result) return callback(null, null);
          callback(null, result);
        });
      } catch(err) {
        callback(null, null);
      }

    }
  }, function(err, results) {

    if (results.getbyID) { 
      console.log('Found domain by ID');
      return cb(null, results.getbyID);
    }

    if (results.getbyName) {
      console.log('Found domain by Name');
      return cb(null, results.getbyName); 
    }

    cb(null, null);
  });

}

exports.getConfiguration = getConfiguration = function(id, cb) {

  var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
  async.series({
    getbyID: function(callback) {

      try {
        var query = { _id: new mongodb.ObjectID(id) };
        collection.findOne(query, function(err, result) {
          if (err) return callback(null, null);
          if (!result.configurations) result.configurations = [];
          callback(null, result);
        });
      } catch(err) {
        callback(null, null);
      }

    },
    getbyName: function(callback) {

      try {
        var query = { name: id.toLowerCase() };
        collection.findOne(query, function(err, result) {
          if (err) return callback(null, null);
          if (!result) return callback(null, null);
          if (!result.configurations) result.configurations = [];
          callback(null, result);
        });
      } catch(err) {
        callback(null, null);
      }

    },
    getDefault: function(callback) {

      try {
        var query = { default: true };
        collection.findOne(query, function(err, result) {
          if (err) return callback(null, null);
          if (!result) return callback(null, null);
          if (!result.configurations) result.configurations = [];
          callback(null, result);
        });
      } catch(err) {
        callback(null, null);
      }

    }
  }, function(err, results) {

    if (results.getbyID) { 
      console.log('Found configuration by ID');
      return cb(null, results.getbyID);
    }

    if (results.getbyName) {
      console.log('Found configuration by Name');
      return cb(null, results.getbyName); 
    }

    if (results.getDefault) {
      console.log('Found configuration by Default');
      return cb(null, results.getDefault);
    }

    cb(null, null);
  });

}
