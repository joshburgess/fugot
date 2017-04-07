import zlib from 'zlib'
import test from 'ava'
import fugot from '../'
import {createServer} from './helpers/server'

const testContent = 'Compressible response content.\n'

let s

test.before('setup', async () => {
  s = await createServer()

  s.on('/', (req, res) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Encoding', 'gzip')

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    zlib.gzip(testContent, (_, data) => res.end(data))
  })

  s.on('/corrupted', (req, res) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Encoding', 'gzip')
    res.end('Not gzipped content')
  })

  s.on('/missing-data', (req, res) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Content-Encoding', 'gzip')
    zlib.gzip(testContent, (_, data) => res.end(data.slice(0, -1)))
  })

  await s.listen(s.port)
})

test.cb('decompress content', t => {
  fugot(s.url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, testContent)
      t.end()
    })
})

test.cb('handles gzip error', t => {
  fugot(`${s.url}/corrupted`)
    .fork((error) => {
      t.is(error.message, 'incorrect header check')
      t.is(error.path, '/corrupted')
      t.is(error.name, 'ReadError')
      t.end()
    }, t.falsy)
})

test.cb('preserve headers property', t => {
  fugot(s.url)
    .map(x => x.headers)
    .fork(t.falsy, (headers) => {
      t.truthy(headers)
      t.end()
    })
})

test.cb('do not break HEAD responses', t => {
  fugot.head(s.url)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
      t.end()
    })
})

test.cb('ignore missing data', t => {
  fugot(`${s.url}/missing-data`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, testContent)
      t.end()
    })
})

test.cb('has url and requestUrl properties', t => {
  fugot(s.url)
    .fork(t.falsy, (res) => {
      t.truthy(res.url)
      t.truthy(res.requestUrl)
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
