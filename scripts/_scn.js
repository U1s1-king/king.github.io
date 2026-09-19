module.exports=async function({send,evalJs,sleep}){
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8888/Tools.html'});
 await sleep(4000);
 return await evalJs("(function(){var vis=[];document.querySelectorAll('.tool-panel').forEach(function(p){if(getComputedStyle(p).display!=='none')vis.push(p.id);});"+
  "var info=document.querySelector('.info-box');"+
  "return{visPanels:vis.length,visIds:vis.slice(0,5), infoDisplay:info?getComputedStyle(info).display:'-',"+
  " docH:document.documentElement.scrollHeight, hubCards:document.querySelectorAll('.hub-card').length,"+
  " mainCardH:Math.round(document.querySelector('.main-card').getBoundingClientRect().height)};})()");
};