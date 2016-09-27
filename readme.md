# fugot

[![Build Status](https://travis-ci.org/sotojuan/fugot.svg?branch=master)](https://travis-ci.org/sotojuan/fugot)

> Like [`got`](https://github.com/sindresorhus/got) but with [Futures](https://github.com/Avaq/Fluture)

This library is a port of the excellent `got` Node HTTP client that returns Futures instead of Promises, provided by the also excellent [Fluture](https://github.com/Avaq/Fluture) library.

Please note that unlike `got`, `fugot` **does not support streams** as it's focused on being a Future-returning client for Node.

## Install

```
$ npm install --save fugot
```

## Why Futures?

Futures offer an interesting alternative to Promises with the following features:

* [Lazy evaluation](https://github.com/Avaq/Fluture/wiki/Comparison-to-Promises#eagerness-vs-laziness)
* [Fantasy Land](https://github.com/fantasyland/fantasy-land) spec compliance
* [Cancellation](https://github.com/Avaq/Fluture#future)
* [Resource management](https://github.com/Avaq/Fluture#resource-management)

Fluture offers a nice API that provides [transformation](https://github.com/Avaq/Fluture#transforming-futures), [error handling](https://github.com/Avaq/Fluture#error-handling), and [parallelism](https://github.com/Avaq/Fluture#parallelism) methods.

For a more in-depth comparison, see [Fluture's wiki](https://github.com/Avaq/Fluture/wiki/Comparison-to-Promises).

## Usage

```js
const fugot = require('fugot')
// Because you'll probably be making your own raw Futures, they're exposed by `fugot`
const Future = fugot.Future

// Requests don't run until you call `fork`
const firstName = fugot('http://api.randomuser.me', {json: true})
  .map(data => data.body.results[0])
  .map(result => result.name.first)

// Prints a random first name
firstName.fork(console.error, console.log)

// Call the function returned by `fork` to cancel a request
const cancel = firstName.fork(console.error, console.log)
// Nothing should be printed unless you comment the following out
cancel()
```

### API

These docs are copied from `got` with appropiate modifications.

It's a `GET` request by default, but that can be changed in `options`.

#### fugot(url, [options])

Returns a Future for a `response` object with a `body` property, a `url` property with the final URL after redirects, and a `requestUrl` property with the original request URL.

##### url

Type: `string`, `object`

The URL to request or a [`http.request` options](https://nodejs.org/api/http.html#http_http_request_options_callback) object.

Properties from `options` will override properties in the parsed `url`.

##### options

Type: `object`

Any of the [`http.request`](http://nodejs.org/api/http.html#http_http_request_options_callback) options.

###### body

Type: `string`, `buffer`, `readableStream`, `object`

Body that will be sent with a `POST` request.

If present in `options` and `options.method` is not set, `options.method` will be set to `POST`.

If `content-length` or `transfer-encoding` is not set in `options.headers` and `body` is a string or buffer, `content-length` will be set to the body length.

If `body` is a plain object, it will be stringified with [`querystring.stringify`](https://nodejs.org/api/querystring.html#querystring_querystring_stringify_obj_sep_eq_options) and sent as `application/x-www-form-urlencoded`.

###### encoding

Type: `string`, `null`<br>
Default: `'utf8'`

Encoding to be used on `setEncoding` of the response data. If `null`, the body is returned as a Buffer.

###### json

Type: `boolean`<br>
Default: `false`

Parse response body with `JSON.parse` and set `accept` header to `application/json`.

###### query

Type: `string`, `object`<br>

Query string object that will be added to the request URL. This will override the query string in `url`.

###### timeout

Type: `number`

Milliseconds to wait for a server to send response headers before aborting request with `ETIMEDOUT` error.

###### retries

Type: `number`, `function`<br>
Default: `5`

Number of request retries when network errors happens. Delays between retries counts with function `1000 * Math.pow(2, retry) + Math.random() * 100`, where `retry` is attempt number (starts from 0).

Option accepts `function` with `retry` and `error` arguments. Function must return delay in milliseconds (`0` return value cancels retry).

**Note:** if `retries` is `number`, `ENOTFOUND` and `ENETUNREACH` error will not be retried (see full list in [`is-retry-allowed`](https://github.com/floatdrop/is-retry-allowed/blob/master/index.js#L12) module).

###### followRedirect

Type: `boolean`<br>
Default: `true`

Defines if redirect responses should be followed automatically.

## Thanks

* [Sindre Sorhus](https://github.com/sindresorhus) for `got` and the docs
* [Aldwin Vlasblom](https://github.com/Avaq/Fluture) for `fluture`

## License

MIT © [Juan Soto](http://juansoto.me)
