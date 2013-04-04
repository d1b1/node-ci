Plugin = (function() {

  var name = "My Special Plugin 2";

  return {
    getName: function() {
      return name;
    }
  }
})();

exports.Plugin2 = Plugin;
