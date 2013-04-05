var util     = require('./util');
var forever  = require('forever');
var _        = require('underscore');
var async    = require('async');
var fs       = require('fs');
var db       = require('../db');
var mongodb  = require('mongodb');

exports.restartProcess = function(req, res) {

  var uid = req.params.uid;

  util.getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to restart.'});
      res.redirect('/');
      return;
    }

    forever.restart(processIndex);

    util.logNow({ type: 'notce', owner: req.session.user.github.name, name: 'Manual restart of process ' + uid, message: "User used the UI to force a restart." });

    GLOBAL.messages.push({ type: 'info', copy: 'Restarting and existing process.'});
    res.redirect('/');
  });

}

exports.slugDelete = function(req, res) {

  var dir = req.urlparams.dir

  dir = dir.replace('HASH', '#');

  var exec = require('child_process').exec;

  var path = GLOBAL.root + '/tmp/' + dir;
  var cmd = 'rm -Rf ' + path;

  var deleteConfirm = function (error, stdout, stderr) { 
    GLOBAL.messages.push({ type: 'error', copy: 'Deleted the slug at ' + path + ' with ' + cmd });
    res.redirect('/sites');
  }

  exec(cmd, deleteConfirm);

}

exports.sites = function(req, res) {

  util.getBuilds(function(err, data) {
    res.render('sites', { data: data });
  });

}

exports.startDialog = function(req, res) {

  var id = req.params.id;

  var query = { _id: new mongodb.ObjectID(id) };
  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    buildPage(result);
  });

  var buildPage = function(repoData) {

    var shaOrBranch = req.params.sha;

    var githubAPI  = require('github');
    var github = new githubAPI({ version: '3.0.0' });
    github.authenticate({ type: 'oauth', token: req.session.user.access_token });

    var options = {
      repo:   repoData.repo,
      user:   repoData.user
    };
   
    var process_type = req.urlparams.process_type || 'snapshot';

    async.parallel({
       configurations: function(callback) {

        var query = {};
        var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
        collection.find(query).toArray(function(err, results) {
          if (err) return callback(err, null);
          callback(null, results);
        });

       },
       domains: function(callback) {

        var query = {};
        var collection = new mongodb.Collection(DbManager.getDb(), 'domains');
        collection.find(query).toArray(function(err, results) {
          if (err) return callback(err, null);
          callback(null, results);
        });

       },
       branches: function(callback) {

        github.repos.getBranches(options, function(err, data) {
          callback(null, data);
        });

       }
    }, function(err, results) {

      res.render('build_commit', { repo: repoData, process_type: process_type, domains: results.domains, configurations: results.configurations, branches: results.branches, id: shaOrBranch } );

    });
  }

}

exports.startProcess = function(req, res) {

  var id = req.body.id;

  var query = { _id: new mongodb.ObjectID(id) };
  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    buildPage(result);
  });

  var buildPage = function(repoData) {

    var sha                   = req.body.sha;
    var reference_name        = req.body.reference_name || 'Manual Build ' + sha;
    var reference_description = req.body.reference_description || '';
    var environment           = req.body.environment || 'development';
    var max_attempts          = req.body.max_attempts || 5;
    var process_type          = req.body.process_type || 'snapshot';
    var configuration_id      = req.body.configuration_id || null;
    var domain_id             = req.body.domain_id || null;

    var lookup = repoData.repo+'#'+sha;

    async.parallel({
      configuration: function(callback) {

        util.getConfiguration(configuration_id, function(err, result) {
          callback(null, result);
        });

      },
      currentProcessIdx: function(callback) {

        // Check if we have the process running.
        util.getProcessIndexbySHA(lookup, function(err, currentProcessIdx) {
          callback(null, currentProcessIdx);
        });

      }
    }, function(err, result) {

        if (result.currentProcessIdx == -1) {
           // No Love. Since we did not find what we needed. we need to build it.

           var options = {
             type:        process_type,
             sha:         lookup,
             name:        reference_name,
             description: reference_description,
             max:         max_attempts,
             environment: environment,
             owner:       req.session.user.github.name || 'CI',
             configuration: result.configuration.configurations || {},
             domain:      domain_id,
             repo:        repoData.url
           };

           util.logNow({ 
             type:    'manual', name:    'New ' + process_type.toUpperCase() + ' build', 
             message: req.session.user.github.name + ' has manually created a ' + process_type + ' build.' 
           });

           util.setupBuild(options, function(err, data) {
             res.redirect('/');
           });
        } else {
           // We have it, so restart it. Use the following to rebuild the git status and 

           util.logNow({ 
             type:    'manual', name:    'Refreshing a ' + process_type.toUpperCase() + ' build', 
             message: req.session.user.github.name + ' has manually requested to add/refresh a ' + process_type + ' build.' 
           });

           util.restartBuild(sha, function(err, data) {
             res.redirect('/');
           });
        }

    });
  }

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

    util.logNow({ owner: req.session.user.github.name, name: 'Stopping Process', message: 'Manual Action to stop a process, idx: ' + processIndex });

    forever.stop(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Stopping the build process.'});
    res.redirect('/');
  });

}

