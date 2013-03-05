var express    = require('express'),
    mongoStore = require('connect-mongodb'),
    fs         = require('fs'),
    argv       = require('optimist').argv;

 var routes = require('./routes/index');

AppManager = (function() {

    var port = argv.port || process.env.PORT || 3005;

    var configureApp = function(app, db) {

      app.configure(function() {

          app.set('port', port);
          app.set('views', __dirname + '/views');
          app.set('view options', { layout: true, pretty: true });
          app.set('view engine', 'jade');

          app.use(express.logger('dev'));
          app.use(express.bodyParser());
          app.use(express.methodOverride());
          app.use(express.cookieParser('Node-CI'));

          var moment = require('moment');
          GLOBAL.app_start_timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

          app.use(function(req, res, next) {
            var url = require('url');
            var queryURL = url.parse(req.url, true);
            req.urlparams = queryURL.query;
            next();
          });

          console.log(db);
          // Set the Session Storage.
          app.use(express.session({
            store: new mongoStore({ reapInterval: 600000, db: db }),
            secret: 'node-ci'
          }));

          app.use(function(req, res, next) {
            app.locals.session = req.session;
            app.locals.page = { title: '' }
            next();
          });

          app.use(app.router);

          app.locals.moment    = require('moment');
          app.locals._         = require('underscore');
          app.locals.messages  = [];
          app.locals.urlparams = {};

          // Needed by all environments.
          app.use('/', express.static(__dirname + '/'));

          app.use(routes.ci.listProcesses);
        });
    };

    var configureRoutes = function(app) {

      var routes = require('./routes/index');

      var check = function(req, res, next ) {
        if (req.session.user && req.session.user.logged_in) {
          next();
        } else {
          res.render('login', { session: req.session, params: { message: '', goto: req.url }, title: 'Home' });
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
      // app.post('/build',                  routes.ci.catchCommitPayload);
      app.post('/build',                routes.ci.catchCommitPayloadv2);

      app.get('/force',                   routes.ci.forceHook);
    };

    return {
      start: function(db) {
        var app = module.exports = express();

        configureApp(app, db);

        configureRoutes(app);

        app.listen(port);

        console.log("Staring Express Server on port %d in %s mode", port, app.settings.env);
        return app;
      }
    };
})();

exports.AppManager = AppManager;