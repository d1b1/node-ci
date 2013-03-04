var util     = require('./util');
var forever  = require('forever');
var _        = require('underscore');
var async    = require('async');
var fs       = require('fs');

exports.listConfigurations = function(req, res) {

  var configuration = {};
  require("fs").readdirSync( GLOBAL.root + "/load").forEach(function(file) {
    var data = require( GLOBAL.root + "/load/" + file);
    configuration[data.name.toLowerCase()] = data;
  });

  GLOBAL.configurations = configuration;

  console.log(GLOBAL.configurations);
  res.render('configurations', { data: configuration });
}

exports.setupConfiguration = function(req, res) {

  var label = req.params.label;

  var config = GLOBAL.configurations[label.toLowerCase()];

  util.getProcessbyTypeAndID(config.type, config.sha, function(err, data) {

    if (data) {
      res.redirect('/head/list');
      return;

    } else {

      util.getPort(function(err, availablePort) {

        if (err && !availablePort) { 
          if (!availablePort) GLOBAL.messages.push({ type: 'warning', copy: 'No Ports Available to start build.' });
          if (err) GLOBAL.messages.push({ type: 'error', copy: err.message });
          return res.redirect('/head/list');
        }

        var sha = config.sha;

        var localAppFolder = GLOBAL.root + '/tmp/' + config.sha;
        var options = { 
          max:       10, 
          logFile:   GLOBAL.root + '/../node-ci.log',
          errFile:   GLOBAL.root + '/../node-ci.log',
          outFile:   GLOBAL.root + '/../node-ci.log',
          append:    true,
          checkFile: false,
          fork:      false,
          sourceDir: localAppFolder, 
          env:       { NODE_ENV: config.env.NODE_ENV, PORT: parseInt(config.env.PORT) },

          // User defined Values.
          ui_name:        config.name,
          ui_sha:         sha,
          ui_port:        config.env.PORT,
          ui_description: config.description,
          ui_owner:       req.session.user.github.name,
          ui_url:         'http://' + config.domain + ':' + config.env.PORT,
          ui_type:        'head'
        };

        var exec = require('child_process').exec;
        var pdir = GLOBAL.root + '/tmp/' + config.sha;

        console.log('Step 1: Started the git build.');
        var command = "";

        var path = require('path');
        if (path.existsSync(pdir)) { 
          console.log('Already have a valid Build. Skipping Git steps.');

          command = 'cd ' + pdir + ';npm install;';
        } else {
          console.log('No slug found, so build it now.');

          command = 'rm -Rf ' + pdir + '; ' +
                    'git clone ' + GLOBAL.config.repository.path + ' ' + pdir + '; ' + 
                    'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + sha + '; ' +
                    'cd ' + pdir + ';' +
                    'npm install;';
        }

        GLOBAL.messages.push({ type: 'info', copy: 'Buidling an install from a commit.' });
        GLOBAL.messages.push({ type: 'info', copy: command });

        // This process does the actual startup process for the new site.
        var NowStartProcess = function (error, stdout, stderr) { 

          console.log('Step 2: Reached the Build Process.');

          GLOBAL.messages.push({ type: 'info', copy: 'CD to ' + localAppFolder });
          GLOBAL.messages.push({ type: 'info', copy: 'Completed NPM Install for ' + sha });
          GLOBAL.messages.push({ type: 'info', copy: 'Starting site process for ' + sha });

          var childProcess = forever.startDaemon('server.js', options);
          forever.startServer(childProcess);

          GLOBAL.messages.push({ type: 'info', copy: 'Starting a site on port ' + availablePort + ' for SHA ' + sha })

          res.redirect('/');
        }

        // Star the Actual Process Now.
        exec(command, NowStartProcess);
      });
    }

  });

}

exports.restartProcess = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to restart.'});
      res.redirect('/');
      return;
    }

    forever.restart(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Restarting and existing process.'});
    res.redirect('/');
  });

}