exports.cleanupProcesses = function(req, res) {

  forever.cleanUp();

  GLOBAL.messages.push({ type: 'info', copy: 'Running the forever cleanup processes.'});

  util.logNow({ name: 'Process Cleanup', message: 'User requested the Process Cleanup for forever tasks' });

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
                'git clone ' + GLOBAL.config.repository.repo + ' ' + pdir + '; ' + 
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

      var query = {};
      var options = { "sort": [['timestamp','desc']] };

      var collection = new mongodb.Collection(DbManager.getDb(), 'logs');
      collection.find(query, options).limit(5).toArray(function(err, data) {
        if (err || !data) {
          callback(null, 'No Episiodes found.');
          return
        }

        callback(null, data);
      });

    
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

    if (err || processIndex == -1) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the requested process.'});
      res.redirect('/');
      return;
    }

    forever.tail(processIndex, 20, function (err, data) {

      if (err || !data) {
        GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch tail information the requested process.'});
        res.redirect('/');
        return;
      }

      var data = data[0];
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

  This is a new version that will rebuild a given folder and 
  will restart the correct builds.

**/
exports.catchCommitPayloadv2 = function(req, res) {

  var load = JSON.parse(req.body.payload);
  var sha  = load.ref.replace('refs/heads/', '').trim();

  var lookupValue = load.repository.name+"#"+sha;

  util.getConfiguration(lookupValue, function(err, configuration) {

    // Check that we have an available configuration for environment variables.
    if (err || !configuration) {
      util.logNow({ type: 'hook', name: 'Github Hook Build Failed', message: 'Could not find a configuration (or a default) for ' + lookupValue + '.' });
      return;
    }

    util.getProcessIndexbySHA(lookupValue, function(err, currentProcessIdx) {

      if (!currentProcessIdx) {

         var options = {
           type:        'head',
           sha:         lookupValue,
           name:        'Hook Tracking',
           description: 'Github Web hook delivered ' + lookupValue,
           environment: 'development',
           owner:       'CI',
           configuration: configuration.configurations || {},
           repo:         load.repository.url
         };

         util.setupBuild(options, function(err, data) {
           if (err) return util.logNow({type: 'hook', name: 'Github Hook Start Failed', message: 'A github webhook requested failed ' + err.message });
           
           util.logNow({ type: 'hook', name: 'Github Hook Build Complete', message: 'A github webhook requested setup the branch ' + lookupValue + ' ' + load.ref });
         });
      } else {
         util.restartBuild(lookupValue, function(err, data) {
           if (err) return util.logNow({type: 'hook', name: 'Github Hook Restart Failed', message: 'A github webhook requested failed ' + err.message });
           
           util.logNow({ type: 'hook', name: 'Github Hook Rebuild Complete', message: 'A github webhook requested rebuild the branch ' + lookupValue + ' ' + load.ref });
         });
      }

      res.send('Done');
    });

  });


}
