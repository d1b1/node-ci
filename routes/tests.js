var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');
var moment     = require('moment');

exports.list = function(req, res) {

  var term = req.urlparams.term;

  async.parallel({
    tests: function(callback) {

      var query = {
         runID: { $exists : false }
      };

      if (term) {
        query.name = { $regex :  term, $options: '-i'};
      }

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find(query, { sort: { group: 1 } }).toArray(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    total: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
      collection.find({}).count(function(err, results) {
        if (err) return callback(err, 0);
        callback(null, results);
      });

    },
    completed: function(callback) {

      var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
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

    res.render('tests', { run: null, tests: results.tests, term: term, stats: data });

  });

}

exports.add = function(req, res) {

  var data = {
    name: '',
    notes: '',
    steps: '',
    status: 'Pending',
    claimedby: '',
    group: ''
  };

  res.render('test_edit', { data: data, nextPage: '/tests', test_id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.group)     result.group = '';

    // Define the next page for the test to see.
    var nextPage = '/tests';
    if (result.runID) {
      nextPage = '/runs/' + result.runID.toString() + '/tests';
    }

    res.render('test_edit', { data: result, nextPage: nextPage, test_id: id });
  });

}

exports.update = function(req, res) {

  var test_id = req.body.test_id;

  var data = {
    name:      req.body.name || 'No Name',
    notes:     req.body.notes,
    steps:     req.body.steps,
    priority:  req.body.priority,
    status:    req.body.status,
    claimedby: req.body.claimedby,
    group:     req.body.group
  };

  var nextPage = req.body.nextPage || '/tests';

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
      res.redirect(nextPage);
    });

  } else {

    collection.findAndModify({ _id: new mongodb.ObjectID( test_id ) }, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {
         res.redirect(nextPage);
      });
  }

}

exports.delete = function(req, res) {

  var id = req.params.id;

  var collection = new mongodb.Collection(DbManager.getDb(), 'tests');

  var query = { _id: new mongodb.ObjectID(id) };
  collection.remove(query, function(err, result) {

     res.redirect('/tests');
  });

}

