import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.statusCode = 404
    res.end()
  })

  s.on('/test', (req, res) => {
    res.end(req.url)
  })

  s.on('/?test=wow', (req, res) => {
    res.end(req.url)
  })

  await s.listen(s.port)
})

test('url is required', t => {
  fugot()
    .fork((error) => {
      t.regex(error.message, /Parameter `url` must be a string or object, not undefined/)
    }, t.falsy)
})

test('options are optional', t => {
  fugot(`${s.url}/test`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '/test')
    })
})

test('accepts url.parse object as first argument', t => {
  fugot({
    hostname: s.host,
    port: s.port,
    path: '/test'
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '/test')
    })
})

test('requestUrl with url.parse object as first argument', t => {
  fugot({
    hostname: s.host,
    port: s.port,
    path: '/test'
  })
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/test`)
    })
})

test('overrides querystring from opts', t => {
  fugot(`${s.url}/?test=juan`, {query: {test: 'wow'}})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '/?test=wow')
    })
})

test('should throw with auth in url', t => {
  fugot('https://test:45d3ps453@account.myservice.com/api/token')
  .fork((error) => {
    t.regex(error.message, /Basic authentication must be done with auth option/)
  }, t.falsy)
})

test.after('cleanup', async () => {
  await s.close()
})
