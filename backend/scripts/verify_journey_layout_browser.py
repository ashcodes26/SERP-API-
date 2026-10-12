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
    command('Page.setInterceptFileChooserDialog', {'enabled': True})
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    command('Page.navigate', {'url': 'http://localhost:8081/'})
    wait("document.querySelector('input[aria-label=Password]')")
    wait("Object.keys(document.querySelector('input[aria-label=Password]')).some(k=>k.startsWith('__reactFiber'))")
    time.sleep(2)
    credentials = dotenv_values(ROOT / 'backend' / '.env')
    fill('Password', credentials['DEMO_PASSWORD'])
    click('Continue to Skillup \u2192')
    client = httpx.Client(base_url='http://127.0.0.1:8000', timeout=15)
    auth = client.post('/api/auth/login', json={'username': 'demo', 'password': credentials['DEMO_PASSWORD']}).json()
    client.headers['Authorization'] = 'Bearer ' + auth['access_token']
    before = client.get(f"/api/profile/{auth['student_id']}").json()
    click('Add journey details (CSV / Excel)')
    wait("document.body.innerText.includes('Upload your journey details')")
    csv_path = DOWNLOADS / 'journey-layout.csv'
    csv_path.write_text('name,program,cgpa,skills,summary\nAlex Synthetic QA,BSc,8.5,Python;JavaScript,Synthetic browser preview only.\n', encoding='utf-8')
    from openpyxl import Workbook
    book = Workbook(); book.active.append(['name', 'program', 'skills']); book.active.append(['Taylor Synthetic QA', 'BSc', 'SQL;Docker'])
    xlsx_path = DOWNLOADS / 'journey-layout.xlsx'; book.save(xlsx_path)
    for path, expected in [(csv_path, 'Alex Synthetic QA'), (xlsx_path, 'Taylor Synthetic QA')]:
        chooser = None
        click('Choose CSV or Excel')
        wait('document.querySelector("input[type=file]")')
        for _ in range(10):
            evaluate('true')
            if chooser: break
            time.sleep(.2)
        assert chooser
        command('DOM.setFileInputFiles', {'files': [str(path)], 'backendNodeId': chooser})
        wait(f'document.body.innerText.includes({json.dumps(expected)})')
        wait("!document.querySelector('[aria-label=\"Processing journey input\"]')")
        assert evaluate("Array.from(document.querySelectorAll('[role=button],button')).find(e=>e.textContent.trim()==='Save details and continue').getAttribute('aria-disabled')==='true'")
    command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    time.sleep(.5)
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    click('Back to My journey')
    click('LinkedIn Analyzer')
    wait("document.body.innerText.includes('Retrieve and review your profile')")
    wait("!document.body.innerText.includes('Processing your request')")
    assert evaluate("document.body.innerText.indexOf('Retrieve and review your profile') < document.body.innerText.indexOf('Analyze your career direction.')")
    assert evaluate("!document.body.innerText.includes('SAVED PROFILE ANALYSIS')")
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    click('Skill demand')
    wait("document.body.innerText.includes('Show skill demand')")
    wait("!document.body.innerText.includes('Loading actual collected data')")
    assert evaluate("!document.querySelector('[aria-label=\"Collection start date YYYY-MM-DD\"]')")
    assert evaluate("!Array.from(document.querySelectorAll('[role=button],button')).some(e=>e.getClientRects().length && e.textContent.includes('Actions'))")
    click('Show skill demand')
    wait("!document.body.innerText.includes('Loading actual collected data')")
    click('More options')
    wait("document.querySelector('[aria-label=\"Collection start date YYYY-MM-DD\"]')")
    click('Hide options')
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    time.sleep(.5)
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
    assert client.get(f"/api/profile/{auth['student_id']}").json() == before
    assert not exceptions and not console_errors
    assert all(status < 400 for _, status in responses)
    print('Browser passed: actual CSV and Excel picker previews, reviewed-save gate, LinkedIn input order/removal, simpler demand filters, desktop/mobile widths. Existing student data unchanged; save behavior covered by isolated API tests.')
    command('Browser.close')
