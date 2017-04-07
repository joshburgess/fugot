import test from 'ava'
import pem from 'pem'
import pify from 'pify'
import fugot from '../'
import {createServer, createSSLServer} from './helpers/server'

let http
let https

const pemP = pify(pem, Promise)

test.before('setup', async () => {
  const caKeys = await pemP.createCertificate({
    days: 1,
    selfSigned: true
  })

  const caRootKey = caKeys.serviceKey
  const caRootCert = caKeys.certificate

  const keys = await pemP.createCertificate({
    serviceCertificate: caRootCert,
    serviceKey: caRootKey,
    serial: Date.now(),
    days: 500,
    country: '',
    state: '',
    locality: '',
    organization: '',
    organizationUnit: '',
    commonName: 'sindresorhus.com'
  })

  const key = keys.clientKey
  const cert = keys.certificate

  https = await createSSLServer({key, cert}) // eslint-disable-line object-property-newline

  https.on('/', (req, res) => {
    res.end('https')
  })

  http = await createServer()

  http.on('/', (req, res) => {
    res.end('reached')
  })

  http.on('/finite', (req, res) => {
    res.writeHead(302, {
      location: `${http.url}/`
    })
    res.end()
  })

  http.on('/utf8-url-áé', (req, res) => {
    res.end('reached')
  })

  http.on('/redirect-with-utf8-binary', (req, res) => {
    res.writeHead(302, {
      location: new Buffer(`${http.url}/utf8-url-áé`, 'utf8').toString('binary')
    })
    res.end()
  })

  http.on('/endless', (req, res) => {
    res.writeHead(302, {
      location: `${http.url}/endless`
    })
    res.end()
  })

  http.on('/relative', (req, res) => {
    res.writeHead(302, {
      location: '/'
    })
    res.end()
  })

  http.on('/relativeQuery?bang', (req, res) => {
    res.writeHead(302, {
      location: '/'
    })
    res.end()
  })

  http.on('/httpToHttps', (req, res) => {
    res.writeHead(302, {
      location: https.url
    })
    res.end()
  })

  await http.listen(http.port)
  await https.listen(https.port)
})

test.cb('follows redirect', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
      t.end()
    })
})

test.cb('does not follow redirect when disabled', t => {
  fugot(`${http.url}/finite`, {followRedirect: false})
    .map(x => x.statusCode)
    .fork(t.falsy, (code) => {
      t.is(code, 302)
      t.end()
    })
})

test.cb('relative redirect works', t => {
  fugot(`${http.url}/relative`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
      t.end()
    })
})

test.cb('throws on endless redirect', t => {
  fugot(`${http.url}/endless`)
    .fork((error) => {
      t.is(error.message, 'Redirected 10 times. Aborting.')
      t.end()
    }, t.falsy)
})

test.cb('query in options are not breaking redirects', t => {
  fugot(`${http.url}/relativeQuery`, {query: 'bang'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
      t.end()
    })
})

test.cb('hostname+path in options are not breaking redirects', t => {
  fugot(`${http.url}/relative`, {
    hostname: http.host,
    path: '/relative'
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
      t.end()
    })
})

test.cb('redirect only GET and HEAD requests', t => {
  fugot(`${http.url}/relative`, {body: 'hello'})
    .fork((error) => {
      t.is(error.message, 'Response code 302 (Found)')
      t.is(error.path, '/relative')
      t.is(error.statusCode, 302)
      t.end()
    }, t.falsy)
})

test.cb('redirects from http to https works', t => {
  fugot(`${http.url}/httpToHttps`, {rejectUnauthorized: false})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.truthy(body)
      t.end()
    })
})

// test.cb('redirects works with lowercase method', t => {
//   fugot(`${http.url}/httpToHttps`, {method: 'head'})
//     .map(x => x.body)
//     .fork(t.falsy, (body) => {
//       t.is(body, '')
//       t.end()
//     })
// })

test.cb('redirect response contains new url', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.url)
    .fork(t.falsy, (url) => {
      t.is(url, `${http.url}/`)
      t.end()
    })
})

test.cb('redirect response contains old url', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.requestUrl)
    .fork(t.falsy, (requestUrl) => {
      t.is(requestUrl, `${http.url}/finite`)
      t.end()
    })
})

test.cb('redirect response contains utf8 with binary encoding', t => {
  fugot(`${http.url}/redirect-with-utf8-binary`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
      t.end()
    })
})

test.after('cleanup', async () => {
  await http.close()
  await https.close()
})
