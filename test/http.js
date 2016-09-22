import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.end('ok')
  })

  s.on('/empty', (req, res) => {
    res.end()
  })

  s.on('/404', (req, res) => {
    setTimeout(() => {
      res.statusCode = 404
      res.end('not')
    }, 10)
  })

  s.on('/?recent=true', (req, res) => {
    res.end('recent')
  })

  await s.listen(s.port)
})

test('simple request', t => {
  fugot(s.url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
    })
})

test('protocol-less URLs', t => {
  fugot(s.url.replace(/^http:\/\//, ''))
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
    })
})

test('empty response', t => {
  fugot(`${s.url}/empty`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
    })
})

test('requestUrl response', t => {
  fugot(s.url)
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
    })

  fugot(`${s.url}/empty`)
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/empty`)
    })
})

test('error with code', t => {
  fugot(`${s.url}/404`)
    .fork((error) => {
      t.is(error.statusCode, 404)
      t.is(error.response.body, 'not')
    }, t.falsy)
})

test('buffer on encoding === null', t => {
  fugot(s.url, {encoding: null})
    .map(x => x.body)
    .fork(t.falsy, (data) => {
      t.truthy(Buffer.isBuffer(data))
    })
})

test('timeout option', t => {
  fugot(`${s.url}/404`, {
    timeout: 1,
    retries: 0
  })
  .fork((error) => {
    t.is(error.code, 'ETIMEDOUT')
  }, t.falsy)
})

test('query option', t => {
  fugot(s.url, {query: {recent: true}})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'recent')
    })

  fugot(s.url, {query: 'recent=true'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'recent')
    })
})

test('requestUrl response when sending url as param', t => {
  fugot(s.url, {hostname: s.host, port: s.port})
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
    })

  fugot({hostname: s.host, port: s.port})
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
    })
})

test.after('cleanup', async () => {
  await s.close()
})
