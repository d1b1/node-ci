var events = require('events');

module.exports = CI;

function CI() {
  events.EventEmitter.call(this);
}

// inherit events.EventEmitter
CI.super_ = events.EventEmitter;
CI.prototype = Object.create(events.EventEmitter.prototype, {
  constructor: {
    value: CI,
    enumerable: false
  }
});

CI.prototype.prebuilding = function(step) {

  var self = this;
  self.server = server;

  self.prebuild = prebuild();
  self.prebuild(server, function(data) {
    self.emit('prebuild', self.server)
  });

  self.postbuild = postbuild();
  self.postbuild(server, function(data) {
    self.emit('postbuild', self.server)
  });

  return self;
}