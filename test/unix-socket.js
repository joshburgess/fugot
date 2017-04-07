import {format} from 'util'
import tempy from 'tempy'
import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

const socketPath = tempy.file({extension: '.socket'})

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.end('ok')
  })

  await s.listen(socketPath)
})

test.cb('works', t => {
  const url = format('http://unix:%s:%s', socketPath, '/')

  fugot(url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
      t.end()
    })
})

test.cb('protocol-less works', t => {
  const url = format('unix:%s:%s', socketPath, '/')

  fugot(url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'ok')
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
