
Plugin = (function() {

  var name = "My Special Plugin 1";

  return {
    getName: function() {
      return name;
    }
  }
})();

exports.Plugin1 = Plugin;
