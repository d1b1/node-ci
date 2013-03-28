var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');
var moment     = require('moment');

exports.list = function(req, res) {

  var term = req.urlparams.term;

  async.parallel({
    tests: function(callback) {

      var query = {};

      if (term) {
        query = { 
          name : { $regex :  term, $options: '-i'}
        };
      }

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find(query, { sort: { group: 1 } }).toArray(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    total: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find({}).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    completed: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
      collection.find({ status: { $ne: 'Pending' }}).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    }
  }, function(err, results) {

    var data = {
      total:   results.total,
      pending: results.completed,
      complete: Math.round(100 * (results.completed / results.total))
    };

    res.render('runs', { tests: results.tests, term: term, stats: data });

  });

}

exports.add = function(req, res) {

  var data = {
    name:  '',
    notes: '',
    sha:   ''
  };

  res.render('runs_edit', { data: data, id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
  collection.findOne(query, function(err, result) {
    if (err) return;

    res.render('runs_edit', { data: result, id: id });
  });

}

exports.update = function(req, res) {

  var id = req.body.id;
  var mdate;

  var date = req.body.date;
  if (!date) {
    mdate = moment();
  } else {
    mdate = moment(date);
  }

  var data = {
    name:      req.body.name || 'No Name',
    notes:     req.body.notes,
    sha:       req.body.sha,
    date:      mdate.unix() * 1000
  };

  if (!id) {
    data.createdby = req.session.user.github.login;
    data.created = moment().unix() * 1000;
  } else {
    data.modifiedby = req.session.user.github.login;
    data.modified = moment().unix() * 1000;
  }

  var collection = new mongodb.Collection(DbManager.getDb(), 'runs');

  if (!id) {
    collection.insert(data, { safe: true}, function(err, result) {
      console.log('Insert', result);
      res.redirect('/runs');
    });
  } else {
    collection.findAndModify({ _id: new mongodb.ObjectID( id ) }, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect('/runs');
      });
  }

}

exports.delete = function(req, res) {

  var id = req.params.id;
  var collection = new mongodb.Collection(DbManager.getDb(), 'runs');
  var query = { _id: new mongodb.ObjectID(id) };
  collection.remove(query, function(err, result) {
     res.redirect('/runs');
  });

}

