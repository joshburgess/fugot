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

test.cb('simple request', t => {
  fugot(s.url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
      t.end()
    })
})

test.cb('protocol-less URLs', t => {
  fugot(s.url.replace(/^http:\/\//, ''))
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
      t.end()
    })
})

test.cb('empty response', t => {
  fugot(`${s.url}/empty`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('requestUrl response', t => {
  fugot(s.url)
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
      t.end()
    })

  fugot(`${s.url}/empty`)
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/empty`)
      t.end()
    })
})

test.cb('error with code', t => {
  fugot(`${s.url}/404`)
    .fork((error) => {
      t.is(error.statusCode, 404)
      t.is(error.response.body, 'not')
      t.end()
    }, t.falsy)
})

test.cb('buffer on encoding === null', t => {
  fugot(s.url, {encoding: null})
    .map(x => x.body)
    .fork(t.falsy, (data) => {
      t.truthy(Buffer.isBuffer(data))
      t.end()
    })
})

test.cb('timeout option', t => {
  fugot(`${s.url}/404`, {
    timeout: 1,
    retries: 0
  })
  .fork((error) => {
    t.is(error.code, 'ETIMEDOUT')
    t.end()
  }, t.falsy)
})

test.cb('query option', t => {
  fugot(s.url, {query: {recent: true}})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'recent')
      t.end()
    })

  fugot(s.url, {query: 'recent=true'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'recent')
      t.end()
    })
})

test.cb('requestUrl response when sending url as param', t => {
  fugot(s.url, {hostname: s.host, port: s.port})
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
      t.end()
    })

  fugot({hostname: s.host, port: s.port})
    .map(x => x.requestUrl)
    .fork(t.falsy, (url) => {
      t.is(url, `${s.url}/`)
      t.end()
    })
})

test.cb('response contains url', t => {
  fugot(s.url)
    .fork(t.falsy, (res) => {
      t.is(res.url, `${s.url}/`)
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
