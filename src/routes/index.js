// import router
const siteRouter = require('./siteRouter')
const adminRouter = require('./adminRouter')
const notificationRouter = require('./notificationRouter')
const accountRouter = require('./accountRouter')
const authRouter = require('./authRouter')
const orderRouter = require('./orderRouter')
const searchRouter = require('./searchRouter')
const generalRouter = require('./generalRouter')
const trackClicksRouter = require('./trackClicksRouter')
const recommendationRouter = require('./recommendationRouter')

function route(app) {

  app.use('/admin', adminRouter)
  app.use('/search', searchRouter)
  app.use('/order', orderRouter)
  app.use('/auth', authRouter)
  app.use('/notification', notificationRouter)
  app.use('/account', accountRouter)
  app.use('/general', generalRouter)
  app.use('/api/recommendation', recommendationRouter)
  app.use('/', siteRouter)
  app.use('/api', trackClicksRouter)
  app.use((req, res) => {
    res.status(404).redirect('/error');
  });
}

module.exports = route