var http  = require('http');
var https = require('https');
var _     = require('underscore');
var async = require('async');
var githubAPI = require('github');

exports.info = function(req, res) {

  var server = require('../config.json');

  var data = {
    name: req.params.branch,
    path: req.urlparams.path,
    branch: req.urlparams.branch,
    repositories: server.repositories,
    branches: []
  }

  if (req.urlparams.path) {

    var github = new githubAPI({ version: '3.0.0' });
    github.authenticate({ type: 'oauth', token: req.session.user.access_token });

    var opt = {
      repo:   'composer',
      user:   'nprds',
    };

    github.repos.getBranches(opt, function(err, branchData) {
      if (err) return console.log(err);

      data.branches = branchData;
      res.render('heroku_info', { data: data })
    });

    
  } else {

    res.render('heroku_info', { data: data })
  }

}

exports.deploy = function(req, res) {

  var repoPath   = req.body.repoPath;
  var repoBranch = req.params.repoBranch;

  var data = {
      repository: {
        name: 'composer',
        url: repoPath
      }, 
      ref: 'refs/heads/' + req.body.repoBranch 
    };

  // res.send(data);

  // return;

  // var data = {
  //     repository: { 
  //       name: 'ds-hello-world',
  //       url: 'git@github.com:nprds/ds-hello-world.git'
  //     }, 
  //     ref: 'refs/heads/' + 'master'
  //   };

  data = { payload: JSON.stringify(data) };
  var jsonData = JSON.stringify(data);

  var options = {
    host: 'local.node.ci',
    port: 3005,
    path: '/build2',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': jsonData.length
    }
  };

  var call = http.request(options, function(result) {
    result.setEncoding('utf8');
    var chunkData = '';
    result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    result.on('end', function() {
      res.send(chunkData);
      return;
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err);
  });

  call.write(jsonData);
  call.end();

}

exports.catchCommitPayloadv3 = function(req, res) {

  var load = JSON.parse(req.body.payload);
  var repo = load.repository;
  var branch = load.ref.replace('refs/heads/', '').trim();

  async.series({
    app: function(callback) {

      var appName = 'mmp-'+repo.name+'-'+branch;

      herokuAppGet(appName, function(err, data) {
        if (err) return callback(err);

        if (data) {
          return callback(null, data);
        } else {
          var opts = { name: appName, stack: 'cedar' };

          herokuAppPost(opts, function(err, data) {
            if (err) return callback(err);
            return callback(null, data);
          });
        }

      });

    },
    gitDir: function(callback) {
      // Set the folder where we might find the repo.
      var dir = GLOBAL.root + '/tmp/' + repo.name;

      cloneFetchGITRepo(repo.name, repo.url, dir, function(err, data) {
        if (err) return callback(null);
        callback(null, dir);
      });

    }
  }, function(err, results) {

    var herokuGITUri = results.app.git_url;
    var localGitPath = results.gitDir;
    var branchName   = branch;

    pushToHeroku(herokuGITUri, localGitPath, branchName, function(err, stdout, stderr) {
      console.log('Error', err);
      console.log('STDout', stdout);
      console.log('STDerr', stderr);

      var data = {
        err: err,
        stdout: stdout,
        stderr: stderr
      }
    
      return res.send(data);
    });

  });

}

var cloneFetchGITRepo = function(name, url, gitDir, cb) {

  if (require('fs').existsSync(gitDir)) { 
    var cmd = 'GIT_WORK_TREE=' + gitDir + '; ' +
              'git --git-dir=' + gitDir + '/.git --work-tree=' + gitDir + ' fetch origin';
  } else {
    var cmd = 'git clone ' + url + ' ' + gitDir + ';'
  }

  var exec = require('child_process').exec;
  exec(cmd, cb);      
}

/*
  This function will take in the Heroku Remote, Lcoal Path and the branch
  name and will push the code to the app.

*/
var pushToHeroku = function(herokuGitUri, localGitPath, branchName, cb) {

  var cmd = 'GIT_WORK_TREE=' + localGitPath + '; ' +
            'git --git-dir=' + localGitPath + '/.git reset --hard origin/' + branchName + ';' + 
            'git --git-dir=' + localGitPath + '/.git push  '+ herokuGitUri + ' ' + branchName + ':master --force';

  console.log('Push Command to Heroku: ', cmd);
  var exec = require('child_process').exec;
  exec(cmd, cb);
}

var herokuAppGet = function(name, cb) {

  var key = '67db5180900d5333178e7874f324afd4d850d95f';

  var options = {
    host: 'api.heroku.com',
    path: '/apps/' + name,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + new Buffer(":" + (key)).toString('base64'),
    }
  };

  var call = https.request(options, function(result) {
    result.setEncoding('utf8');
    var chunkData = '';
    result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    result.on('end', function() {
      if (result.statusCode == 404 && chunkData == 'App not found.') {
        return cb(null, null);
      }
      
      var data = JSON.parse(chunkData);
      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}

var herokuAppPost = function(opts, cb) {

  var key = '67db5180900d5333178e7874f324afd4d850d95f';

  var options = {
    host: 'api.heroku.com',
    path: '/apps?app[name]='+opts.name,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + new Buffer(':' + (key)).toString("base64")
    }
  };

  var call = https.request(options, function(result) {
    result.setEncoding('utf8');
    var chunkData = '';
    result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    result.on('end', function() {
      var data = JSON.parse(chunkData);
      cb(null, data)
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err);
    cb(err);
  });

  call.end();

}
