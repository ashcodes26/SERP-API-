"""Real local browser acceptance with explicitly synthetic resume/task input. No secrets printed."""
import base64
import json
from pathlib import Path
import time
import sys

import httpx
from dotenv import dotenv_values
from websockets.sync.client import connect

from app.services.resume_files import parse_resume, DOCX_MIME

ROOT = Path(__file__).resolve().parents[2]
DOWNLOADS = ROOT / 'docs' / '.workspace-downloads'
DOWNLOADS.mkdir(exist_ok=True)
fixture = DOWNLOADS / 'synthetic-qa-resume.txt'
original = 'Alex Synthetic QA\nSKILLS\nPython\nPROJECTS\nWorked on a Python tool to clean 100 records.\nEDUCATION\nBSc Computer Science'
fixture.write_text(original, encoding='utf-8')
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
    command('Browser.setDownloadBehavior', {'behavior': 'allow', 'downloadPath': str(DOWNLOADS)})
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    command('Page.navigate', {'url': 'http://localhost:8081/resume'})
    wait("document.querySelector('input[aria-label=Password]')")
    wait("Object.keys(document.querySelector('input[aria-label=Password]')).some(k=>k.startsWith('__reactFiber'))")
    time.sleep(2)
    fill('Password', dotenv_values(ROOT / 'backend' / '.env')['DEMO_PASSWORD'])
    click('Continue to Skillup →')
    workspace_id = None
    if '--roadmap-only' not in sys.argv:
        click('Resume Enhancer')
        wait("document.body.innerText.includes('Start with what you have.')")
        click('☐I consent to storing my parsed resume privately until I delete it.')
        click('Upload or replace resume')
        wait('true')
        for _ in range(12):
            evaluate('true')
            if chooser: break
            time.sleep(.25)
        assert chooser, 'File picker did not open'
        command('DOM.setFileInputFiles', {'files': [str(fixture)], 'backendNodeId': chooser})
        wait("document.body.innerText.includes('Original saved separately.')")
        workspace_id = evaluate(r"Number(document.body.innerText.match(/synthetic-qa-resume.txt \/ #(\d+)/)[1])")
        print('Browser: real upload parsed and privately saved.')
        fill('Manual target job title', 'Synthetic QA Data Analyst')
        fill('Manual job description', 'Requirements:\nPython and SQL required.\nPreferred:\nDocker.')
        click('Analyze original resume for this target')
        wait("document.body.innerText.includes('45.83 / 100')")
        scroll_to('Evidence you can inspect.'); screenshot('resume-evidence-desktop.png')
        buttons = evaluate("Array.from(document.querySelectorAll('[role=button]')).map(e=>e.textContent.trim()).filter(t=>t.startsWith('Accept '))")
        accepted = next(x for x in buttons if not any(skill in x for skill in ['SQL', 'Docker', 'Python']))
        click(accepted.replace('Accept ', 'Reject '))
        wait("document.body.innerText.includes('Decision: rejected')")
        click(accepted)
        wait("document.body.innerText.includes('Decision: accepted')")
        click('Apply approved suggestions to revision'); click('Confirm apply approved suggestions')
        wait("document.body.innerText.includes('Only accepted changes were applied.')")
        edited = original + '\nContact: qa@example.org & portfolio'
        fill('Revised resume editor', edited)
        click('☐I reviewed the revised text and confirm every skill, date, achievement, and other fact is accurate.')
        click('Save approved revision')
        wait("document.body.innerText.includes('Your approved revision is saved.')")
        scroll_to('Your original. Your revised resume.'); screenshot('resume-editor-desktop.png')
        assert evaluate(f"document.body.innerText.includes({json.dumps(original)})"), 'Original text changed'
        click('Download approved DOCX resume')
        wait("document.body.innerText.includes('Approved resume generated.')")
        exported = DOWNLOADS / f'skillup-resume-{workspace_id}.docx'
        for _ in range(30):
            if exported.exists(): break
            time.sleep(.2)
        assert exported.exists() and parse_resume(exported.read_bytes(), exported.name, DOCX_MIME) == edited
        print('Browser: individual decisions, edited approval, original preservation and real DOCX download passed.')
        # Inspect the separate analyzer without modifying existing private profile data.
        click('LinkedIn Analyzer')
        wait("document.body.innerText.includes('LinkedIn Profile Analyzer')")
        wait("document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]')")
        assert not evaluate("Boolean(document.querySelector('textarea[aria-label=\"Revised resume editor\"]')?.getClientRects().length)")
        click('Resume Enhancer'); click(f'Open saved resume #{workspace_id}')
        wait("document.body.innerText.includes('Your resume strength at a glance.')")
        assert not evaluate("Boolean(document.querySelector('textarea[aria-label=\"Your profile information (editable)\"]')?.getClientRects().length)")
        print('Browser: LinkedIn has a separate tab; resume statistics and saved revision restored.')
        command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        scroll_to('Your original. Your revised resume.'); screenshot('resume-editor-mobile-web.png')
        assert evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile horizontal overflow'
        # Reload authentication, then reopen the same private revision.
        command('Page.reload')
        wait("document.querySelector('input[aria-label=Password]')")
        wait("Object.keys(document.querySelector('input[aria-label=Password]')).some(k=>k.startsWith('__reactFiber'))"); time.sleep(2)
        fill('Password', dotenv_values(ROOT / 'backend' / '.env')['DEMO_PASSWORD']); click('Continue to Skillup →'); click('Resume Enhancer')
        click(f'Open saved resume #{workspace_id}')
        wait(f"document.querySelector('textarea[aria-label=\"Revised resume editor\"]')?.value === {json.dumps(edited)}")
        print('Browser: saved resume persisted across refresh and re-login.')
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    click('My journey'); click('Start synthetic demo →'); wait("document.body.innerText.includes('Your career profile')")
    click('Analyze skill gaps →'); wait("document.body.innerText.includes('PRIORITY GAPS')")
    click('Build learning roadmap →'); wait("document.body.innerText.includes('My To-Do List')", 180)
    wait("document.querySelector('#career-roadmap-panels')")
    wait("getComputedStyle(document.querySelector('#career-roadmap-panels')).flexDirection === 'row'")
    click('Add task from this milestone')
    fill('Task title', 'Synthetic QA evidence task'); fill('Task description', 'Practice the existing milestone exercise; record actual evidence.')
    fill('Due date (YYYY-MM-DD, optional)', time.strftime('%Y-%m-%d', time.gmtime()))
    click('Save task'); wait("document.body.innerText.includes('Synthetic QA evidence task')")
    click('☐Synthetic QA evidence task'); wait("document.querySelector('[role=checkbox][aria-label=\"Synthetic QA evidence task\"]')?.getAttribute('aria-checked') === 'true'")
    click('Completed'); wait("document.querySelector('[role=checkbox][aria-label=\"Synthetic QA evidence task\"]')?.getAttribute('aria-checked') === 'true'")
    scroll_to('Your learning milestones'); screenshot('roadmap-tasks-desktop.png')
    click('☑Synthetic QA evidence task'); wait("document.body.innerText.includes('No tasks match this filter.')")
    click('All'); click('Edit task')
    fill('Task title', 'Synthetic QA revised task'); click('Save task'); wait("document.body.innerText.includes('Synthetic QA revised task')")
    command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    wait("getComputedStyle(document.querySelector('#career-roadmap-panels')).flexDirection === 'column'")
    scroll_to('My To-Do List'); screenshot('roadmap-tasks-mobile-web.png')
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    click('Delete task'); click('Confirm delete task'); wait("!document.body.innerText.includes('Synthetic QA revised task')")
    print('Browser: milestone-linked create/edit/complete/reopen/delete, counts, filters and responsive panels passed.')
    # Remove only the exact synthetic workspace created by this script.
    if workspace_id:
        click('Resume Enhancer'); click(f'Delete resume #{workspace_id}'); click('Confirm delete resume')
        wait(f"!document.body.innerText.includes('Open saved resume #{workspace_id}')")
    assert not exceptions, 'Uncaught browser exception'
    assert not console_errors, 'Console errors during acceptance'
    assert not [row for row in responses if row[1] >= 400], 'Unexpected API failure'
    print('Browser acceptance passed. No uncaught exceptions, console errors or failed API responses. Synthetic workspace/task/profile cleaned up.')
