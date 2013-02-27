var express    = require('express'),
    connect    = require('connect'),
    fs         = require('fs'),
    sys        = require('sys'),
    path       = require('path'),
    forever    = require('forever'),
    OAuth      = require('oauth').OAuth,
    GitHubApi  = require("github"),
    oa; 

var app = express();
app.configure(function() {
  app.set('port', process.env.PORT || 3005);
  app.set('views', __dirname + '/views');
  app.set('view options', { layout: true, pretty: true });
  app.set('view engine', 'jade');

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());

  app.use(express.session({
    secret: 'jungleluv',
    store: new express.session.MemoryStore({}),
  }))

  app.use(app.router);

  // Attach the Session to App.Local scope.
  app.use(function(req, res, next) {
    app.locals.session = req.session;

    // Set the page defaults.
    app.locals.page = { 
      title: '', 
      showsearch: true
    }

    next();
  });

  // Catch all traffic not handled and send to the index.html.
  app.use('/', express.static(path.join(__dirname, '/')));
  app.use(function(req, res){
    res.render('index', { title: 'Home' });
  });

});
app.locals.moment = require('moment');
app.locals._ = require('underscore');

//-------------------------------------------------------------------

var routes = require('./routes/index')

var check = function(req, res, next ) {
  if (req.session.user && req.session.user.logged_in) {
    next();
  } else {
    res.render('login', { session: req.session, params: { message: '', goto: req.url }, title: 'Home', hidesearch: '' });
  }
}

app.get('/github_login', routes.github.login );
app.get('/github_cb',    routes.github.callback );
app.get('/account',  check, routes.github.userinfo );

// Standard Login
app.get('/login',  routes.session.login );
app.post('/login', routes.session.loginsubmit );
app.get('/logout', routes.session.logout );

app.get('/git/commit/:sha', function(req, res) {

  var sys = require('sys')
  var exec = require('child_process').exec;
  function puts(error, stdout, stderr) { 
    sys.puts(stdout) 
    console.log('Set the checkout status to a specific commit')

    res.send('We have rebuild the node using a specific commit.')
  }

  function checkout(error, stdout, stderr) {  
    sys.puts(stdout) 
    console.log('Preparing to checkout a commit.')
    exec("GIT_WORK_TREE=" + pdir + " git --git-dir=" + pdir + "/.git --work-tree=" + pdir + " checkout " + req.params.sha, puts)
  }

  var pdir = __dirname + '/tmp/' + req.params.sha.substring(0,10);

  var command = 'rm -Rf ' + pdir + '; ' +
                'git clone git@github.com:npr/composer.git ' + pdir + '; ' + 
                'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + req.params.sha

  console.log(command);
  exec(command, puts);

  // exec("rm -Rf " + pdir, function puts(error, stdout, stderr) { 
  //   console.log('Removed the existing git repo.');

  //   exec("git clone git@github.com:npr/composer.git " + pdir + "; ls -all", checkout);
  // });
  
});

app.get('/sites', function(req, res) {

  var fs = require("fs");

  var dir = __dirname + '/tmp';

  fs.readdir(dir, function (err, list) {

    console.log(list);
    var data = [];

    list.forEach(function (file) {

      path = dir + "/" + file;

      fs.stat(path, function (err, stat) {
        if (stat && stat.isDirectory()) {
          data.push({ data: stat, path: path, dir: file });
        }
      });

    });

    res.render('sites', { session: req.session, data: list})
    console.log('Dddd', data);

  });

});


app.get('/start/:sha', function(req, res) {

  var sha = req.params.sha;
 
  var appFolder = __dirname + '/tmp/' + sha + '';
  var options = { 
    max:       3, 
    portUsed:  22222,
    logfile:   appFolder + '/forever_all.log',
    append:    true,
    checkFile: false,
    sourceDir: appFolder, 
    env:       { NODE_ENV: "development", PORT: 3011 }
  };

  var sys = require('sys')
  var exec = require('child_process').exec;
  function puts(error, stdout, stderr) { 
    sys.puts(stdout) 

    res.send('Starting forever process.')
    forever.start('server.js', options, function(err, data) {
      console.log('Error Report', data);
      res.send(filename);
    });

  }

  console.log('NPM Install starting.')
  exec('cd ' + appFolder + ';npm install', puts)

});

app.get('/restart/:target', check, function(req, res) {

  var target = parseInt(req.params.target);

  forever.restart(target, false, function (err, data) {
    if (err) {
      console.log('Error running `forever.restart()`');
      console.dir(err);
    }
    res.send('Restarting ' + target);
  });

  res.redirect('/list');

});

app.get('/git', check, routes.github.commits );

app.get('/list', check, function(req, res) {
  forever.list(false, function (err, data) {
    if (err) {
      // console.log('Error running `forever.list()`');
      // console.dir(err);
    }

    var t = data[0];
    console.log(t)
    res.render('list', { data: data } );
  })
});

app.get('/tail/:id', check, function(req, res) {

  var id = parseInt(req.params.id);

  forever.tail(id, function (err, data) {
    if (err) {
      // console.log('Error running `forever.list()`');
      // console.dir(err);
    }

    res.send(data);
    return;
    res.render('tail', { data: data } );
  })
});

app.get('/detail/:id', check, function(req, res) {
  
  var id = parseInt(req.params.id);

  forever.list(false, function (err, data) {
    if (err) {
      // console.log('Error running `forever.list()`');
      // console.dir(err);
    }

    var element = data[id];    

    res.render('detail', { data: element } );
  })
});

app.get('/all', check, function(req, res) {
  forever.list(false, function (err, data) {
    if (err) {
      console.log('Error running `forever.list()`');
      console.dir(err);
    }
    
    res.send(data);
  })
});

app.get('/test', function(req, res) {
  res.send('Test Page');
});

app.post('/build', check, function(req, res) {

  var pl = JSON.parse(req.body.payload);
  var exec = require('child_process').exec;
  var execstr = "/var/www/composer/manager/getCommitCode.sh <<MARK "+pl.before+"\ "+pl.after+"\ "+pl.ref+"\ MARK";

  function puts(error, stdout, stderr) { sys.puts(stdout) }
  exec(execstr, puts);

});

// ------------------------------------------------------------------------------------

var port = process.env.PORT || 3005;
app.listen(port, function() { 
  console.log('StartUp: Node CI Server ' + port ); 
});
