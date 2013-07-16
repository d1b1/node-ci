var http  = require('http');
var https = require('https');
var _     = require('underscore');
var async = require('async');
var githubAPI = require('github');

/*
  This function will parse a github path into its parts.

*/
var parseGitPath = function(input) {

  var parts  = input.split(':');
  var domain = parts[0].split('@');
  var git    = parts[1].split('/');

  var gitData = {
     url: input,
     location: {
       domain: domain[1],
       user: domain[0]
     },
     repo: {
        user: git[0],
        file: git[1],
        name: git[1].split('.')[0],
        path: parts[1]
     }
  };

  return gitData;
}

/*
  This function provides an express endpoint for the Github Repo
  build process. This collects the repo path, desired build and 
  misc values and will trigger the WebHook Post Receive code.

*/
exports.info = function(req, res) {

  var server = require('../config.json');

  var data = {
    name:         req.params.branch,
    path:         req.urlparams.path,
    branch:       req.urlparams.branch,
    repositories: server.repositories,
    branches:     []
  }

  if (req.urlparams.path) {

    // Run the gitpath through to get its parts.
    var gitData = parseGitPath( req.urlparams.path );

    // Setup the github API. 
    // TODO: Move this to a better place. Maybe in the App.js file.

    var github = new githubAPI({ version: '3.0.0' });
    github.authenticate({ type: 'oauth', token: req.session.user.access_token });

    // Setup the opts for a github Query. 
    // TODO: Need to build in some caching to keep the rate-limit
    // from causing issues.

    var opt = {
      repo:   gitData.repo.name,
      user:   gitData.repo.user
    };

    github.repos.getBranches(opt, function(err, branchData) {
      if (err) console.log(err);

      // Dump the Branches in to the data.
      data.branches = branchData;

      res.render('heroku_info', { data: data }, function(err, html) {
        if (err) return res.render('error', { title: '', message: err.message });
        res.send(html);
      });
    });

  } else {
    res.render('heroku_info', { data: data }, function(err, html) {
      if (err) return res.render('error', { title: '', message: err.message });
      res.send(html);
    });
  }

}

/*

  This function spoofs the github post receive webhook and will
  call the /build2 (PUBLIC) endpoint with a payload. This will
  trigger the Git Clone/Fetch and the resulting Heroku lookup
  and deploy process.

*/
exports.deploy = function(req, res) {

  var repoPath   = req.body.repoPath;
  var repoBranch = req.params.repoBranch;

  // Run the gitpath through to get its parts.
  var gitData = parseGitPath( req.body.repoPath );

  // Build the mock to send to the WebHook URL.
  var data = {
    repository: {
      name: gitData.repo.name,
      owner: { name: gitData.repo.user },
      url: repoPath
    }, 
    ref: 'refs/heads/' + req.body.repoBranch 
  };

  var jsonData = JSON.stringify( { payload: JSON.stringify(data) } );

  // TODO: Abstract into a different function.
  var options = {
    host:   'local.node.ci',
    port:   3005,
    path:   '/build2',
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
    return res.send('Error in Mock Webhook', err);
  });

  call.write(jsonData);
  call.end();
}

/* 
  This is a POST endpoint for Github post receive actions. This 
  function will parse the POST and attempt to build a Heroku 
  app using the Repo Name, Team and Branch/Commit ID. 

*/
exports.catchCommitPayloadv3 = function(req, res) {

  console.log('Got a webhook request.')

  var load   = JSON.parse(req.body.payload);
  var repo   = load.repository;
  var branch = load.ref.replace('refs/heads/', '').trim();

  var gitURL = 'git@github.com:' + repo.owner.name + '/' + repo.name

  console.log('GIT Payload', load);

  console.log('GIT URL ' + gitURL);

  // TODO: Add in form submit valication.
  // TODO: Add a check agains accepted Repos to prevent outside payloads.

  async.series({
    app: function(callback) {

      // TODO: Move the mmp string to a configuration value.
      var appName = 'mmp-' + repo.name + '-' + branch;

      console.log('Looking for ' + appName);

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
      var dir = GLOBAL.root + '/tmp/' + gitURL;

      console.log('Looking for Local Git Repo')

      cloneFetchGITRepo(gitURL, dir, function(err, data) {
        console.log('Clone/Fetch Result', err, data)
        if (err) return callback(null);
        callback(null, dir);
      });

    }
  }, function(err, results) {

    var herokuGITUri = results.app.git_url;
    var localGitPath = results.gitDir;
    var branchName   = branch;

    console.log('Async Results', results);

    if (!results.app.status) {
      console.log('Stopping in the App Status check', results.app);
      return res.send(results.app);
    }

    console.log('Starting the final phase');

    pushToHeroku(herokuGITUri, localGitPath, branchName, function(err, stdout, stderr) {
      console.log('Error', err);
      // console.log('STDout', stdout);
      // console.log('STDerr', stderr);

      var data = {
        err: err,
        stdout: stdout,
        stderr: stderr
      }
    
      console.log('Final Push Data', data);

      return res.send(data);
    });
  });

}

/*
  This function will make a local copy of the a repo. It checks 
  for the file, if not found it will clone the repo. If found it will
  force a fetch. 

  Arguments:

    - gitUri (string) - Example: git@github.com:d1b1/isAPI.js.git
    - gitDir (string) - Path to store the git repo locally.
    - cb (function) - Callback.

*/
var cloneFetchGITRepo = function(gitUri, gitDir, cb) {

  console.log('Looking for ' + gitDir + ' (' + gitUri + ')');

  if (require('fs').existsSync(gitDir)) { 
    console.log('Found a folder with the repo ' + gitDir);

    var cmd = 'GIT_WORK_TREE=' + gitDir + '; ' +
              'git --git-dir=' + gitDir + '/.git --work-tree=' + gitDir + ' fetch origin';
  } else {
    console.log('Cloning the Repo ' + gitDir);
    var cmd = 'git clone ' + gitUri + ' ' + gitDir + ';'
    console.log('Clone Command ' + cmd);
  }

  var exec = require('child_process').exec;
  exec(cmd, cb);      
}

