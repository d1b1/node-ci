var express    = require('express'),
    connect    = require('connect'),
    fs         = require('fs'),
    sys        = require('sys'),
    path       = require('path'),
    forever    = require('forever'),
    OAuth      = require('oauth').OAuth,
    GitHubApi  = require("github"),
    _          = require("underscore"),
    async      = require("async"),
    oa;


GLOBAL.messages = [];

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
app.locals.moment  = require('moment');
app.locals._       = require('underscore');
app.locals.messages = [];

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

  var sha = req.params.sha;

  var exec = require('child_process').exec;

  function puts(error, stdout, stderr) { 
    console.log('Completed the commit setup.')

    GLOBAL.messages.push({ type: 'info', copy: 'Building... Might take a bit.' });
    res.redirect('/list');
  }

  var pdir = __dirname + '/tmp/' + sha.substring(0,10);

  var command = 'rm -Rf ' + pdir + '; ' +
                'git clone git@github.com:npr/composer.git ' + pdir + '; ' + 
                'GIT_WORK_TREE=' + pdir + ' git --git-dir=' + pdir + '/.git --work-tree=' + pdir + ' checkout ' + sha

  GLOBAL.messages.push({ type: 'info', copy: 'Buidling an install from a commit.' });
  GLOBAL.messages.push({ type: 'info', copy: 'Commit SHA: ' + sha });
  GLOBAL.messages.push({ type: 'info', copy: 'Build Path: ' + pdir });
  GLOBAL.messages.push({ type: 'info', copy: command });

  exec(command, puts);
  
});

app.get('/sites', check, function(req, res) {

  var fs = require("fs");

  var dir = __dirname + '/tmp';

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

});

GLOBAL.site_ports = [];

var getUsedPorts = function(cb) {

 forever.list(false, function (err, data) {
    if (err) return cb(err, null);

    var ports = [];
    _.each(data, function(o) {
      if (o.ui_port && typeof o.ui_port != undefined) ports.push( parseInt(o.ui_port));
    });

    cb(null, ports);
  })


}

var getPort = function(cb) {
 
  forever.list(false, function (err, data) {
    if (err) return cb(err, null);

    var ports = [];
    _.each(data, function(o) {
      if (o.ui_port && typeof o.ui_port != undefined) ports.push( parseInt(o.ui_port));
    });

    for (var i=3010; i<3030;i++) { 
      if (_.indexOf(ports, i) == -1) return cb(null, i);
    }

    cb(null, null);
  });

}

app.get('/start/:sha', check, function(req, res) {
  res.render('build_commit', { id: req.params.sha } );
});

app.post('/start/process', check, function(req, res) {

  var sha                   = req.body.sha;
  var reference_name        = req.body.reference_name || 'Manual Build ' + sha;
  var reference_description = req.body.reference_description || '';
  var environment           = req.body.environment || 'development';
  var max_attempts          = req.body.max_attempts || 5;

  getPort(function(err, availablePort) {

    if (err && !availablePort) { 
      if (!availablePort) GLOBAL.messages.push({ type: 'warning', copy: 'No Ports Available to start build.' });
      if (err) GLOBAL.messages.push({ type: 'error', copy: err.message });
      
      return res.redirect('/list');
    }

    var appFolder = __dirname + '/tmp/' + sha + '';
    var options = { 
      max:       max_attempts, 
      logfile:   appFolder + '/forever_all.log',
      append:    true,
      checkFile: true,
      fork:      false,
      sourceDir: appFolder, 
      env:       { NODE_ENV: environment, PORT: availablePort },

      // User defined Values.
      ui_name:        reference_name,
      ui_sha:         sha,
      ui_port:        availablePort,
      ui_description: reference_description,
      ui_owner:       req.session.user.github.name
    };

    var exec = require('child_process').exec;
    function puts(error, stdout, stderr) { 
      GLOBAL.messages.push({ type: 'info', copy: 'CD to ' + appFolder });
      GLOBAL.messages.push({ type: 'info', copy: 'Completed NPM Install for ' + sha });
      GLOBAL.messages.push({ type: 'info', copy: 'Starting site process for ' + sha });

      var childProcess = forever.startDaemon('server.js', options);
      forever.startServer(childProcess);

      GLOBAL.messages.push({ type: 'info', copy: 'Starting a site on port ' + availablePort + ' for SHA ' + sha })
    }

    exec('cd ' + appFolder + ';npm install', puts);

    GLOBAL.messages.push({ type: 'info', copy: 'Starting NPM install and build process. ' + availablePort + ' for SHA ' + sha });
    GLOBAL.messages.push({ type: 'info', copy: 'Site will not show until complete. Fresh a few times...' })

    res.redirect('/list');
  });

});

app.get('/stop/:uid', check, function(req, res) {

  var uid = req.params.uid;

  getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to stop.'});
      res.redirect('/list');
      return;
    }

    forever.stop(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Stopping the build process.'});
    res.redirect('/list');
  });


});

app.get('/restart/:uid', check, function(req, res) {

  var uid = req.params.uid;

  getProcessIndexbyID(uid, function(err, processIndex) {

    if (err || !processIndex) {
      GLOBAL.messages.push({ type: 'error', copy: 'Unable to find the process to restart.'});
      res.redirect('/list');
      return;
    }

    forever.restart(processIndex);

    GLOBAL.messages.push({ type: 'info', copy: 'Restarting and existing process.'});
    res.redirect('/list');
  });

});



app.get('/cleanup', check, function(req, res) {

  forever.cleanUp();

  GLOBAL.messages.push({ type: 'info', copy: 'Running the forever cleanup processes.'});

  res.redirect('/list');
});

app.get('/git', check, routes.github.commits );

app.get('/list', check, function(req, res) {

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
  })
});

app.get('/tail/:uid', check, function(req, res) {

  var uid = req.params.uid;

  getProcessIndexbyID(uid, function(err, processIndex) {

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

});

var getProcessIndexbyID = function(uid, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var UIDs = [];
    _.each(data, function(o) { UIDs.push(o.uid); });

    var indexNum = _.indexOf(UIDs, uid);

    if (indexNum == -1) indexNum = null;

    cb(null, indexNum);
  })

}

var getProcessByID = function(uid, cb) {

  forever.list(false, function (err, data) {
    if (err) return cb(err);

    var element = _.find(data, function(o) { return o.uid == uid;});
    cb(null, element);
  })

}

app.get('/detail/:id', check, function(req, res) {
  
  var uid = req.params.id;

  getProcessByID(uid, function(err, process) {

    res.render('detail', { data: process } );
  });

  // forever.list(false, function (err, data) {

  //   var element = _.find(data, function(o) {
  //     return o.uid == uid;
  //   });

  //   res.render('detail', { data: element } );
  // });

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
