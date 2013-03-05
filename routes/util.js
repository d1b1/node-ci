var forever  = require('forever');
var _        = require('underscore');
var fs       = require('fs');
var githubAPI  = require('github');
var db         = require('../db');
var mongodb    = require('mongodb');
var moment     = require('moment');

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

    src.info = commit;

    cb(null, src)
  }

  // Star the Actual Process Now.
  exec(cmd, put);
}

exports.logNow = function(data, cb) {

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
    if (err) return callback(err, null);
    cb(null, data);
  });
  
}

exports.getSites = function(cb) {

  forever.list(false, function (err, data) {

    if (err) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to fetch the existing processes..'});
      return cb(err, null)
    }
    
    var async = require('async');

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

exports.getProcessbyTypeAndID = function(type, id, cb) {

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

exports.getProcessIndexbyID = function(uid, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var UIDs = [];
    _.each(data, function(o) { UIDs.push(o.uid); });

    var indexNum = _.indexOf(UIDs, uid);

    if (indexNum == -1) indexNum = null;

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

exports.getPort = function(cb) {
 
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