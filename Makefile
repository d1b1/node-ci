REPORTER = spec
test:
	 @NODE_ENV=test ./node_modules/.bin/mocha -b --reporter $(REPORTER)

local:
	 heroku config:pull --overwrite
	 foreman start

.PHONY: test
