#SensorCentral#


## Migration from release to release ##
1. Create branch
2. Push to github and create new pull request which in turn creates a review app on Heroku. Note number of pull request as it names the app on Heroku.
3. Edit `app.json` and set the `OIDC_REDIRECT_URI` variable for the review app to the matching Heroku url to ensure OIDC works in development.
4. Continue working to finish the release.

### Moving to staging ###
1. Ensure version has been correctly set in `package.json`
2. If there are schema changes to the database: Scale the web dynos to 0 using `heroku ps:scale web=0`
3. Squash and merge the pull request into master which will cause a deployment to staging
4. Update git locally
    1. Change branch to `master` (`git checkout master`) 
    2. Pull `master` (`git pull origin master`)
    3. Delete pull request branch (`git branch -d <name>`)
5. If there are schema changes to the database: Set the `DATABASE_URL` in the local `.env` file and run the schema migration tool (use `heroku config --shell --app <name>` to fetch config)
6. If there are schema changes to the database: Scale the web dynos to 0 using `heroku ps:scale web=1`

### Moving to production ###
1. Scale the web dynos to 0 using `heroku ps:scale web=0`
2. If there are schema changes to the database: Set the `DATABASE_URL` in the local `.env` file and run the schema migration tool (use `heroku config --shell --app <name>` to fetch config)
3. Propagate from staging to production using `heroku pipelines:promote --app <name>`
4. Scale the web dynos to 1 using `heroku ps:scale web=1`


## Test data ##

### Smart.me ###
clientId = smartme-client-1
username = cc8f022c-77b0-40de-8595-fb9c5ebb2e0b
password = 540f779b-6315-4e46-8ff6-4c57f4980609
sensorId = 94f7a0f4-d85b-4815-9c77-833be7c28779