exports.slugDelete = function(req, res) {

  var id = req.params.id;

  var exec = require('child_process').exec;

  var path = GLOBAL.root + '/tmp/' + id;
  var cmd = 'rm -Rf ' + path;

  var deleteConfirm = function (error, stdout, stderr) { 
    GLOBAL.messages.push({ type: 'error', copy: 'Deleted the slug at ' + path + ' with ' + cmd });
    res.redirect('/sites');
  }

  exec(cmd, deleteConfirm);

}

exports.sites = function(req, res) {


  util.getBuilds(function(err, data) {
    res.render('sites', { data: data})
  });

}

exports.startDialog = function(req, res) {

  var shaOrBranch = req.params.sha;

  var githubAPI  = require('github');
  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var options = {
    repo:   GLOBAL.config.repository.repo,
    user:   GLOBAL.config.repository.user
  };
 
  var process_type = req.urlparams.process_type || 'snapshot';

  github.repos.getBranches(options, function(err, data) {
    res.render('build_commit', { process_type: process_type, branches: data, id: shaOrBranch } );
  });

}

exports.startProcess = function(req, res) {

  var sha                   = req.body.sha;
  var reference_name        = req.body.reference_name || 'Manual Build ' + sha;
  var reference_description = req.body.reference_description || '';
  var environment           = req.body.environment || 'development';
  var max_attempts          = req.body.max_attempts || 5;
  var process_type          = req.body.process_type || 'snapshot';

  util.getPort(function(err, availablePort) {

    if (err && !availablePort) { 
      if (!availablePort) GLOBAL.messages.push({ type: 'warning', copy: 'No Ports Available to start build.' });
      if (err) GLOBAL.messages.push({ type: 'error', copy: err.message });
      
      return res.redirect('/');
    }

    var localAppFolder = GLOBAL.root + '/tmp/' + sha;
    var options = { 
      max:       max_attempts, 
      logFile:   GLOBAL.root + '/../node-ci.log',
      errFile:   GLOBAL.root + '/../node-ci.log',
      outFile:   GLOBAL.root + '/../node-ci.log',
      append:    true,
      checkFile: false,
      fork:      false,
      sourceDir: localAppFolder, 
      env:       { NODE_ENV: environment, PORT: parseInt(availablePort) },

      // User defined Values.
      ui_name:        reference_name,
      ui_sha:         sha,
      ui_port:        availablePort,
      ui_description: reference_description,
      ui_owner:       req.session.user.github.name,
      ui_url:         'http://' + availablePort + '.' + GLOBAL.config.domain,
      ui_type:        process_type
    };

    var exec = require('child_process').exec;
    var pdir = GLOBAL.root + '/tmp/' + sha;

    console.log('Step 1: Started the git build.');

    var command = "";

    var path = require('path');
    if (path.existsSync(pdir)) { 
      console.log('Already have a valid Build. Skipping Git steps.');

      command = 'cd ' + pdir + ';npm install;';
    } else {
      console.log('No slug found, so build it now.');

      command = 'rm -Rf ' + pdir + '; ' +
                'git clone ' + GLOBAL.config.repository.path + ' ' + pdir + '; ' + 
                'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + sha + '; ' +
                'cd ' + pdir + ';' +
                'npm install;';
    }

    GLOBAL.messages.push({ type: 'info', copy: 'Buidling an install from a commit.' });
    GLOBAL.messages.push({ type: 'info', copy: command });

    // This process does the actual startup process for the new site.
    var NowStartProcess = function (error, stdout, stderr) { 

      console.log('Step 2: Reached the Build Process.');

      GLOBAL.messages.push({ type: 'info', copy: 'CD to ' + localAppFolder });
      GLOBAL.messages.push({ type: 'info', copy: 'Completed NPM Install for ' + sha });
      GLOBAL.messages.push({ type: 'info', copy: 'Starting site process for ' + sha });

      var childProcess = forever.startDaemon('server.js', options);
      forever.startServer(childProcess);

      GLOBAL.messages.push({ type: 'info', copy: 'Starting a site on port ' + availablePort + ' for SHA ' + sha })

      res.redirect('/');
    }

    // Star the Actual Process Now.
    exec(command, NowStartProcess);
  });

}

