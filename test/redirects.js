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

test('follows redirect', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
    })
})

test('does not follow redirect when disabled', t => {
  fugot(`${http.url}/finite`, {followRedirect: false})
    .map(x => x.statusCode)
    .fork(t.falsy, (code) => {
      t.is(code, 302)
    })
})

test('relative redirect works', t => {
  fugot(`${http.url}/relative`, {followRedirect: false})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
    })
})

test('throws on endless redirect', t => {
  fugot(`${http.url}/endless`, {followRedirect: false})
    .fork((error) => {
      t.is(error.message, 'Redirected 10 times. Aborting.')
    }, t.falsy)
})

test('query in options are not breaking redirects', t => {
  fugot(`${http.url}/relativeQuery`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
    })
})

test('hostname+path in options are not breaking redirects', t => {
  fugot(`${http.url}/relative`, {
    hostname: http.host,
    path: '/relative'
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
    })
})

test('redirect only GET and HEAD requests', t => {
  fugot(`${http.url}/relative`, {body: 'hello'})
    .fork((error) => {
      t.is(error.message, 'Response code 302 (Found)')
      t.is(error.path, '/relative')
      t.is(error.statusCode, 302)
    }, t.falsy)
})

test('redirects from http to https works', t => {
  fugot(`${http.url}/httpToHttps`, {rejectUnauthorized: false})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.truthy(body)
    })
})

test('redirects works with lowercase method', async t => {
  fugot(`${http.url}/httpToHttps`, {method: 'head'})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, '')
    })
})

test('redirect response contains new url', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.url)
    .fork(t.falsy, (url) => {
      t.is(url, `${http.url}/`)
    })
})

test('redirect response contains old url', t => {
  fugot(`${http.url}/finite`)
    .map(x => x.requestUrl)
    .fork(t.falsy, (requestUrl) => {
      t.is(requestUrl, `${http.url}/finite`)
    })
})

test('redirect response contains utf8 with binary encoding', t => {
  fugot(`${http.url}/redirect-with-utf8-binary`)
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.is(body, 'reached')
    })
})

test.after('cleanup', async () => {
  await http.close()
  await https.close()
})
