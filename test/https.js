import test from 'ava'
import pem from 'pem'
import pify from 'pify'
import fugot from '../'
import {createSSLServer} from './helpers/server'

let s
let caRootCert

const pemP = pify(pem, Promise)

test.before('setup', async () => {
  const caKeys = await pemP.createCertificate({
    days: 1,
    selfSigned: true
  })

  const caRootKey = caKeys.serviceKey
  caRootCert = caKeys.certificate

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
    commonName: 'juansoto.me'
  })

  const key = keys.clientKey
  const cert = keys.certificate

  s = await createSSLServer({key, cert}) // eslint-disable-line object-property-newline

  s.on('/', (req, res) => res.end('ok'))

  await s.listen(s.port)
})

test.cb('make request to https server without ca', t => {
  fugot(s.url, {rejectUnauthorized: false})
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.truthy(body)
      t.end()
    })
})

test.cb('make request to https server with ca', t => {
  fugot(s.url, {
    strictSSL: true,
    ca: caRootCert,
    headers: {host: 'juansoto.me'}
  })
    .map(x => x.body)
    .fork(t.falsy, (body) => {
      t.truthy(body)
      t.end()
    })
})

test.after('cleanup', async () => {
  await s.close()
})
