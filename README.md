Node CI Server UI
==============

This is a UI to support node.js development. It provides the ability to run multiple node processes, using either a
git repo branch HEAD (persistent), or commit specific builds. Persistent branch builds are kept up to date with each
commit using a github Web hook. Commit specific builds are managed by the UI and redesigned to support QA review
and testing. 

* Provide a front end for the forever node service.
* Github integration.
* CI hooks for testing.

Configuration
===============

* Port Range (required) - Defines ports available for new processes. Defaults to 3010 to 3020. 
* Repo Name (required) - Name of the public or private repo.
* Repo Owner (required) - Name of the repo owner. Needed for github api activity.
* Github Application (required) - Github API client ID and secret keys.
* Base Domain (beta) - Domain that support wildcard subdomains.
* Log Path (beta) - Base path for all log file.
* Repo Build Path (beta) - Base path for storage of repo builds. Defaults to /tmp in the working folder.

Setup
===============
Clone the repo to a working folder. Start with either `node web.js` or `forever start web.js`. The process will bind to 
port 3005. All log files drop in the install folder.

CLI
===============
This application builds upon the work done by indexZero and the forever/forever-monitor project. The UI interface will
forever CLI activity. The current forever process lacks a few helper features needed to make the UI attach to the correct
process. For this reason this project uses a fork of the forever and forever-monitor projects.

* Fork - https://github.com/d1b1/forever-monitor
* Fork - https://github.com/d1b1/forever

To remove this requirement, you will need to change the package.json to remove the fork dependencies. Please note
this project will not work without the patches made to these projets. 

Roadmap
===============
The following is a list of features still in development.

* Strict github login to organization team members.
* Implement the Base Domain configuration
* Impliment the Log Path configuration.
* Impliment the Repo Build Path configuration.
* Impliment the startup config options in a mongod db.
* Better domain to port mapping.
* Better early failure and messaging of process changes.
* Alters to members.
* Persisent testing metrics and storage.
* Public metric report. (code coverage etc).
