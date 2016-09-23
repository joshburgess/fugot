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

test('user-agent', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['user-agent'], `${pkg.name}/${pkg.version} (https://github.com/sotojuan/fugot)`)
    })
})

test('accept-encoding', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['accept-encoding'], 'gzip,deflate')
    })
})

test('accept header with json option', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body.accept, 'application/json')
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
    })
})

test('host', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body.host, `localhost:${s.port}`)
    })
})

test('transform names to lowercase', t => {
  fugot(s.url, {
    headers: {
      'USER-AGENT': 'test'
    },
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['user-agent'], 'test')
    })
})

test('zero content-length', t => {
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
    })
})

test('form-data manual content-type', t => {
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
      t.is(body['content-length'], 'custom')
    })
})

test('form-data automatic content-type', async t => {
  const form = new FormData()
  form.append('a', 'b')

  fugot(s.url, {
    body: form,
    json: true
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body['content-type'], `multipart/form-data; boundary=${form.getBoundary()}`)
    })
})

test.after('cleanup', async () => {
  await s.close()
})
