var express    = require('express'),
    connect    = require('connect'),
    fs         = require('fs'),
    path       = require('path'),
    routes     = require('./routes/index');

// Setup Global Message Queue.
GLOBAL.messages = [];
GLOBAL.root     = __dirname;
GLOBAL.config   = require('./config.json');
GLOBAL.configurations = {};

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

  app.use(function(req, res, next) {
    app.locals.session = req.session;
    app.locals.page = { title: '' }
    next();
  });

  app.use(function(req, res, next) {
    var url = require('url');
    var queryURL = url.parse(req.url, true);
    req.urlparams = queryURL.query;
    next();
  });
          
  app.use(app.router);

  // Catch all traffic not handled and send to the index.html.
  app.use('/', express.static(path.join(__dirname, '/')));
  // app.use(function(req, res){
  //   res.render('index', { title: 'Home' });
  // });

  app.use(routes.ci.listProcesses);

});
app.locals.moment   = require('moment');
app.locals._        = require('underscore');
app.locals.messages = [];
app.locals.urlparams = {};

//-------------------------------------------------------------------

var check = function(req, res, next ) {
  if (req.session.user && req.session.user.logged_in) {
    next();
  } else {
    res.render('login', { session: req.session, params: { message: '', goto: req.url }, title: 'Home', hidesearch: '' });
  }
}

// Github Oauth Paths.
app.get('/github_login',            routes.github.login);
app.get('/github_cb',               routes.github.callback);
app.get('/account',          check, routes.github.userinfo);

// Standard Login
app.get('/login',                   routes.session.login);
app.get('/logout',                  routes.session.logout);

// Git Commit Paths.
app.get('/git',              check, routes.github.commits);
app.get('/branches',         check, routes.github.branches);
app.get('/git/commit/:sha',  check, routes.ci.buildCommitSlug);

// Preset Builds
app.get('/head/list',          check, routes.ci.listConfigurations);
app.get('/head/setup/:label',  check, routes.ci.setupConfiguration);

app.get('/plots', check, routes.data.showChart);

app.get('/teams', check, routes.github.teamMembers);

// Process Paths.
app.get('/sites',            check, routes.ci.sites);
app.get('/list',             check, routes.ci.listProcesses);
app.get('/start/:sha',       check, routes.ci.startDialog);
app.post('/start/process',   check, routes.ci.startProcess);
app.get('/stop/:uid/:index', check, routes.ci.stopProcess);
app.get('/restart/:uid',     check, routes.ci.restartProcess);
app.get('/cleanup',          check, routes.ci.cleanupProcesses);
app.get('/tail/:uid',        check, routes.ci.tailProcessLog);
app.get('/detail/:id',       check, routes.ci.processDetail);

app.get('/slug/delete/:id',       check, routes.ci.slugDelete);


// Handles Github Web hooks payloads.
app.post('/build',                  routes.ci.catchCommitPayload);

// ------------------------------------------------------------------------------------

var port = process.env.PORT || 3005;
app.listen(port, function() { 
  console.log('StartUp: Node CI Server ' + port ); 
});
