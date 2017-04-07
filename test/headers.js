import test from 'ava'
import FormData from 'form-data'
import fugot from '../'
import pkg from '../package'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    req.resume()
    res.end(JSON.stringify(req.headers))
  })

  await s.listen(s.port)
})

test.cb('user-agent', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['user-agent'], `${pkg.name}/${pkg.version} (https://github.com/sotojuan/fugot)`)
      t.end()
    })
})

test.cb('accept-encoding', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['accept-encoding'], 'gzip,deflate')
      t.end()
    })
})

test.cb('accept header with json option', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body.accept, 'application/json')
      t.end()
    })

  fugot(s.url, {
    headers: {
      accept: ''
    },
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body.accept, '')
      t.end()
    })
})

test.cb('host', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body.host, `localhost:${s.port}`)
      t.end()
    })
})

test.cb('transform names to lowercase', t => {
  fugot(s.url, {
    headers: {
      'USER-AGENT': 'test'
    },
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['user-agent'], 'test')
      t.end()
    })
})

test.cb('zero content-length', t => {
  fugot(s.url, {
    headers: {
      'content-length': 0
    },
    body: 'sup',
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-length'], '0')
      t.end()
    })
})

test.cb('form-data manual content-type', t => {
  const form = new FormData()
  form.append('a', 'b')

  fugot(s.url, {
    headers: {
      'content-type': 'custom'
    },
    body: form,
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-type'], 'custom')
      t.end()
    })
})

test.cb('form-data automatic content-type', t => {
  const form = new FormData()
  form.append('a', 'b')

  fugot(s.url, {
    body: form,
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-type'], `multipart/form-data; boundary=${form.getBoundary()}`)
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
