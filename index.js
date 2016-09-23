'use strict'

const EventEmitter = require('events').EventEmitter
const Future = require('fluture')
const http = require('http')
const https = require('https')
const urlLib = require('url')
const isRedirect = require('is-redirect')
const isStream = require('is-stream')
const getStream = require('get-stream')
const unzipResponse = require('unzip-response')
const urlParseLax = require('url-parse-lax')
const timedOut = require('timed-out')
const querystring = require('querystring')
const lowercaseKeys = require('lowercase-keys')
const isRetryAllowed = require('is-retry-allowed')
const createErrorClass = require('create-error-class')
const nodeStatusCodes = require('node-status-codes')
const pkg = require('./package.json')

function requestAsEventEmitter (opts) {
  opts = opts || {}

  const ee = new EventEmitter()
  let redirectCount = 0
  let retryCount = 0
  let redirectUrl

  const get = (opts) => {
    const fn = opts.protocol === 'https:' ? https : http

    const req = fn.request(opts, res => {
      const statusCode = res.statusCode

      if (redirectUrl) {
        res.url = redirectUrl
      }

      if (isRedirect(statusCode) && opts.followRedirect && 'location' in res.headers && (opts.method === 'GET' || opts.method === 'HEAD')) {
        res.resume()

        if (++redirectCount > 10) {
          ee.emit('error', new fugot.MaxRedirectsError(statusCode, opts), null, res)
          return
        }

        redirectUrl = urlLib.resolve(urlLib.format(opts), new Buffer(res.headers.location, 'binary').toString())
        const redirectOpts = Object.assign({}, opts, urlLib.parse(redirectUrl))

        ee.emit('redirect', res, redirectOpts)

        get(redirectOpts)

        return
      }

      setImmediate(() => {
        ee.emit('response', typeof unzipResponse === 'function' && req.method !== 'HEAD' ? unzipResponse(res) : res)
      })
    })

    req.once('error', error => {
      const backoff = opts.retries(++retryCount, error)

      if (backoff) {
        setTimeout(get, backoff, opts)
        return
      }

      ee.emit('error', new fugot.RequestError(error, opts))
    })

    if (opts.timeout) {
      timedOut(req, opts.timeout)
    }

    setImmediate(() => ee.emit('request', req))
  }

  get(opts)
  return ee
}

function asFuture (opts) {
  return Future((reject, resolve) => {
    const ee = requestAsEventEmitter(opts)

    ee.on('request', req => {
      if (isStream(opts.body)) {
        opts.body.pipe(req)
        opts.body = undefined
        return
      }

      req.end(opts.body)
    })

    ee.on('response', res => {
      const stream = opts.encoding === null ? getStream.buffer(res) : getStream(res, opts)

      stream
        .catch(error => reject(new fugot.ReadError(error, opts)))
        .then(data => {
          const statusCode = res.statusCode
          const limitStatusCode = opts.followRedirect ? 299 : 399

          res.body = data
          res.requestUrl = opts.href || urlLib.resolve(urlLib.format(opts), opts.path)

          if (opts.json && res.body) {
            try {
              res.body = JSON.parse(res.body)
            } catch (e) {
              throw new fugot.ParseError(e, statusCode, opts, data)
            }
          }

          if (statusCode < 200 || statusCode > limitStatusCode) {
            throw new fugot.HTTPError(statusCode, opts)
          }

          resolve(res)
        })
        .catch(error => {
          Object.defineProperty(error, 'response', {value: res})
          reject(error)
        })
    })

    ee.on('error', reject)
  })
}

