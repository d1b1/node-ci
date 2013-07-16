REPORTER = spec
test:
	 @NODE_ENV=test ./node_modules/.bin/mocha -b --reporter $(REPORTER)

local:
	 heroku config:pull --overwrite
	 format start

.PHONY: test
