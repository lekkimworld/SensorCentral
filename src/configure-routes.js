
module.exports = (app) => {
  app.use('/', require('./routes/post-sensor-data.js'))
  app.use('/', require('./routes/get-root.js'))
}