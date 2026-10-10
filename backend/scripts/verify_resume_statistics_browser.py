"""Real local browser acceptance with explicitly synthetic resume/task input. No secrets printed."""
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
    command('Page.navigate', {'url': 'http://localhost:8081/resume'})
    wait("document.querySelector('input[aria-label=Password]')")
    wait("Object.keys(document.querySelector('input[aria-label=Password]')).some(k=>k.startsWith('__reactFiber'))")
    time.sleep(2)
    fill('Password', dotenv_values(ROOT / 'backend' / '.env')['DEMO_PASSWORD'])
    click('Continue to Skillup \u2192'); click('Resume Enhancer')
    wait("document.body.innerText.includes('Start with what you have.')")
    wait("!document.body.innerText.includes('Processing your request')")
    assert not evaluate("Boolean(document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]')?.getClientRects().length)")
    click('\u2610I consent to storing my parsed resume privately until I delete it.')
    fill('Or paste original resume text', original)
    click('Save pasted resume as a new original')
    wait("document.body.innerText.includes('Your original resume text is saved.')")
    workspace_id = evaluate(r"Number(document.body.innerText.match(/#(\d+) \/ Active/)[1])")
    assert evaluate("document.querySelector('[role=progressbar][aria-label=\"Original resume text strength\"]')?.getAttribute('aria-valuenow')==='85'")
    revised = original + '\nEXPERIENCE\nBuilt SQL reports for 200 users.'
    fill('Revised resume editor', revised)
    wait("document.body.innerText.includes('Save your editor changes to update the revised statistics.')")
    assert evaluate("document.querySelector('[role=progressbar][aria-label=\"Saved revision text strength\"]')?.getAttribute('aria-valuenow')==='85'")
    click('\u2610I reviewed the revised text and confirm every skill, date, achievement, and other fact is accurate.')
    click('Save approved revision')
    wait("document.body.innerText.includes('Your approved revision is saved.')")
    assert evaluate("document.querySelector('[role=progressbar][aria-label=\"Saved revision text strength\"]')?.getAttribute('aria-valuenow')==='100'")
    assert evaluate("document.body.innerText.includes('Text strength change: +15 points')")
    scroll_to('Your resume strength at a glance.'); screenshot('.workspace-downloads/resume-statistics-desktop.png')
    click('LinkedIn Analyzer')
    wait("document.body.innerText.includes('LinkedIn Profile Analyzer')")
    wait("!document.body.innerText.includes('Processing your request')")
    assert not evaluate("Boolean(document.querySelector('textarea[aria-label=\"Revised resume editor\"]')?.getClientRects().length)")
    saved_profile = evaluate("document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]').value")
    print('Browser: separate tabs render; original 85, revised 100, +15 change; unsaved changes do not change statistics.')
    click('Resume Enhancer'); click(f'Open saved resume #{workspace_id}')
    wait("document.body.innerText.includes('Text strength change: +15 points')")
    command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    time.sleep(1)
    scroll_to('Your resume strength at a glance.'); screenshot('.workspace-downloads/resume-statistics-mobile.png')
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    click('LinkedIn Analyzer'); wait("document.body.innerText.includes('LinkedIn Profile Analyzer')")
    wait("!document.body.innerText.includes('Processing your request')")
    assert evaluate("document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]').value") == saved_profile
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    click('Resume Enhancer'); click(f'Open saved resume #{workspace_id}')
    wait("document.body.innerText.includes('Text strength change: +15 points')")
    click(f'Delete resume #{workspace_id}'); click('Confirm delete resume')
    wait(f"!document.body.innerText.includes('Open saved resume #{workspace_id}')")
    assert not exceptions, 'Uncaught browser exception'
    assert not console_errors, 'Browser console error'
    assert all(status < 400 for _, status in responses), 'Failed API response'
    print('Browser: desktop/mobile navigation, saved profile preservation, persisted statistics passed. Synthetic resume removed.')
    command('Browser.close')
