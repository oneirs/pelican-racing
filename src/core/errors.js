// Keep module-loading failures visible instead of leaving the menu at “preparing”.
function showLoadError(message) {
  const panel=document.getElementById('error');
  if(panel){panel.textContent='场景加载失败：'+message;panel.style.display='block';}
  console.error(message);
}
window.addEventListener('error',event=>{
  if(event.message)showLoadError(event.message);
  else if(event.target?.tagName==='SCRIPT')showLoadError('脚本未能加载，请刷新页面。');
},true);
window.addEventListener('unhandledrejection',event=>showLoadError(event.reason?.message??String(event.reason)));
