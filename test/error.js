import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.statusCode = 404
    res.end('not')
  })

  await s.listen(s.port)
})

test.cb('properties', t => {
  fugot(s.url)
    .fork((error) => {
      t.truthy(error)
      t.truthy(error.response)
      t.false({}.propertyIsEnumerable.call(error, 'response'))
      t.false({}.hasOwnProperty.call(error, 'code'))
      t.is(error.message, 'Response code 404 (Not Found)')
      t.is(error.host, `${s.host}:${s.port}`)
      t.is(error.method, 'GET')
      t.end()
    }, t.falsy)
})

test.cb('dns message', t => {
  fugot('.com', {retries: 0})
    .fork((error) => {
      t.truthy(error)
      t.regex(error.message, /getaddrinfo ENOTFOUND/)
      t.is(error.host, '.com')
      t.is(error.method, 'GET')
      t.end()
    }, t.falsy)
})

test('options.body error message', t => {
  fugot('.com', {body: () => {}})
    .fork((error) => {
      t.truthy(error)
      t.regex(error.message, /options.body must be a ReadableStream, string, Buffer or plain Object/)
    }, t.falsy)
})

test.after('cleanup', async () => {
  await s.close()
})
