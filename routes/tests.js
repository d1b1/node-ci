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

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query).toArray(function(err, results) {
        if (err) return;

        callback(null, results);
      });

    }
  }, function(err, results) {

    res.render('tests', { tests: results.tests, term: term });

  });

}

exports.add = function(req, res) {

  var data = {
    name: '',
    notes: '',
    steps: '',
    status: 'Pending',
    claimedby: ''
  };

  res.render('test_edit', { data: data, test_id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.configurations) result.configurations = [];

    res.render('test_edit', { data: result, test_id: id });
  });

}

exports.update = function(req, res) {

  var test_id = req.body.test_id;

  var data = {
    name:     req.body.name || 'No Name',
    notes:    req.body.notes,
    steps:    req.body.steps,
    priority: req.body.priority,
    status:   req.body.status,
    claimedby: req.body.claimedby
  };

  if (!test_id) {
    data.createdby = req.session.user.github.login;
    data.created = moment().unix() * 1000;
  } else {
    data.modifiedby = req.session.user.github.login;
    data.modified = moment().unix() * 1000;
  }

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

  if (!test_id) {

    collection.insert(data, { safe: true}, function(err, result) {
      console.log('Insert', result);
      res.redirect('/tests');
    });

  } else {

    collection.findAndModify({ _id: new mongodb.ObjectID( test_id ) }, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect('/tests');
      });
  }

}

exports.delete = function(req, res) {

  var id = req.params.id;

  console.log(id);

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

  var query = { _id: new mongodb.ObjectID(id) };
  collection.remove(query, function(err, result) {

     res.redirect('/tests');
  });

}

