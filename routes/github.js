var url        = require('url'),
    githubAPI  = require('github'),
    mongodb    = require('mongodb'),
    _          = require('underscore'),
    moment     = require('moment');

exports.login = function(req, res) { 
  var url = 'https://github.com/login/oauth/authorize?state=222&client_id=' + process.env.GITHUB_CLIENTID + '&scope=user,repo';
  res.redirect(url);
}

exports.callback = function(req, res) {

  var queryURL = url.parse(req.url, true);

  var data = {
    client_id:     process.env.GITHUB_CLIENTID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: queryURL.query['code'],
    scope: 'repo,user,public_repo',
    state: 222
  }

  var jsonData = JSON.stringify(data);

  var options = {
    hostname    : 'github.com',
    port        : 443,
    path        : '/login/oauth/access_token',
    contenttype : 'application/json',
    datatype    : 'json',
    method      : 'POST',
    headers     : { 
      'Content-Type': 'application/json', 
      'Content-Length': jsonData.length,
      'X-OAuth-Scopes': 'repo',
      'X-Accepted-OAuth-Scopes': 'repo'
    }
  };

  var https = require('https');

  var call = https.request(options, function( result ) {
    result.setEncoding('utf8');

    var chunkData = '';
    result.on('data', function(chunk) {
      chunkData = chunkData + chunk
    });

    result.on('end', function() {
      var jsonchunkData = JSON.parse(chunkData);

      req.session.access_token = jsonchunkData.access_token;
      req.session.logged_in = true;

      var github = new githubAPI({ version: '3.0.0' });

      github.authenticate({
        type: 'oauth',
        token: jsonchunkData.access_token
      });

      github.user.get({}, function(err, data) {

        req.session.user = {  
          status: true, 
          logged_in: true,
          name: data.name,
          email: data.email,
          access_token: jsonchunkData.access_token,
          github: data
        };

        
        req.session.logged_in = true;

        GLOBAL.messages.push({ type: 'info', copy: 'Session setup. Welcome ' + (data.name || '<Someone?>') + '!' });
        res.redirect('/list');
      });
    });

    result.on('error', function( err ) {
      res.send(JSON.stringify({ 'Error': err.message}), 404);
    });

  })

  call.write(jsonData);
  call.end()
}

exports.userinfo = function(req, res) {

  var github = new githubAPI({
    version: '3.0.0'
  });

  github.authenticate({
    type: 'oauth',
    token: req.session.user.access_token
  });

  github.user.get({}, function(err, data) {
    res.render('user', { data: data });
  });

}

exports.commits = function(req, res) {

  if (!GLOBAL.config) {
    GLOBAL.messages.push({ type: 'error', copy: 'Missing Configuration information.'});
    res.redirect('/list');
    return;
  }

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var options = {
    repo:   GLOBAL.config.repository.repo,
    user:   GLOBAL.config.repository.user,
    since:  moment().subtract('months', 24).format('YYYY-MM-DDTHH:mm:ssZ'),
    per_page: 30,
    sha:     req.urlparams.sha || null
  };

  var async = require('async');

  async.parallel({
    branches: function(callback) {

      var opt = {
        repo:   GLOBAL.config.repository.repo,
        user:   GLOBAL.config.repository.user,
      };

      github.repos.getBranches(opt, function(err, data) {
        if (err) return callback(err, null);
        console.log(data)
        callback(null, data);
      });
      
    },
    commits: function(callback) {
      
      github.repos.getCommits(options, function(err, data) {
        if (err) return callback(err, null);
        callback(null, data)
      });

    }
  }, function(err, data) {

    res.render('commits', { current_branch: '', data: data.commits, branches: data.branches, options: options });
  })

}


exports.branches = function(req, res) {

  if (!GLOBAL.config) {
    GLOBAL.messages.push({ type: 'error', copy: 'Missing Configuration information.'});
    res.redirect('/list');
    return;
  }

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var async = require('async');
  async.parallel({
    branches: function(callback) {

      var opt = {
        repo:   GLOBAL.config.repository.repo,
        user:   GLOBAL.config.repository.user,
      };

      github.repos.getBranches(opt, function(err, data) {
        if (err) return callback(err, null);
        callback(null, data);
      });
      
    }
  }, function(err, data) {

    res.render('branches', { current_branch: '', data: data.branches });
  })

}

