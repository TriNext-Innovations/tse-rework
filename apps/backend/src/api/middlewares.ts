import { authenticate, defineMiddlewares } from '@medusajs/framework/http'

export default defineMiddlewares({
  routes: [
    {
      // A B2B application must come from a signed-in customer: approval means
      // adding that customer account to the B2B group, which is impossible
      // without an account. Signed-out requests get a 401.
      matcher: '/store/b2b/apply',
      method: ['POST'],
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
  ],
})