/*

  This function will take in the Heroku Remote, Lcoal Path and the branch
  name and will push the code to the app.

  Arguments:

   - herokuGitUri (string) - Heroku Git URL value. 
   - localGitPath (string) - Path to the local git repo.
   - branchName   (string) - Name of branch to push to heroku.

*/
var pushToHeroku = function(herokuGitUri, localGitPath, branchName, cb) {

  var cmd = 'GIT_WORK_TREE=' + localGitPath + '; ' + 
            'git --git-dir=' + localGitPath + '/.git push  '+ herokuGitUri + ' origin/' + branchName + ':master --force';

  console.log('Push Command to Heroku: ', cmd);
  var exec = require('child_process').exec;
  exec(cmd, cb);
}

/*
  This function will check the Heroku API for an existing App using
  the desired name.

  Arguments:

   - name (string) - Name of a Heroku App. 
   - cb   (function) - Callback to receive the API GET request.

*/
var herokuAppGet = function(name, cb) {

  name = name.toLowerCase();

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku GET /apps/:id.');
    cb(null, null);
    return;
  }

  var options = {
    host: 'api.heroku.com',
    path: '/apps/' + name,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + new Buffer(":" + (process.env.HEROKU_API)).toString('base64'),
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
      // This will tell the final asynch process that all is well.
      data.status = true;

      console.log('Found the APP', data) 
      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}

/*
  This function will setup a new heroku app.

  Arguments:

   - options (dictionary) - Collection of API parameters
     - name (string/Optional) - If no name is provided a default is created.
     - stack (string/Optional) - If no stack is provided then a default is created. 
   - cb   (function) - Callback to receive the API POST request.

*/
var herokuAppPost = function(opts, cb) {

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku POST /Apps');
    cb(null, null);
    return;
  }

  var name = opts.name.trim().toLowerCase().split('_').join('-');

  var options = {
    host: 'api.heroku.com',
    path: '/apps?app[name]='+ name,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + new Buffer(':' + (process.env.HEROKU_API)).toString("base64")
    }
  };

  console.log('Heroku POST /apps call', options)

  var call = https.request(options, function(result) {
    result.setEncoding('utf8');
    var chunkData = '';
    result.on('data', function(chunk) { chunkData = chunkData + chunk; });
    result.on('end', function() {
      var data = JSON.parse(chunkData);
      if (result.statusCode == 200) {
        data.status = true;
      } else {
        data.status = false;
      }

      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err);
    cb(err);
  });

  call.end();

}

exports.herokuAddons = function(req, res) {

  // TODO Get the APP for display in the header.
  getherokuAddons(req.params.id, function(err, data) {
    res.render('heroku_addons', { app_name: req.params.id, data: data });
  });

}

exports.herokuContributors = function(req, res) {

  // TODO Get the APP for display in the header.
  getherokuContributors(req.params.id, function(err, data) {
    res.render('heroku_contributors', { app_name: req.params.id, data: data });
  });

}

exports.herokuConfigs = function(req, res) {

  // TODO Get the APP for display in the header.
  getherokuConfig(req.params.id, function(err, data) {
    res.render('heroku_config', { app_name: req.params.id, data: data });
  });

}

exports.herokuList = function(req, res) {

  getherokuList(function(err, data) {
    res.render('heroku_apps', { data: data });
  });
  
}

var getherokuAddons = function(id, cb) {

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku GET /apps/:id.');
    cb(null, null);
    return;
  }

  var options = {
    host: "api.heroku.com",
    path: "/apps/" + id + "/addons",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.heroku+json; version=3",
      "Authorization": 'Basic ' + new Buffer(":" + (process.env.HEROKU_API)).toString('base64'),
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
      // This will tell the final asynch process that all is well.
      data.status = true;

      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}

var getherokuContributors = function(id, cb) {

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku GET /apps/:id.');
    cb(null, null);
    return;
  }

  var options = {
    host: "api.heroku.com",
    path: "/apps/" + id + "/collaborators",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.heroku+json; version=3",
      "Authorization": 'Basic ' + new Buffer(":" + (process.env.HEROKU_API)).toString('base64'),
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
      // This will tell the final asynch process that all is well.
      data.status = true;

      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}

var getherokuConfig = function(id, cb) {

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku GET /apps/:id.');
    cb(null, null);
    return;
  }

  var options = {
    host: "api.heroku.com",
    path: "/apps/" + id + "/config-vars",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.heroku+json; version=3",
      "Authorization": 'Basic ' + new Buffer(":" + (process.env.HEROKU_API)).toString('base64'),
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
      // This will tell the final asynch process that all is well.
      data.status = true;

      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}

var getherokuList = function(cb) {

  if (process.env.HEROKU_API == '' || !process.env.HEROKU_API) {
    console.log('No process.env.HEROKU_API defined. Stopping Heroku GET /apps/:id.');
    cb(null, null);
    return;
  }

  var options = {
    host: "api.heroku.com",
    path: "/apps",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": 'Basic ' + new Buffer(":" + (process.env.HEROKU_API)).toString('base64'),
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
      // This will tell the final asynch process that all is well.
      data.status = true;
 
      cb(null, data);
    });
  });

  call.on('error', function(err) { 
    console.log('Error in webhook handler', err); 
    cb(err);
  });

  call.end();

}
