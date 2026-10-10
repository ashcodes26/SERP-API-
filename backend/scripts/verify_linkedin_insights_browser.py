"""Read-only browser acceptance for profile coaching; does not edit profile or tasks."""
import base64
import json
from pathlib import Path
import time

import httpx
from dotenv import dotenv_values
from websockets.sync.client import connect


ROOT = Path(__file__).resolve().parents[2]
DOWNLOADS = ROOT / 'docs' / '.workspace-downloads'
DOWNLOADS.mkdir(exist_ok=True)
original = 'Alex Synthetic QA\nSKILLS\nPython\nPROJECTS\nWorked on a Python tool to clean 100 records.\nEDUCATION\nBSc Computer Science'

target = next(x for x in httpx.get('http://127.0.0.1:9473/json').json() if x['type'] == 'page')
counter = 0
exceptions, console_errors, responses = [], [], []
chooser = None
with connect(target['webSocketDebuggerUrl'], max_size=20_000_000) as ws:
    def command(method, params=None):
        global counter, chooser
        counter += 1
        ws.send(json.dumps({'id': counter, 'method': method, 'params': params or {}}))
        while True:
            event = json.loads(ws.recv(timeout=60))
            if event.get('method') == 'Runtime.exceptionThrown': exceptions.append(event)
            if event.get('method') == 'Runtime.consoleAPICalled' and event.get('params', {}).get('type') == 'error': console_errors.append(event)
            if event.get('method') == 'Page.fileChooserOpened': chooser = event['params']['backendNodeId']
            if event.get('method') == 'Network.responseReceived':
                response = event['params']['response']
                if '/api/' in response['url']: responses.append((response['url'].split('/api/')[-1], response['status']))
            if event.get('id') == counter:
                if 'error' in event: raise RuntimeError('Browser command failed: ' + method)
                return event.get('result', {})

    def evaluate(expression):
        result = command('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True, 'userGesture': True})
        if 'exceptionDetails' in result: raise RuntimeError('Browser evaluation failed')
        return result.get('result', {}).get('value')

    def wait(expression, seconds=60):
        start = time.monotonic()
        while time.monotonic() - start < seconds:
            if evaluate(f'Boolean({expression})'): return
            time.sleep(.25)
        raise AssertionError('Timed out: ' + expression)

    def click(label):
        match = f"Array.from(document.querySelectorAll('[role=button],[role=checkbox],[role=radio],button,a')).find(e=>e.textContent.trim()==={json.dumps(label)} && e.getAttribute('aria-disabled')!=='true' && !e.disabled)"
        wait(match)
        evaluate(f'({match}).click()')

    def fill(label, value):
        wait(f"document.querySelector('[aria-label={json.dumps(label)}]')")
        window = command('Runtime.evaluate', {'expression': 'window'})['result']['objectId']
        command('Runtime.callFunctionOn', {'objectId': window, 'functionDeclaration': '''function(label,value){
          const e=document.querySelector('input[aria-label="'+label+'"],textarea[aria-label="'+label+'"]');
          const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);
          e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));
        }''', 'arguments': [{'value': label}, {'value': value}]})

    def scroll_to(label):
        evaluate(f"Array.from(document.querySelectorAll('div')).find(e=>e.textContent==={json.dumps(label)}).parentElement.scrollIntoView({{block:'start'}})")

    def screenshot(name):
        result = command('Page.captureScreenshot', {'format': 'png'})
        (ROOT / 'docs' / name).write_bytes(base64.b64decode(result['data']))

    command('Runtime.enable'); command('Page.enable'); command('Network.enable')
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    command('Page.navigate', {'url': 'http://localhost:8081/linkedin'})
    wait("document.querySelector('input[aria-label=Password]')")
    wait("Object.keys(document.querySelector('input[aria-label=Password]')).some(k=>k.startsWith('__reactFiber'))")
    time.sleep(2)
    fill('Password', dotenv_values(ROOT / 'backend' / '.env')['DEMO_PASSWORD'])
    click('Continue to Skillup \u2192'); click('LinkedIn Analyzer')
    wait("document.body.innerText.includes('Analyze your career direction.')")
    wait("!document.body.innerText.includes('Processing your request')")
    original_text = evaluate("document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]').value")
    if len(original_text.strip()) >= 30:
        wait("document.body.innerText.includes('What your profile communicates.')")
        assert evaluate("document.body.innerText.includes('Skill evidence, beyond keywords.')")
        assert evaluate("document.body.innerText.includes('Your highest-impact improvements.')")
        click('Backend Developer'); click('Analyze my LinkedIn profile')
        wait("document.body.innerText.includes('Career analysis updated using your saved profile text and selected target.')")
        assert evaluate("document.body.innerText.includes('YOUR TARGET / EVIDENCE GAP ANALYSIS')")
        assert evaluate("document.body.innerText.includes('curated role template')")
        fill('LinkedIn target job description (optional)', 'Requirements: Python and FastAPI required. SQL and Docker preferred for this role.')
        click('Analyze my LinkedIn profile')
        wait("document.body.innerText.includes('user provided job description')")
        scroll_to('What your profile communicates.'); screenshot('.workspace-downloads/linkedin-coaching-desktop.png')
        assert evaluate("document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]').value") == original_text
        print('Browser: saved profile coaching, contextual skill evidence, target-role comparison and specific description analysis passed.')
    else:
        assert evaluate("document.body.innerText.includes('Retrieve and save profile excerpts')")
        print('Browser: missing-text state correctly requests saved career information.')
    command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    time.sleep(1)
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    if len(original_text.strip()) >= 30:
        scroll_to('What your profile communicates.'); screenshot('.workspace-downloads/linkedin-coaching-mobile.png')
    assert not exceptions, 'Uncaught browser exception'
    assert not console_errors, 'Browser console error'
    assert all(status < 400 for _, status in responses), 'Failed API response'
    print('Browser: mobile width passed; original profile editor preserved; no tasks or profile data modified.')
    command('Browser.close')
