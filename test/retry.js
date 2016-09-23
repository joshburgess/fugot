import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

let s
let trys = 0
let knocks = 0
let fifth = 0

test.before('setup', async () => {
  s = await createServer()

  s.on('/long', () => {})

  s.on('/knock-twice', (req, res) => {
    if (knocks++ === 1) {
      res.end('who\'s there?')
    }
  })

  s.on('/try-me', () => {
    trys++
  })

  s.on('/fifth', (req, res) => {
    if (fifth++ === 5) {
      res.end('who\'s there?')
    }
  })

  await s.listen(s.port)
})

test('works on timeout error', t => {
  fugot(`${s.url}/knock-twice`, {timeout: 100})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'who\'s there?')
    })
})

test('can be disabled with option', t => {
  fugot(`${s.url}/try-me`, {timeout: 500, retries: 0})
    .map(x => x.body)
    .fork((error) => {
      t.truthy(error)
      t.is(trys, 1)
    }, t.falsy)
})

test('function gets iter count', t => {
  fugot(`${s.url}/fifth`, {
    timeout: 100,
    retries: iter => iter < 10
  })
    .fork(t.falsy, () => {
      t.is(fifth, 6)
    })
})

test('falsy value prevents retries', t => {
  fugot(`${s.url}/long`, {
    timeout: 100,
    retries: () => 0
  })
    .fork((error) => {
      t.truthy(error)
    }, t.falsy)
})

test('falsy value prevents retries #2', t => {
  fugot(`${s.url}/long`, {
    timeout: 100,
    retries: (iter, err) => {
      t.truthy(err)
      return false
    }
  })
    .fork((error) => {
      t.truthy(error)
    }, t.falsy)
})

test.after('cleanup', async () => {
  await s.close()
})
