var express    = require('express'),
    connect    = require('connect'),
    fs         = require('fs'),
    sys        = require('sys'),
    path       = require('path'),
    forever    = require('forever'),
    GitHubApi = require("node-github"); 

var github = new GitHubApi({
    version: "3.0.0"
});

github.authenticate({
    type: "basic",
    username: 'd1b1',
    password: 'ambereen'
});

var app = express();
app.configure(function() {
  app.set('port', process.env.PORT || 3005);
  app.set('views', __dirname + '/views');
  app.set('view options', { layout: true, pretty: true });
  app.set('view engine', 'jade');

  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);

  // Catch all traffic not handled and send to the index.html.
  app.use('/', express.static(path.join(__dirname, '/')));
  app.use(function(req, res){
    res.render('index', { title: 'Home' });
  });

});

app.get('/restart/:target', function(req, res) {

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

app.get('/git', function(req, res) {

  github.repos.getCommits({ user: 'd1b1', repo: 'composer'}, function(err, data) {
    if (err) return res.send(err);

    console.log(JSON.stringify(data));
    res.send(data);
  });

});

app.get('/list', function(req, res) {
  forever.list(false, function (err, data) {
    if (err) {
      // console.log('Error running `forever.list()`');
      // console.dir(err);
    }

    res.render('list', { data: data } );
  })
});

app.get('/tail/:id', function(req, res) {

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

app.get('/detail/:id', function(req, res) {
  
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

app.get('/all', function(req, res) {
  forever.list(false, function (err, data) {
    if (err) {
      // console.log('Error running `forever.list()`');
      // console.dir(err);
    }
    
    console.dir(data)
    res.send(data);
  })
});

app.get('/test', function(req, res) {
  res.send('Test Page');
});

app.post('/build', function(req, res) {

  var pl = JSON.parse(req.body.payload);
  var exec = require('child_process').exec;
  var execstr = "/var/www/composer/manager/getCommitCode.sh <<MARK "+pl.before+"\ "+pl.after+"\ "+pl.ref+"\ MARK";

  console.log("Running", execstr);

  function puts(error, stdout, stderr) { sys.puts(stdout) }
  exec(execstr, puts);

});

// ------------------------------------------------------------------------------------

var port = process.env.PORT || 3005;
app.listen(port, function() { 
  console.log('StartUp: Github Webhook Manager ' + port ); 
});
