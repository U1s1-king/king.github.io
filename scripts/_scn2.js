const fs=require('fs');
module.exports=async function({send,evalJs,sleep}){
 const o={};
 // ---------- DESKTOP tier-1 ----------
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8888/Tools.html'});
 await sleep(4000);
 o.dt1=await evalJs("(function(){var vis=[];document.querySelectorAll('.tool-panel').forEach(function(p){if(getComputedStyle(p).display!=='none')vis.push(p.id);});"+
  "var ib=document.querySelector('.info-box');"+
  "return{visPanels:vis,"+
  " activeCount:document.querySelectorAll('.tool-panel.active').length,"+
  " panelsInMainCard:document.querySelectorAll('.main-card > .tool-panel').length,"+
  " stashCount:(function(){var s=document.getElementById('toolsStashDesktop');return s?s.children.length:0;})(),"+
  " infoInMainCard:!!ib&&ib.parentNode.classList.contains('main-card'),"+
  " mainCardH:Math.round(document.querySelector('.main-card').getBoundingClientRect().height),"+
  " hubCards:document.querySelectorAll('.hub-card').length,"+
  " backBar:(function(){var e=document.getElementById('toolsBack');return e?getComputedStyle(e).display:'-';})()};})()");
 let sh=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(process.env.TEMP+'/D1.png',Buffer.from(sh.result.data,'base64'));

 // ---------- click a card -> panel inline under back bar ----------
 await evalJs("document.querySelector('.hub-card[data-tool=\"jsonfmt\"]').click()");
 await sleep(900);
 o.dClick=await evalJs("(function(){var p=document.getElementById('tool-jsonfmt');"+
  "return{toolOpen:document.documentElement.classList.contains('tool-open'),"+
  " panelDisplay:p?getComputedStyle(p).display:'-',"+
  " panelParent:p?p.parentNode.className:'-',"+
  " panelAfterBack:(function(){var b=document.getElementById('toolsBack');return !!(b&&p&&b.nextElementSibling===p);})(),"+
  " gridDisplay:getComputedStyle(document.getElementById('toolsGrid')).display,"+
  " backBar:(function(){var e=document.getElementById('toolsBack');return e?getComputedStyle(e).display:'-';})()};})()");
 sh=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(process.env.TEMP+'/D2.png',Buffer.from(sh.result.data,'base64'));

 // ---------- back -> panel returns to stash ----------
 await evalJs("document.getElementById('toolsBackBtn').click()");
 await sleep(1000);
 o.dBack=await evalJs("(function(){var vis=[];document.querySelectorAll('.tool-panel').forEach(function(p){if(getComputedStyle(p).display!=='none')vis.push(p.id);});"+
  "return{toolOpen:document.documentElement.classList.contains('tool-open'),visPanels:vis,"+
  " activeCount:document.querySelectorAll('.tool-panel.active').length,"+
  " panelsInMainCard:document.querySelectorAll('.main-card > .tool-panel').length,"+
  " gridDisplay:getComputedStyle(document.getElementById('toolsGrid')).display};})()");
 return o;
};