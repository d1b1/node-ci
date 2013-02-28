### Node CI Server

This is a UI to support node.js development. It provides the ability to run multiple node processes, using either a
git repo branch HEAD (persistent), or commit specific builds. Persistent branch builds are kept up to date with each
commit using a github Web hook. Commit specific builds are managed by the UI and redesigned to support QA review
and testing. 

* Provide a front end for the forever node service.
* Github integration.
* CI hooks for testing.

#### Configuration
The following configuration options will enabled at the CLI.

* Port Range (required) - Defines ports available for new processes. Defaults to 3010 to 3020. 
* Repo Name (required) - Name of the public or private repo.
* Repo Owner (required) - Name of the repo owner. Needed for github api activity.
* Github Application (required) - Github API client ID and secret keys.
* Base Domain (beta) - Domain that support wildcard subdomains.
* Log Path (beta) - Base path for all log file.
* Repo Build Path (beta) - Base path for storage of repo builds. Defaults to /tmp in the working folder.

#### Setup
Clone the repo to a working folder. Start with either `node web.js` or `forever start web.js`. The process will bind to 
port 3005. All log files drop in the install folder.
 
#### CLI
This application builds upon the work done by [Charlie Robbins](http://github.com/indexzero) and the forever/forever-monitor projects. 
The UI interface will forever CLI activity. The current forever process lacks a few helper features needed to make the UI attach to the correct
process. For this reason this project uses a fork of the forever and forever-monitor projects.

* Fork - https://github.com/d1b1/forever-monitor
* Fork - https://github.com/d1b1/forever

#### Roadmap (in Progress)
The following is a list of features still in development.

* Strict github login to organization team members.
* Implement the Base Domain configuration
* Impliment the Log Path configuration.
* Impliment the Repo Build Path configuration.
* Impliment the startup config options in a mongod db.
* Better domain to port mapping.
* Better early failure and messaging of process changes.
* Public metric report. (code coverage etc).

#### Roadmap (Planned)
The following is a list of features will build upon the base UI.

* Persistent NPM testing and UI using Mongodb.
* Persisent testing metrics and storage.
* Persistent Session storage.
* Alters to members on error, build etc.

#### License: MIT
#### Author: [Stephan Smith](http://github.com/d1b1)
