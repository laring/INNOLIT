import assert from 'node:assert/strict'
import {test} from 'node:test'
import {defaultPanels,readPanelWidths,fitPanelWidths} from '../src/panelLayout.ts'
test('panel widths restore valid saved layouts and recover from invalid or unavailable storage',()=>{
 assert.deepEqual(readPanelWidths({getItem:()=>JSON.stringify({left:310,right:360})}),{left:310,right:360})
 for(const raw of ['bad','null','{}','{"left":"large","right":300}'])assert.deepEqual(readPanelWidths({getItem:()=>raw}),defaultPanels)
 assert.deepEqual(readPanelWidths({getItem:()=>{throw new Error('blocked')}}),defaultPanels)
 assert.deepEqual(readPanelWidths({getItem:()=>'{"left":9999,"right":-5}'}),{left:480,right:200})
})
test('panel resizing reserves a usable workspace and handles hiding the results panel',()=>{
 for(const total of [801,900,1100,1440,1920])for(const left of [180,248,480])for(const right of [200,290,600]){
  const fitted=fitPanelWidths({left,right},total,true)
  assert.ok(total-fitted.left-fitted.right-16>=320)
  assert.ok(fitted.left>=180&&fitted.right>=200)
 }
 assert.deepEqual(fitPanelWidths({left:480,right:600},900,false),{left:480,right:600})
})
