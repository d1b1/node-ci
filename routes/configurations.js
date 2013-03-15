var db         = require('../db');
var mongodb    = require('mongodb');
var util       = require('./util');
var async      = require('async');

exports.list = function(req, res) {

  async.parallel({
    configurations: function(callback) {

      var query = {};
      var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
      collection.find(query).toArray(function(err, results) {
        if (err) return;

        callback(null, results);
      });

    },
    domains: function(callback) {

      var query = {};
      var collection = new mongodb.Collection(DbManager.getDb(), 'domains');
      collection.find(query).toArray(function(err, results) {
        if (err) return;

        callback(null, results);
      });
  
    }
  }, function(err, results) {

    res.render('configurations', { domains: results.domains, configurations: results.configurations });

  });

}

exports.domainAdd = function(req, res) {
  var data = {
    name: '',
    url: '',
    port: '',
    use_port: true
  }
  res.render('domain_edit', { data: data, config_id: null });
}

exports.domainEdit = function(req, res) {
  
  var id = req.params.id;
  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'domains');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.configurations) result.configurations = [];

    res.render('domain_edit', { data: result, config_id: id });
  });

}

exports.add = function(req, res) {
  var data = {
    name: '',
    configurations: [],
    notes: ''
  }
  res.render('configuration_edit', { data: data, config_id: null });
}

exports.edit = function(req, res) {
  
  var id = req.params.id;

  var query = { _id: new mongodb.ObjectID(id) };

  var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
  collection.findOne(query, function(err, result) {
    if (err) return;

    if (!result.configurations) result.configurations = [];

    res.render('configuration_edit', { data: result, config_id: id });
  });

}

exports.domainUpdate = function(req, res) {

  var config_id = req.body.config_id;

  var data = {
    name: req.body.name || 'No Name',
    url:  req.body.url,
    port: req.body.port,
    use_port: req.body.use_port=='true'
  };

  if (!config_id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'domains');
    collection.insert(data, { safe: true}, function(err, result) {
      if (err) {
        console.log(err);
      };

      console.log('Insert', result)
    });

    res.redirect('/configurations');
  } else {

    var query = { _id: new mongodb.ObjectID( config_id ) };

    var collection = new mongodb.Collection(DbManager.getDb(), 'domains');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {

         res.redirect('/configurations');
      });
  }

}

exports.editUpdate = function(req, res) {

  var config_id = req.body.config_id;

  var config = [];
  for (var i=0; i<20; i++) {
    if (req.body['name_'+i]) {
      config.push({ name: req.body['name_'+i].trim(), value: req.body['value_'+i] || '-' })
    }
  }

  var data = {
    name: req.body.configuration_name || 'No Name',
    configurations: config,
    notes: req.body.configuration_notes || 'No Notes',
    default: req.body.is_default=='true'
  };

  if (!config_id) {

    var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
    collection.insert(data, { safe: true}, function(err, result) {
      if (err) {
        console.log(err);
      };

      console.log('Insert', result)
    });

    res.redirect('/configurations');
  } else {

    var query = { _id: new mongodb.ObjectID( config_id ) };

    var collection = new mongodb.Collection(DbManager.getDb(), 'configurations');
    collection.findAndModify(query, 
      [ ['_id','asc'] ], 
      { $set : data }, 
      { safe: true, new: true }, 
      function(err, result) {

         res.redirect('/configurations');
      });
  }

}