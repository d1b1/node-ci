
exports.login = function(req, res){

  if (req.session.user && req.session.user.logged_in) {
    res.redirect('/');
  } else {
    res.render('login', { params: { goto: '', message: '' }, title: 'Home', hidesearch: '' });
  }

};

exports.logout = function(req, res){

  delete req.session.user;
  req.session.logged_in = false;
  
  res.redirect('/')
};
