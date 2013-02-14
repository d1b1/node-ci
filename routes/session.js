exports.login = function(req, res){

  if (req.session.user && req.session.user.logged_in) {
    res.redirect('/account');
  } else {
    res.render('login', { session: req.session, params: { goto: '', message: '' }, title: 'Home', hidesearch: '' });
  }

};

exports.logout = function(req, res){

  delete req.session.user;
  req.session.logged_in = false;
  
  res.redirect('/')
  
  //res.render('login', { session: req.session, params: { goto: '', message: '' }, title: 'Home', hidesearch: '' });
};

exports.loginsubmit = function(req, res) {

  var username = (req.body.username || '').toLowerCase();
  var password = (req.body.password || '');

  var query = { username: username, password: password };

  db.db2(function(client) {
    var collection = new mongodb.Collection(client, 'account');
    collection.findOne(query, function(err, result) {
   
      if (err) {
        res.render('login', { session: req.session, params: { goto: '', message: '' }, title: 'Home', hidesearch: '' });
        return;
      }

      if (!result) {
        res.render('login', { session: req.session, params: { goto: '', message: 'Invalid Username and Password.' }, title: 'Home', hidesearch: '' });
        return;
      }
    
      req.session.logged_in = true;
      req.session.user = {  
        status: true, 
        logged_in: true,
        username: resultData.user.username,
        name: resultData.user.name,
        userid: resultData.user._id,
        email: resultData.user.email
      };

      res.redirect('/')
    });
  });

}