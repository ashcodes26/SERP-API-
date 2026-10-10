"""Local CDP acceptance check. Start Chrome on port 9473 first; no secrets printed."""
import base64
import json
from pathlib import Path
import time

import httpx
from dotenv import dotenv_values
from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[2]
targets = httpx.get('http://127.0.0.1:9473/json').json()
target = next(t for t in targets if t['type'] == 'page')
counter = 0
exceptions = []
console_errors = []
with connect(target['webSocketDebuggerUrl'], max_size=10_000_000) as ws:
    def command(method, params=None):
        global counter
        counter += 1
        ws.send(json.dumps({'id': counter, 'method': method, 'params': params or {}}))
        while True:
            event = json.loads(ws.recv(timeout=90))
            if event.get('method') == 'Runtime.exceptionThrown':
                exceptions.append(event)
            if event.get('method') == 'Runtime.consoleAPICalled' and event.get('params', {}).get('type') == 'error':
                console_errors.append(event)
            if event.get('id') == counter:
                if 'error' in event:
                    raise RuntimeError('Browser command failed: ' + method)
                return event.get('result', {})

    def evaluate(expression):
        for attempt in range(3):
            try:
                out = command('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
                break
            except RuntimeError:
                if attempt == 2:
                    raise
                time.sleep(0.3)  # Navigation can briefly destroy an execution context.
        if 'exceptionDetails' in out:
            raise RuntimeError('Browser evaluation failed')
        return out.get('result', {}).get('value')

    def wait_for(expression, timeout=60):
        start = time.monotonic()
        while time.monotonic() - start < timeout:
            if evaluate(f'Boolean({expression})'):
                return
            time.sleep(0.3)
        raise AssertionError('Browser acceptance condition timed out: ' + expression)

    def click(text):
        expression = f"Array.from(document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button,a')).find(e=>e.textContent.trim()==={json.dumps(text)} && e.getAttribute('aria-disabled')!=='true' && !e.disabled)"
        wait_for(expression)
        evaluate(f'({expression}).click()')

    def set_input(label, value):
        obj = command('Runtime.evaluate', {'expression': 'window'})['result']['objectId']
        command('Runtime.callFunctionOn', {'objectId': obj, 'functionDeclaration': '''function(label,value){
          const e=document.querySelector('input[aria-label="'+label+'"]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);
          e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));
        }''', 'arguments': [{'value': label}, {'value': value}]})

    def screenshot(name):
        out = command('Page.captureScreenshot', {'format': 'png'})
        (ROOT / 'docs' / name).write_bytes(base64.b64decode(out['data']))

    command('Runtime.enable'); command('Page.enable')
    command('Emulation.setDeviceMetricsOverride', {'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
    command('Page.navigate', {'url':'http://localhost:8081/market'})
    wait_for("document.querySelector('input[aria-label=Password]')")
    # Wait for hydration before dispatching real input events.
    time.sleep(3)
    set_input('Password', dotenv_values(ROOT / 'backend' / '.env')['DEMO_PASSWORD'])
    click('Continue to Skillup →')
    wait_for("document.body.innerText.includes('Skill demand')")
    click('Skill demand')
    wait_for("document.body.innerText.includes('Skill demand ranking')")
    screenshot('market-ranking-desktop.png')
    set_input('Insights location','Never-collected-location')
    click('Apply filters')
    wait_for("document.body.innerText.includes('No data for these filters')")
    click('Actions ▾'); click('↺ Reset filters')
    wait_for("document.body.innerText.includes('Skill demand ranking') && !document.body.innerText.includes('No data for these filters')")
    click('◎  My skill evidence')
    wait_for("document.body.innerText.includes('Your evidence & learning priorities')")
    evaluate("Array.from(document.querySelectorAll('div')).find(e=>e.textContent==='Recorded skill evidence').parentElement.parentElement.parentElement.scrollIntoView({block:'start'})")
    screenshot('market-student-desktop.png')
    assert evaluate("document.querySelectorAll('.recharts-wrapper').length") > 0, 'Expected live-data radar on web'
    command('Emulation.setDeviceMetricsOverride', {'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    time.sleep(1)
    evaluate("Array.from(document.querySelectorAll('div')).find(e=>e.textContent==='Recorded skill evidence').parentElement.parentElement.parentElement.scrollIntoView({block:'start'})")
    screenshot('market-student-mobile-web.png')
    click('⇄  Role comparison')
    wait_for("document.body.innerText.includes('Select at least two roles')")
    assert not exceptions, 'Browser raised an uncaught exception'
    if console_errors:
        print('Console error templates:', [e['params']['args'][0].get('value', '')[:200] for e in console_errors])
    assert not console_errors, 'Browser reported a console error'
    print('Browser acceptance passed: login, ranking, empty filter, reset menu, student radar, mobile viewport, role-selection state.')
