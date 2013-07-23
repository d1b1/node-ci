
exports.file = function(req, res) {
	

  res.send('got here' + process.env.SSH_CERT)
}