function normalizeArguments (url, opts) {
  if (typeof url !== 'string' && typeof url !== 'object') {
    throw new Error(`Parameter \`url\` must be a string or object, not ${typeof url}`)
  }

  if (typeof url === 'string') {
    url = url.replace(/^unix:/, 'http://$&')
    url = urlParseLax(url)

    if (url.auth) {
      throw new Error('Basic authentication must be done with auth option')
    }
  }

  opts = Object.assign(
    {
      protocol: 'http:',
      path: '',
      retries: 5
    },
    url,
    opts
  )

  opts.headers = Object.assign({
    'user-agent': `${pkg.name}/${pkg.version} (https://github.com/sindresorhus/got)`,
    'accept-encoding': 'gzip,deflate'
  }, lowercaseKeys(opts.headers))

  const query = opts.query

  if (query) {
    if (typeof query !== 'string') {
      opts.query = querystring.stringify(query)
    }

    opts.path = `${opts.path.split('?')[0]}?${opts.query}`
    delete opts.query
  }

  if (opts.json && opts.headers.accept === undefined) {
    opts.headers.accept = 'application/json'
  }

  let body = opts.body

  if (body) {
    if (typeof body !== 'string' && !(body !== null && typeof body === 'object')) {
      throw new Error('options.body must be a ReadableStream, string, Buffer or plain Object')
    }

    opts.method = opts.method || 'POST'

    if (isStream(body) && typeof body.getBoundary === 'function') {
      // Special case for https://github.com/form-data/form-data
      opts.headers['content-type'] = opts.headers['content-type'] || `multipart/form-data; boundary=${body.getBoundary()}`
    } else if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body) && !isStream(body)) {
      opts.headers['content-type'] = opts.headers['content-type'] || 'application/x-www-form-urlencoded'
      body = opts.body = querystring.stringify(body)
    }

    if (opts.headers['content-length'] === undefined && opts.headers['transfer-encoding'] === undefined && !isStream(body)) {
      const length = typeof body === 'string' ? Buffer.byteLength(body) : body.length
      opts.headers['content-length'] = length
    }
  }

  opts.method = (opts.method || 'GET').toUpperCase()

  if (opts.hostname === 'unix') {
    const matches = /(.+):(.+)/.exec(opts.path)

    if (matches) {
      opts.socketPath = matches[1]
      opts.path = matches[2]
      opts.host = null
    }
  }

  if (typeof opts.retries !== 'function') {
    const retries = opts.retries

    opts.retries = function backoff (iter, error) {
      if (iter > retries || !isRetryAllowed(error)) {
        return 0
      }

      const noise = Math.random() * 100

      return ((1 << iter) * 1000) + noise
    }
  }

  if (opts.followRedirect === undefined) {
    opts.followRedirect = true
  }

  return opts
}

function fugot (url, opts) {
  try {
    return asFuture(normalizeArguments(url, opts))
  } catch (error) {
    return Future.reject(error)
  }
}

const helpers = [
  'get',
  'post',
  'put',
  'patch',
  'head',
  'delete'
]

helpers.forEach(el => {
  fugot[el] = (url, opts) => fugot(url, Object.assign({}, opts, {method: el}))
})
function stdError (error, opts) {
  if (error.code !== undefined) {
    this.code = error.code
  }

  Object.assign(this, {
    message: error.message,
    host: opts.host,
    hostname: opts.hostname,
    method: opts.method,
    path: opts.path
  })
}

fugot.RequestError = createErrorClass('RequestError', stdError)
fugot.ReadError = createErrorClass('ReadError', stdError)
fugot.ParseError = createErrorClass('ParseError', function (e, statusCode, opts, data) {
  stdError.call(this, e, opts)
  this.statusCode = statusCode
  this.statusMessage = nodeStatusCodes[this.statusCode]
  this.message = `${e.message} in "${urlLib.format(opts)}": \n${data.slice(0, 77)}...`
})

fugot.HTTPError = createErrorClass('HTTPError', function (statusCode, opts) {
  stdError.call(this, {}, opts)
  this.statusCode = statusCode
  this.statusMessage = nodeStatusCodes[this.statusCode]
  this.message = `Response code ${this.statusCode} (${this.statusMessage})`
})

fugot.MaxRedirectsError = createErrorClass('MaxRedirectsError', function (statusCode, opts) {
  stdError.call(this, {}, opts)
  this.statusCode = statusCode
  this.statusMessage = nodeStatusCodes[this.statusCode]
  this.message = 'Redirected 10 times. Aborting.'
})

module.exports = fugot
