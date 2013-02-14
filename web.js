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
