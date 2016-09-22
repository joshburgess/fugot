import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.end('{"data":"dog"}')
  })

  s.on('/invalid', (req, res) => {
    res.end('/')
  })

  s.on('/no-body', (req, res) => {
    res.statusCode = 200
    res.end()
  })

  s.on('/non200', (req, res) => {
    res.statusCode = 500
    res.end('{"data":"dog"}')
  })

  s.on('/non200-invalid', (req, res) => {
    res.statusCode = 500
    res.end('Internal error')
  })

  await s.listen(s.port)
})

test('parses response', t => {
  fugot(s.url, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.deepEqual(body, {data: 'dog'})
    })
})

test('does not parses responses without a body', t => {
  fugot(`${s.url}/no-body`, {json: true})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
    })
})

test('wraps parsing errors', t => {
  fugot(`${s.url}/invalid`, {json: true})
    .fork((error) => {
      t.regex(error.message, /Unexpected token/)
      t.true(error.message.indexOf(error.hostname) !== -1, error.message)
      t.is(error.path, '/invalid')
    }, t.falsy)
})

test('parses non-200 responses', t => {
  fugot(`${s.url}/non200`, {json: true})
    .fork((error) => {
      t.deepEqual(error.response.body, {data: 'dog'})
    }, t.falsy)
})

test('catches errors on invalid non-200 responses', t => {
  fugot(`${s.url}/non200-invalid`, {json: true})
    .fork((error) => {
      t.regex(error.message, /Unexpected token/)
      t.is(error.response.body, 'Internal error')
      t.is(error.path, '/non200-invalid')
    }, t.falsy)
})

test('should have statusCode in err', t => {
  fugot(`${s.url}/non200-invalid`, {json: true})
    .fork((error) => {
      t.is(error.statusCode, 500)
    }, t.falsy)
})

test.after('cleanup', async () => {
  await s.close()
})
