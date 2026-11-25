import asyncio, json, os
REAL=os.environ.get('RRS_TEST_EMAIL','test2@redrobin.test')  # a real family's email from the copy of the data, given when running the test
from playwright.async_api import async_playwright
B='http://localhost:8765/'
MOCK=open('/home/claude/rk/t15.py').read().split('MOCK="""')[1].split('""" % ')[0] % open('/home/claude/rk/ref/realfx.json').read()
IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
AND='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    ctx=await b.new_context(viewport={'width':390,'height':844}, user_agent=IOS); pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    txt=lambda: pg.evaluate("document.querySelector('.ptphone').innerText.split('\\n').filter(Boolean).join(' / ')")
    await pg.goto(B); await pg.wait_for_timeout(800); await pg.screenshot(path='/tmp/s_login.png'); print('1', (await txt())[:120])
    await pg.fill('#pt-q','  '+REAL.upper()+' '); await pg.click('#pt-go'); await pg.wait_for_timeout(800)
    print('2', (await txt())[:260], '| url', pg.url); await pg.screenshot(path='/tmp/s_kids.png')
    await pg.click('[data-rr=install]'); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/s_ios_help.png'); print('3 help:', (await pg.inner_text('.dialog'))[:200].replace('\n',' / '))
    await pg.click('.dialog [data-close]')
    await pg.reload(); await pg.wait_for_timeout(1000); print('4 after reload:', (await txt())[:80])
    await pg.locator('.ptkid').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('button.ptrow[data-pt^="swap|"]').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('.ptopt').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(900)
    print('5 popup:', (await pg.inner_text('.dialog')).replace('\n',' / ')); await pg.screenshot(path='/tmp/s_yay.png'); await pg.click('.dialog [data-close]')
    # counts vs the Rocker
    site=await pg.evaluate("(()=>{ const o={}; S.classes.forEach(c=>ptSessions(c.ClassID).forEach(iso=>o[c.ClassID+'|'+iso]=ptCount(c.ClassID,iso))); return o; })()")
    await pg.click('[data-pt=logout]'); await pg.wait_for_timeout(300); print('6 logout:', (await txt())[:60], '| url', pg.url, '| stored', await pg.evaluate("localStorage.getItem('rrswaps-code')"))
    await pg.goto(B+'?c=nonsense'); await pg.wait_for_timeout(800); print('7 bad link:', (await txt())[:200])
    await pg.fill('#pt-q','nobody@x.com'); await pg.press('#pt-q','Enter'); await pg.wait_for_timeout(600); print('8 unknown:', (await txt())[:200])
    await pg.fill('#pt-q','test3@redrobin.test'); await pg.press('#pt-q','Enter'); await pg.wait_for_timeout(800); print('9 test3:', (await txt())[:200])
    await pg.fill if False else None
    # Rocker counts for the same classes (Rafe's family = children's classes), before the demo swap
    rp=await b.new_page(); await rp.add_init_script(MOCK); await rp.goto('file:///home/claude/rk/source.html#portal'); await rp.wait_for_timeout(3000)
    rk=await rp.evaluate("(()=>{ ptInit(); const o={}; ptClasses().forEach(c=>ptSessions(c.ClassID).forEach(iso=>o[c.ClassID+'|'+iso]=ptCount(c.ClassID,iso))); return o; })()")
    diff=[(k,site[k],rk.get(k)) for k in site if site[k]!=rk.get(k)]
    print('10 counts compared:', len(site), 'diffs (expect 2 from the demo swap):', diff[:6])
    a=await b.new_context(viewport={'width':412,'height':900}, user_agent=AND); ap=await a.new_page(); ap.on('pageerror',lambda e:errs.append(str(e)))
    await ap.goto(B+'?c='+json.loads(await (await ap.request.get(B+'api?action=family&email=test1@redrobin.test')).text())['code']); await ap.wait_for_timeout(900)
    await ap.click('[data-rr=install]'); await ap.wait_for_timeout(300); print('11 android help:', (await ap.inner_text('.dialog'))[:200].replace('\n',' / ')); await ap.screenshot(path='/tmp/s_and_help.png')
    lp=await b.new_page(viewport={'width':1280,'height':900}); lp.on('pageerror',lambda e:errs.append(str(e))); await lp.goto(B); await lp.wait_for_timeout(600); await lp.screenshot(path='/tmp/s_laptop.png')
    print('ERR',errs); await b.close()
asyncio.run(main())
