# SensorCentral #


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
5. If there are schema changes to the database: Set the `DATABASE_URL` in the local `.env` file and run the schema migration tool (use `heroku config --shell --app <name>` to fetch config). You might need to set `DATABASE_SSL=true` in your `.env` to ensure we connect with TLS to Postgres.
6. Perform any manual steps described in a `manualsteps_<from version>_to_<to version>.sql`file
7. If there are schema changes to the database run the `src/postdeploy/create_database.ts` script to update schema
8. Change `DATABASE_URL` in the `.env` file back
9. Scale the web dynos to 1 using `heroku ps:scale web=1 --app <name>`

### Moving to production ###
1. Scale the web dynos to 0 using `heroku ps:scale web=0`
2. If there are schema changes to the database: Set the `DATABASE_URL` in the local `.env` file and run the schema migration tool (use `heroku config --shell --app <name>` to fetch config)
3. Perform any manual steps described in a `manualsteps_<from version>_to_<to version>.sql`file
4. Propagate from staging to production using `heroku pipelines:promote --app <name>`
5. Scale the web dynos to 1 using `heroku ps:scale web=1`


## Test data ##

### Smart.me ###
clientId = smartme-client-1
username = cc8f022c-77b0-40de-8595-fb9c5ebb2e0b
password = 540f779b-6315-4e46-8ff6-4c57f4980609
sensorId = 94f7a0f4-d85b-4815-9c77-833be7c28779

## Change Log ##

### Functionality ideas ###
* On device page allow user to change watch dog settings incl. set custom date/time for "not until" for the watchdog
* "Widget" to graph multiple gauge sensors together
* Implement average graphs for gauge sensors (select avg(value), to_timestamp((floor(extract('epoch' from dt) / 86400)) * 86400) at time zone 'utc' as interval_alias from sensor_data where id='28FF46C76017059A' and dt > to_date('20200101', 'YYYYMMDD') and dt < to_date('20200201', 'YYYYMMDD') group by interval_alias order by interval_alias)

### 1.7.6 ###
* Fix issue where stacked delta widget showed sensors from all houses the user had access to

### 1.7.5 ###
* Use ts-node when running app instead of transpiling typescript to javascript first
* Power prices using nordpool-node npm package (https://github.com/samuelmr/nordpool-node), pipe through cache layer in Redis that caches. Allow user to select arbitrary date for power data. Allow user to export power data shown to CSV.
* Prometheus scrapedata endpoint moved to /api/v1/scrapedata and requires authentication
* Move to a "house"-selector model so you select a house and work for that house - that will make power graphs more logical to use. "House"-selector in the user-dropdown.
* Add house owner
* Allow house owner to add / remove users to their house
* Verify access to houses and date on requests
* Device JWT's now contain both deviceid and the userid of the user who issued the JWT to ensure that the device can only impersonate that user
* Set a house as default and that will be shown on login
* Hide widget data on front page if no data for the widget
* Allow issue of JWT for "all access user" through API

### 1.6.7 ###
* Remove "Hello <name>" on frontpage
* Use scale factor on front page
