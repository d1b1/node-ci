
exports.list = function(req, res) {

  var data = [
      { repo: 'd1b1/isAPI.js',
        branch: 'master',
        temprepo: 'd1b1/isAPI.js'
      },
      { repo: 'nprds/composer',
        branch: 'master',
        temprepo: 'd1b1/isAPI.js'
      },
      { repo: 'd1b1/composerAPI',
        branch: 'master',
        temprepo: 'd1b1/isAPI.js'
      },
      { repo: 'd1b1/project1',
        branch: 'master',
        temprepo: 'd1b1/isAPI.js'
      },
      { repo: 'd1b1/project2',
        branch: 'master',
        temprepo: 'd1b1/isAPI.js'
      }
    ];

  res.render('quality_report', { data: data })
}