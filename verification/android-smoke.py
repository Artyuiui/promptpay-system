#!/usr/bin/env python3
"""Run against a configured, foreground Android display. Uses only Python stdlib."""
import json, os, time, urllib.request, urllib.error
base = os.environ.get('DISPLAY_URL', 'http://127.0.0.1:18080')
token = os.environ['DISPLAY_TOKEN']
def request(path, data=None, auth=True, method=None):
    headers = {'Content-Type': 'application/json'}
    if auth: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            body=response.read()
            return response.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
assert request('/status', auth=False)[0] == 401
assert request('/show', {'amount': 1}, auth=False)[0] == 401
assert request('/hide', {}, auth=False)[0] == 401
assert request('/show', auth=False, method='OPTIONS')[0] == 204
assert request('/show', {'amount': 259, 'timeout': 2})[1]['mode'] == 'qr'
assert request('/status')[1]['amount'] == 259
for invalid in [0, -1, '259', 1.001]:
    assert request('/show', {'amount': invalid})[0] == 400
assert request('/status')[1]['amount'] == 259
# A replacement payment gets a fresh deadline; the previous countdown cannot hide it.
assert request('/show', {'amount': 120, 'timeout': 4})[1]['amount'] == 120
time.sleep(2.1)
assert request('/status')[1]['mode'] == 'qr'
assert request('/hide', {})[1]['mode'] == 'video'
assert request('/show', {'amount': 1, 'timeout': 1})[1]['mode'] == 'qr'
time.sleep(1.1)
assert request('/status')[1]['mode'] == 'video'
print('PASS: authentication, preflight, show, validation, replacement, hide, expiry')
