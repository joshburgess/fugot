import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.end('ok')
  })

  s.on('/404', (req, res) => {
    res.statusCode = 404
    res.end('not found')
  })

  await s.listen(s.port)
})

test('promise mode', async t => {
  fugot(s.url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
    })

  fugot(`${s.url}/404`)
    .fork((error) => {
      t.is(error.statusCode, 404)
      t.is(error.response.body, 'not found')
    }, t.falsy)

  fugot('.com', {retries: 0})
    .fork((error) => {
      t.truthy(error)
    }, t.falsy)
})

test.after('cleanup', async () => {
  await s.close()
})
