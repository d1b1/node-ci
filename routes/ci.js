var util     = require('./util');
var forever  = require('forever');
var _        = require('underscore');
var async    = require('async');
var fs       = require('fs');

exports.restartProcess = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to restart.'});
      res.redirect('/list');
      return;
    }

    forever.restart(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Restarting and existing process.'});
    res.redirect('/list');
  });

}

exports.sites = function(req, res) {

  var dir = GLOBAL.root +  '/tmp';
  
  console.log(dir);
  fs.readdir(dir, function (err, list) {

    var data = [];

    list.forEach(function (file) {

      path = dir + "/" + file;

      fs.stat(path, function (err, stat) {
        if (stat && stat.isDirectory()) {
          data.push({ data: stat, path: path, dir: file });
        }
      });

    });

    res.render('sites', { data: list})
  });

}

exports.startDialog = function(req, res) {

  res.render('build_commit', { id: req.params.sha } );

}

exports.startProcess = function(req, res) {

  var sha                   = req.body.sha;
  var reference_name        = req.body.reference_name || 'Manual Build ' + sha;
  var reference_description = req.body.reference_description || '';
  var environment           = req.body.environment || 'development';
  var max_attempts          = req.body.max_attempts || 5;

  util.getPort(function(err, availablePort) {

    if (err && !availablePort) { 
      if (!availablePort) GLOBAL.messages.push({ type: 'warning', copy: 'No Ports Available to start build.' });
      if (err) GLOBAL.messages.push({ type: 'error', copy: err.message });
      
      return res.redirect('/list');
    }

    var localAppFolder = GLOBAL.root + '/tmp/' + sha;
    var options = { 
      max:       max_attempts, 
      logFile:   GLOBAL.root + '/node-ci.log',
      errFile:   GLOBAL.root + '/node-ci.log',
      outFile:   GLOBAL.root + '/node-ci.log',
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
      ui_owner:       req.session.user.github.name
    };

    console.log('Starting Process with ', options);

    var exec = require('child_process').exec;
    function puts(error, stdout, stderr) { 
      GLOBAL.messages.push({ type: 'info', copy: 'CD to ' + localAppFolder });
      GLOBAL.messages.push({ type: 'info', copy: 'Completed NPM Install for ' + sha });
      GLOBAL.messages.push({ type: 'info', copy: 'Starting site process for ' + sha });

      var childProcess = forever.startDaemon('server.js', options);
      forever.startServer(childProcess);

      GLOBAL.messages.push({ type: 'info', copy: 'Starting a site on port ' + availablePort + ' for SHA ' + sha })
    }

    exec('cd ' + localAppFolder + ';npm install', puts);

    GLOBAL.messages.push({ type: 'info', copy: 'Starting NPM install and build process. ' + availablePort + ' for SHA ' + sha });
    GLOBAL.messages.push({ type: 'info', copy: 'Site will not show until complete. Fresh a few times...' })

    res.redirect('/list');
  });

}

exports.stopProcess = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to stop.'});
      res.redirect('/list');
      return;
    }

    if (!processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process using UID, attempting Index.'});
      processIndex = parseInt(req.params.index);
    }

    forever.stop(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Stopping the build process.'});
    res.redirect('/list');
  });

}

exports.cleanupProcesses = function(req, res) {

  forever.cleanUp();

  GLOBAL.messages.push({ type: 'info', copy: 'Running the forever cleanup processes.'});

  res.redirect('/list');

}

exports.buildCommitSlug = function(req, res) {

  var sha = req.params.sha;

  var exec = require('child_process').exec;

  function puts(error, stdout, stderr) { 
    console.log('Completed the commit setup.')

    GLOBAL.messages.push({ type: 'info', copy: 'Building... Might take a bit.' });
    res.redirect('/list');
  }

  var pdir = GLOBAL.root + '/tmp/' + sha.substring(0,10);

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

  forever.list(false, function (err, data) {

    if (err || !data) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the existing processes..'});
      res.redirect('/list');
      return;
    }
    
    // Loop and ensure we have config data for all processes.
    _.each(data, function(o) {
      o.ui_port = o.ui_port || 'NA';
      o.ui_name = o.ui_name || 'NA';
      o.ui_description = o.ui_description || '';
      o.ui_owner = o.ui_owner || 'NA';
      o.ui_sha   = o.ui_sha || 'NA';
    });

    res.render('list', { data: data, messages: GLOBAL.messages } );

    // Clear out the messages queue.
    GLOBAL.messages = [];
  });

}

exports.tailProcessLog = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the requested process.'});
      res.redirect('/list');
      return;
    }

    forever.tail(processIndex, function (err, data) {

      if (err || !data) {
        GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch tail information the requested process.'});
        res.redirect('/list');
        return;
      }

      res.render('tail', { data: data } );
    })

  });

}

exports.processDetail = function(req, res) {
  
  var uid = req.params.id;

  util.getProcessByID(uid, function(err, process) {

    if (err || !process) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the requested process.'});
      res.redirect('/list');
      return;
    }

    res.render('detail', { data: process } );
  });

}

exports.catchCommitPayload = function(req, res) {

  var pl      = JSON.parse(req.body.payload);
  var exec    = require('child_process').exec;
  var execstr = "/var/www/composer/manager/getCommitCode.sh <<MARK "+pl.before+"\ "+pl.after+"\ "+pl.ref+"\ MARK";

  function puts(error, stdout, stderr) { sys.puts(stdout) }
  exec(execstr, puts);

}