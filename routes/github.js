var url        = require('url'),
    githubAPI  = require('github'),
    mongodb    = require('mongodb'),
    _          = require('underscore'),
    async      = require('async'),
    moment     = require('moment');
    util       = require('./util');
    forever    = require('forever');

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

      async.series({
        user: function(callback) {
         github.user.get({}, function(err, data) {
           callback(null, data);
         });
        },
        team: function(callback) {
          getTeamMembers(111, jsonchunkData.access_token, function(err, data) {
            callback(null, data);
          });
        }
      }, function(err, asyncResults) {

        var isOnTeam = _.filter(asyncResults.team, function(o) { return o.login == asyncResults.user.login });
        if (isOnTeam.length == 1) {

          req.session.user = {  
            status:       true, 
            logged_in:    true,
            name:         asyncResults.user.name,
            email:        asyncResults.user.email,
            access_token: jsonchunkData.access_token,
            github:       asyncResults.user
          };

          req.session.logged_in = true;
          util.logNow({ name: 'Login by ' + asyncResults.user.name, data: asyncResults.user });

          GLOBAL.messages.push({ type: 'info', copy: 'Session setup. Welcome ' + (asyncResults.user.name || '[Someone?]') + '!' });
          res.redirect('/');
        } else {
          res.redirect('/login?message=NotOnTeam');
          return;
        }

      });
    });
  });

  call.on('error', function( err ) {
    res.redirect('/login?message=ErrorInOAUTH')
  });

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

exports.repoAdd = function(req, res) {

  var data = {
    name:  '',
    repo:  '',
    user:  '',
    url:   ''
  }

  res.render('repo_edit', { data: data, id: null });
}

exports.repoEdit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.configurations) result.configurations = [];

    res.render('repo_edit', { data: result, id: id });
  });

}

exports.repoUpdate = function(req, res) {

  var id = req.body.id;

  var data = {
    name:   req.body.name || 'No Name',
    repo:   req.body.repo || '',
    user:   req.body.user || '',
    url:    req.body.url || ''
  };

  if (!id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
    collection.insert(data, { safe: true}, function(err, result) {
      if (err) {
        console.log(err);
      };

      console.log('Insert', result)
    });

    res.redirect('/repos');
  } else {

    var query = { _id: new mongodb.ObjectID( id ) };

    var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {

         res.redirect('/repos');
      });
  }

}

exports.list = function(req, res) {

  var query = {};
  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.find(query).toArray(function(err, results) {
    if (err) return;

    res.render('repos', { data: results });
  });

}

exports.commits = function(req, res) {

  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    buildPage(result);
  });

  var buildPage = function(repoData) {

    var github = new githubAPI({ version: '3.0.0' });
    github.authenticate({ type: 'oauth', token: req.session.user.access_token });

    var options = {
      repo:   repoData.repo,
      user:   repoData.user,
      since:  moment().subtract('months', 24).format('YYYY-MM-DDTHH:mm:ssZ'),
      per_page: 30,
      sha:     req.urlparams.sha || null
    };

    async.parallel({
      builds: function(callback) {

        forever.list(false, function (err, data) {

          if (!data) return callback(null, {});

          var builds = {};
          _.each(data, function(o) { 
            if (o.ui_sha) builds[o.ui_sha] = o;  
          });

          callback(null, builds);
        });

      },
      team: function(callback) {

        var opt = {
          id:    GLOBAL.config.team,
        };

        github.orgs.getTeamMembers(opt, function(err, data) {
          if (err) return callback(err, null);
          callback(null, data);
        });
        
      },
      branches: function(callback) {

        var opt = {
          repo:   repoData.repo,
          user:   repoData.user,
        };

        github.repos.getBranches(opt, function(err, data) {
          if (err) return callback(err, null);
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

      res.render('commits', { repo: repoData, activeBuilds: data.builds, current_branch: '', team: data.team, data: data.commits, branches: data.branches, options: options });
    });
  }


}

/*
 * This function handles the branches route. It will return all the 
 * branches for a given repo. 
 *
 *
 */

exports.branches = function(req, res) {

  if (!GLOBAL.config) {
    GLOBAL.messages.push({ type: 'error', copy: 'Missing Configuration information.'});
    res.redirect('/');
    return;
  }

  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'repos');
  collection.findOne(query, function(err, result) {
    if (err) return;

    buildPage(result);
  });

  var buildPage = function(repoData) {

    var github = new githubAPI({ version: '3.0.0' });
    github.authenticate({ type: 'oauth', token: req.session.user.access_token });

    var async = require('async');
    async.parallel({
      branches: function(callback) {

        var opt = {
          repo:   repoData.repo,
          user:   repoData.user,
        };

        github.repos.getBranches(opt, function(err, data) {
          if (err) return callback(err, null);
          callback(null, data);
        });
        
      }
    }, function(err, data) {

      res.render('branches', { repo: repoData, current_branch: '', data: data.branches });
    });

  }


}

exports.makeReferenceDialog = function(req, res) {
  res.render('makeReferenceDialog', { sha: req.params.sha });
}

exports.deleteReferenceAction = function(req, res) {

  var ref = req.params.ref;

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var opt = {
    user:  GLOBAL.config.repository.user,
    repo:  GLOBAL.config.repository.repo,
    ref:   'heads/' + ref,
  };

  github.gitdata.deleteReference(opt, function(err, data) {
    if (err) return res.send(err);
    res.redirect('/git');
  });
}

exports.makeReferenceAction = function(req, res) {

  var sha = req.body.sha;

  var ref = req.body.reference_name.replace(/[^-a-zA-Z0-9]/g, ' ');
  var ref_name = _.reject(ref.split(' '), function(o) { return o.trim() == ''; }).join('_').trim();

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var opt = {
    user:  GLOBAL.config.repository.user,
    repo:  GLOBAL.config.repository.repo,
    ref:   'refs/heads/' + ref_name,
    sha:   sha
  };

  github.gitdata.createReference(opt, function(err, data) {
    if (err) return res.send(err);
    
    res.redirect('/');
  });
}

var getTeamMembers = function(teamID, access_token, cb) {

  if (!GLOBAL.config) {
    return cb(null, null);
  }

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: access_token || req.session.user.access_token });

  var opt = {
    id: GLOBAL.config.team,
  };

  github.orgs.getTeamMembers(opt, function(err, data) {
    if (err) return callback(err, null);
    
    cb(null, data);
  });
  
}

exports.teamMembers = function(req, res) {

  if (!GLOBAL.config) {
    GLOBAL.messages.push({ type: 'error', copy: 'Missing Configuration information.'});
    res.redirect('/');
    return;
  }

  var github = new githubAPI({ version: '3.0.0' });
  github.authenticate({ type: 'oauth', token: req.session.user.access_token });

  var async = require('async');
  async.parallel({
    members: function(callback) {

      var opt = {
        id:    GLOBAL.config.team,
      };

      github.orgs.getTeamMembers(opt, function(err, data) {
        if (err) return callback(err, null);
        callback(null, data);
      });
      
    }
  }, function(err, data) {

    console.log(data)
    res.render('team_members', { data: data.members });
  })

}