exports.stopProcess = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to stop.'});
      res.redirect('/');
      return;
    }

    if (!processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process using UID, attempting Index.'});
      processIndex = parseInt(req.params.index);
    }

    forever.stop(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Stopping the build process.'});
    res.redirect('/');
  });

}

exports.cleanupProcesses = function(req, res) {

  forever.cleanUp();

  GLOBAL.messages.push({ type: 'info', copy: 'Running the forever cleanup processes.'});

  res.redirect('/');

}

exports.buildCommitSlug = function(req, res) {

  var sha = req.params.sha;

  var exec = require('child_process').exec;

  function puts(error, stdout, stderr) { 
    console.log('Completed the commit setup.')

    GLOBAL.messages.push({ type: 'info', copy: 'Building... Might take a bit.' });
    res.redirect('/');
  }

  var pdir = GLOBAL.root + '/tmp/' + sha;

  var command = 'rm -Rf ' + pdir + '; ' +
                'git clone git@github.com:npr/composer.git ' + pdir + '; ' + 
                'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + sha

  GLOBAL.messages.push({ type: 'info', copy: 'Buidling an install from a commit.' });
  GLOBAL.messages.push({ type: 'info', copy: 'Commit SHA: ' + sha });
  GLOBAL.messages.push({ type: 'info', copy: 'Build Path: ' + pdir });
  GLOBAL.messages.push({ type: 'info', copy: command });

  exec(command, puts);
  
}

exports.listProcesses = function(req, res) {

  async.parallel({
    builds: function(callback) {

      util.getBuilds(function(err, data) {
        callback(null, data);
      });

    },
    sites: function(callback) {

      util.getSites(function(err, data) {
        callback(null, data);
      });

    },
    activity: function(callback) {

      callback(null, []);

    },
    branches: function(callback) {

      if (!req.session.user) {
        callback(null, null)
      } else {
        util.getBranches(req.session, function(err, data) {
          callback(null, data);
        });
      }

    }
  }, function(err, data) {

    res.render('list', { branches: data.branches, activity: data.activity, sites: data.sites, builds: data.builds, messages: GLOBAL.messages } );
    GLOBAL.messages = [];
  });

}

exports.tailProcessLog = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the requested process.'});
      res.redirect('/');
      return;
    }

    forever.tail(processIndex, function (err, data) {

      if (err || !data) {
        GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch tail information the requested process.'});
        res.redirect('/');
        return;
      }

      res.render('tail', { data: data } );
    })

  });

}

/** 

 This function provides process details. It wrapps the the forever.list() function.
 It accepts an ID and finds the required process.
 
**/
exports.processDetail = function(req, res) {
  
  var uid = req.params.id;

  util.getProcessByID(uid, function(err, process) {

    if (err || !process) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the requested process.'});
      res.redirect('/');
      return;
    }

    res.render('detail', { data: process } );
  });

}


/**

  This function handles the github commit payloads 
  generated by the webhooks when a commit it reveived
  by github.

**/
exports.catchCommitPayload = function(req, res) {

  var sys = require('sys');
  
  var pl      = JSON.parse(req.body.payload);

  console.log(req.body.payload)
  console.log(pl);
  
  var exec    = require('child_process').exec;
  var execstr = GLOBAL.root + '/getCommitCode.sh <<MARK ' + pl.before + '\ ' + pl.after + '\ ' + pl.ref+  '\ MARK';

  function puts(error, stdout, stderr) { sys.puts(stdout) }
  exec(execstr, puts);

}

/**

  This function handles the github commit payloads 
  generated by the webhooks when a commit it reveived
  by github.

  This is a new version that will rebuild a given folder and 
  will restart the correct builds.

**/
exports.catchCommitPayloadv2 = function(req, res) {

  var sys = require('sys');
  
  var pl      = JSON.parse(req.body.payload);

  console.log(pl);

  res.send(pl);
  return;

  var exec    = require('child_process').exec;
  var execstr = GLOBAL.root + '/getCommitCode.sh <<MARK ' + pl.before + '\ ' + pl.after + '\ ' + pl.ref+  '\ MARK';

  function puts(error, stdout, stderr) { sys.puts(stdout) }
  exec(execstr, puts);

}