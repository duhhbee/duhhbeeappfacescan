"""Real MediaPipe + browser stream regression; fixture pixels are not a physical camera.
Run against local Vite only. Reads (never changes) the native capture injection.
"""
from pathlib import Path
import argparse
import base64
import json
import os
import re
from patchright.sync_api import sync_playwright

os.umask(0o077)
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='https://localhost:5174/')
parser.add_argument('--out', required=True)
parser.add_argument('--portrait', default='/root/duhhbee/replacement-20261022/private/positive-portrait.jpg')
parser.add_argument('--native', default='/root/duhhbee/aws-annotations-20261105/mobile-source/src/modules/Auth/pages/Register/components/CameraScanning/CameraScanning.tsx')
args = parser.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
portrait = 'data:image/jpeg;base64,' + base64.b64encode(Path(args.portrait).read_bytes()).decode()
native = Path(args.native).read_text()
# Execute the exact existing native one-shot injection, not a replacement encoder.
match = re.search(r"injectJavaScript\(`\s*(\(function \(\) \{\s*try \{\s*var video = document.querySelector\('video'\);.*?\}\)\(\);\s*true;)\s*`\)", native, re.S)
assert match, 'Native one-shot injection not found'
injection = match.group(1)
script = r'''(() => {
 const image = new Image(); image.src = PORTRAIT;
 const c = document.createElement('canvas'); c.width = SIZE[0]; c.height = SIZE[1];
 const ctx = c.getContext('2d');
 const s = window.__cameraFixture = {show:false, brightness:1, requests:[], events:[], encodes:[], photo:null};
 const original = HTMLCanvasElement.prototype.toDataURL;
 HTMLCanvasElement.prototype.toDataURL = function(...args) {
   s.encodes.push({width:this.width,height:this.height,args});
   return original.apply(this,args);
 };
 function draw() {
   ctx.fillStyle = '#777'; ctx.fillRect(0,0,c.width,c.height);
   if(s.show && image.complete) {
     ctx.filter = `brightness(${s.brightness})`;
     if(c.width > c.height) {
       const h = c.height * .7, w = h * .8;
       ctx.drawImage(image,1050,180,800,1000,(c.width-w)/2,c.height*.08,w,h);
     } else {
       const h = c.height * .455, w = h * 480/583;
       ctx.drawImage(image,800,150,1400,1700,(c.width-w)/2,c.height*.14,w,h);
     }
     ctx.filter = 'none';
   }
   requestAnimationFrame(draw);
 }
 draw();
 navigator.mediaDevices.getUserMedia = async constraints => {
   s.requests.push(constraints);
   if(REJECT.includes(constraints.video?.width?.ideal)) throw new DOMException('Fixture fallback','OverconstrainedError');
   return c.captureStream(20);
 };
 window.ReactNativeWebView = {postMessage:raw => {
   const e = JSON.parse(raw);
   if(e.type === 'camera-photo') { s.photo = e; return; }
   e.imagePresent = !!e.image; delete e.image;
   s.events.push(e); if(s.events.length > 100) s.events.shift();
 }};
})()'''
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    for name, size, reject, expected_width in [
        ('full-hd', [1920,1080], [], 1920),
        ('fallback-720', [1280,720], [1920], 1280),
        ('fallback-480', [640,480], [1920,1280], 640),
        ('negotiated-lower', [640,480], [], 1920),
        ('portrait-stream', [1080,1920], [], 1920),
        ('desktop-full-hd', [1920,1080], [], 1920),
    ]:
        device = {} if name.startswith('desktop') else {'viewport':{'width':390,'height':844}, 'user_agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'}
        page = browser.new_page(ignore_https_errors=True, **device)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        ev = lambda expression: page.evaluate(expression, isolated_context=False)
        setup = script.replace('PORTRAIT', json.dumps(portrait)).replace('SIZE', json.dumps(size)).replace('REJECT', json.dumps(reject))
        page.add_init_script(setup)
        page.goto(args.url, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_function('window.__cameraFixture?.events.some(e => e.faceFound === false)', timeout=90000)
        ev('__cameraFixture.events=[];__cameraFixture.show=true')
        try:
            page.wait_for_function('__cameraFixture.events.filter(e => e.position && e.faceFound).length >= 3', timeout=90000)
        except Exception:
            page.screenshot(path=str(out / f'{name}-failure.png'))
            print(json.dumps({'events':ev('__cameraFixture.events.slice(-3)'), 'errors':errors, 'requests':ev('__cameraFixture.requests')}), flush=True)
            raise
        page.screenshot(path=str(out / f'{name}-front.png'))
        front = ev('__cameraFixture.events.filter(e => e.position).slice(-3)')
        ev('__cameraFixture.events=[];__cameraFixture.brightness=.45')
        page.wait_for_function('__cameraFixture.events.filter(e => e.position && e.faceFound).length >= 3', timeout=60000)
        dim = ev('__cameraFixture.events.filter(e => e.position).slice(-3)')
        page.screenshot(path=str(out / f'{name}-dim.png'))
        before = ev('__cameraFixture.encodes.slice()')
        ev('__cameraFixture.brightness=1')
        # Wait for the stream's next presented frames, not only canvas repaint.
        ev('new Promise(resolve => {const v=document.querySelector("video");v.requestVideoFrameCallback(() => v.requestVideoFrameCallback(resolve));})')
        ev(injection)
        photo = ev('__cameraFixture.photo.image')
        photo_path = out / f'{name}-native-shot.jpg'
        photo_path.write_bytes(base64.b64decode(photo.split(',',1)[1]))
        dimensions = ev('''async () => {
          const image = new Image();image.src = __cameraFixture.photo.image;await image.decode();
          const v = document.querySelector('video');
          return {video:[v.videoWidth,v.videoHeight],jpeg:[image.naturalWidth,image.naturalHeight],track:v.srcObject.getVideoTracks()[0].getSettings()};
        }''')
        requests = ev('__cameraFixture.requests')
        encodes = ev('__cameraFixture.encodes.slice()')
        result: dict = dict(name=name, requested=requests, dimensions=dimensions, pre_shot_encodes=before, post_shot_encodes=encodes, front=front, dim=dim, page_errors=errors)
        results.append(result)
        (out / 'verification.json').write_text(json.dumps(results,indent=2))
        # Collect all intended RED failures together after exercising the real detector.
        checks = {
            '1080p first preference': requests[0]['video'].get('width',{}).get('ideal') == 1920,
            'active Camera retains selected preference': requests[-1]['video'].get('width',{}).get('ideal') == expected_width,
            'no per-frame JPEG encoding': before == [],
            'one native JPEG0.92 at actual video dimensions': len(encodes) == 1 and encodes[-1] == {'width':size[0],'height':size[1],'args':['image/jpeg',.92]},
            'actual JPEG dimensions retained': dimensions['jpeg'] == dimensions['video'] == size,
            'permissive front and dim readiness': all(e['qualityOk'] and not e['rejectReason'] for e in front+dim),
            'no page errors': not errors,
        }
        result['checks'] = checks
        (out / 'verification.json').write_text(json.dumps(results,indent=2))
        print(json.dumps({'name':name,'dimensions':dimensions,'checks':checks}),flush=True)
        assert all(checks.values()), checks
        page.close()
    browser.close()
