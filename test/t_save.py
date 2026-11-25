# Saving for real: swap, cancel, owed, book, change, back to owed – checked against the test server's Swaps tab
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
B='http://localhost:8765/'; REAL=os.environ.get('RRS_TEST_EMAIL','test2@redrobin.test')
swaps=lambda: json.load(urllib.request.urlopen(B+'swaps'))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
    pg=await b.new_page(viewport={'width':390,'height':844}); pg.on('pageerror',lambda e:errs.append(str(e)))
    n0=len(swaps())
    await pg.goto(B); await pg.wait_for_timeout(500); await pg.fill('#pt-q',REAL); await pg.press('#pt-q','Enter'); await pg.wait_for_timeout(900)
    if await pg.locator('[data-rr=noinstall]').count(): await pg.click('[data-rr=noinstall]'); await pg.wait_for_timeout(200)
    print('banner:', await pg.locator('.rrdemo').count())
    await pg.locator('.ptkid').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('button.ptrow[data-pt^="swap|"]').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('.ptopt').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(1500)
    print('1 swap popup:', (await pg.inner_text('.dialog')).replace('\n',' / ')[:120]); s=swaps(); print('   sheet rows', len(s)-n0, s[-1])
    await pg.click('.dialog [data-close]'); await pg.wait_for_timeout(300)
    print('   list:', (await pg.inner_text('.ptlist'))[:140].replace('\n',' / '))
    # cancel it
    await pg.locator('button.ptrow.in').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog [data-pt^="undo|"]').click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(1500)
    s=swaps(); print('2 cancel:', s[-1][9], s[-1][10])
    # owed, then book, then change, then back to owed
    await pg.locator('button.ptrow[data-pt^="swap|"]').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog [data-pt^="later|"]').click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(1500)
    s=swaps(); print('3 owed:', s[-1][7:11])
    await pg.locator('.ptowed button').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog [data-pt^="book|"]').click(); await pg.wait_for_timeout(200)
    await pg.locator('.ptopt').nth(1).click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(1500)
    s=swaps(); print('4 booked:', s[-1][7:11]); await pg.click('.dialog [data-close]'); await pg.wait_for_timeout(300)
    print('   list:', (await pg.inner_text('.ptbody'))[:400].replace('\n',' / '))
    # 'cancel this class, book another later' is only offered once the missed date has gone, so test it on the bridge directly
    code=await pg.evaluate("APP.data.code"); sid='R'+swaps()[-1][0]
    r=json.load(urllib.request.urlopen(B+'api?action=change&op=toowed&code='+code+'&id='+sid)); s=swaps(); print('5 back to owed:', r['ok'], s[-1][7:11])
    r=json.load(urllib.request.urlopen(B+'api?action=change&op=book&code='+code+'&id='+sid+'&to=26A-WED1630&td=2026-12-02')); print('5b own class refused:', r.get('error'), r.get('message'))
    r=json.load(urllib.request.urlopen(B+'api?action=change&op=book&code=wrong&id='+sid+'&to=26A-THU1630&td=2026-12-03')); print('5c bad code refused:', r.get('error'))
    # reload: still there (from the sheet)
    await pg.reload(); await pg.wait_for_timeout(1200)
    if await pg.locator('[data-rr=noinstall]').count(): await pg.click('[data-rr=noinstall]'); await pg.wait_for_timeout(200)
    print('6 after reload:', (await pg.inner_text('.ptphone'))[:220].replace('\n',' / '))
    # test family stays demo
    await pg.click('[data-pt=logout]'); await pg.fill('#pt-q','test2@redrobin.test'); await pg.press('#pt-q','Enter'); await pg.wait_for_timeout(900)
    if await pg.locator('[data-rr=noinstall]').count(): await pg.click('[data-rr=noinstall]'); await pg.wait_for_timeout(200)
    n1=len(swaps()); await pg.locator('.ptkid').first.click(); await pg.wait_for_timeout(200)
    await pg.locator('button.ptrow[data-pt^="swap|"]').first.click(); await pg.wait_for_timeout(200); await pg.locator('.ptopt').first.click(); await pg.wait_for_timeout(200); await pg.locator('.dialog button.primary').click(); await pg.wait_for_timeout(800)
    print('7 test family:', await pg.inner_text('.rrdemo'), '| sheet rows added:', len(swaps())-n1)
    print('ERR',errs); await b.close()
asyncio.run(main())
