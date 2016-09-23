import {format} from 'util'
import tempfile from 'tempfile'
import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

const socketPath = tempfile('.socket')

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.end('ok')
  })

  await s.listen(socketPath)
})

test('works', t => {
  const url = format('http://unix:%s:%s', socketPath, '/')

  fugot(url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
    })
})

test('protocol-less works', async t => {
  const url = format('unix:%s:%s', socketPath, '/')

  fugot(url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
    })
})

test.after('cleanup', async () => {
  await s.close()
})
