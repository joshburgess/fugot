import test from 'ava'
import intoStream from 'into-stream'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.setHeader('method', req.method)
    req.pipe(res)
  })

  s.on('/headers', (req, res) => {
    res.end(JSON.stringify(req.headers))
  })

  s.on('/empty', (req, res) => {
    res.end()
  })

  await s.listen(s.port)
})

test.cb('sends null-prototype objects', t => {
  fugot(s.url, {body: Object.create(null)})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('sends plain objects', t => {
  fugot(s.url, {body: {}})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('sends non-plain objects', t => {
  class Obj {}

  fugot(s.url, {body: new Obj()})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('sends strings', t => {
  fugot(s.url, {body: 'hello'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'hello')
      t.end()
    })
})

test.cb('sends Buffers', t => {
  fugot(s.url, {body: new Buffer('hello')})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'hello')
      t.end()
    })
})

test.cb('sends Streams', t => {
  fugot(s.url, {body: intoStream(['hello'])})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'hello')
      t.end()
    })
})

test.cb('works with empty post response', t => {
  fugot(`${s.url}/empty`, {body: 'hello'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('content-length header with string body', t => {
  fugot(`${s.url}/headers`, {body: 'hello', json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], '5')
      t.end()
      t.end()
    })
})

test.cb('content-length header with Buffer body', t => {
  fugot(`${s.url}/headers`, {body: new Buffer('hello'), json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], '5')
      t.end()
    })
})

test.cb('content-length header with Stream body', t => {
  fugot(`${s.url}/headers`, {
    body: intoStream(['hello']),
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], undefined)
      t.end()
    })
})

test.cb('content-length header is not overriden', t => {
  fugot(`${s.url}/headers`, {
    body: 'wow',
    json: true,
    headers: {
      'content-length': '10'
    }
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], '10')
      t.end()
    })
})

test.cb('content-length header disabled for chunked transfer-encoding', t => {
  fugot(`${s.url}/headers`, {
    body: '3\r\nwow\r\n0\r\n',
    json: true,
    headers: {
      'transfer-encoding': 'chunked'
    }
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], undefined)
      t.end()
    })
})

test.cb('object in options.body treated as querystring', t => {
  class Obj {
    constructor () {
      this.hello = 'bye'
    }

    get ouch () {
      return 'yay'
    }
  }

  fugot(s.url, {body: new Obj()})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'hello=bye')
      t.end()
    })
})

test.cb('content-type header is not overriden when object in options.body', t => {
  fugot(`${s.url}/headers`, {
    headers: {
      'content-type': 'hello'
    },
    body: {
      name: 'juan'
    },
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-type'], 'hello')
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
