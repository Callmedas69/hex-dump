import { chromium } from 'file:///C:/Users/herryanto/.claude/skills/gstack/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const dir = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({headless:true});
const results = [];
for (const [name,width,height,reducedMotion] of [['desktop',1440,1000,'no-preference'],['mobile',390,844,'no-preference'],['reduced',1440,1000,'reduce']]) {
  const page = await browser.newPage({viewport:{width,height},reducedMotion});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{if(['error','warning'].includes(m.type()))errors.push(m.type()+': '+m.text());});
  await page.goto('http://localhost:3100/',{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  await page.screenshot({path:dir+name+'-full.png',fullPage:true});
  const before=await page.evaluate(()=>({scrollY, width:innerWidth,scrollWidth:document.documentElement.scrollWidth, text:document.body.innerText,sections:[...document.querySelectorAll('.terminal-header,.share-choices,.gate')].map(e=>({class:e.className,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height})),cta:[...document.querySelectorAll('.share-choice a')].map(e=>({text:e.textContent,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))}));
  await page.getByRole('link',{name:'Open hex encoder'}).click();
  await page.waitForURL('**/#hex-workspace');
  const after=await page.evaluate(()=>({url:location.href,scrollY,targetVisible:!!document.querySelector('#hex-workspace')?.getClientRects().length,focused:document.activeElement?.textContent}));
  await page.screenshot({path:dir+name+'-encoder-click.png',fullPage:true});
  for(let i=0;i<4;i++){await page.mouse.wheel(0,250);await page.waitForTimeout(120);}
  await page.screenshot({path:dir+name+'-bottom.png'});
  for(let i=0;i<5;i++){await page.mouse.wheel(0,-250);await page.waitForTimeout(120);}
  await page.getByRole('button',{name:'Motion on'}).click();
  await page.screenshot({path:dir+name+'-motion-off.png',fullPage:true});
  results.push({name,before,after,errors});
  if(name==='desktop'){
    await page.getByRole('link',{name:'Open private dead drop'}).click();
    await page.waitForURL('**/dead-drop');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(700);
    results.push({name:'dead-drop',text:await page.locator('body').innerText(),errors});
    await page.screenshot({path:dir+'dead-drop.png',fullPage:true});
  }
  await page.close();
}
await writeFile(dir+'observations.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
