var url        = require('url'),
    githubAPI  = require('github'),
    mongodb    = require('mongodb'),
    db         = require('../db.js'),
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

      var github = new githubAPI({ version: "3.0.0" });

      github.authenticate({
        type: "oauth",
        token: jsonchunkData.access_token
      });

      github.user.get({}, function(err, data) {

        req.session.user = {  
          status: true, 
          logged_in: true,
          name: 'adsasdf',
          email: data.email,
          access_token: jsonchunkData.access_token,
          github: data
        };

        req.session.logged_in = true;
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
    version: "3.0.0"
  });

  github.authenticate({
    type: "oauth",
    token: req.session.user.access_token
  });

  github.user.get({}, function(err, data) {
    res.render('user', { data: data });
  });

}

exports.commits = function(req, res) {

  var github = new githubAPI({
    version: "3.0.0"
  });


  github.authenticate({
    type: "oauth",
    token: req.session.user.access_token
  });

  var since = moment().subtract('months', 24).format('YYYY-MM-DDTHH:mm:ssZ');

  github.repos.getCommits({ user: 'npr', 'until': since, repo: 'composer' }, function(err, data) {
    res.render('commits', { data: data });
  });

}



