var util = require('./util');

exports.login = function(req, res){

  if (req.session.user && req.session.user.logged_in) {
    res.redirect('/');
  } else {
    res.render('login', { urlparams: req.urlparams, params: { goto: '', message: '' }, title: 'Home', hidesearch: '' });
  }

};

exports.logout = function(req, res){

  if (req.session && req.session.github) {
    util.logNow({ name: 'Logout by ' + session.user.github.name, data: req.session.user });
  }

  delete req.session.user;
  req.session.logged_in = false;
  
  res.redirect('/')
};
