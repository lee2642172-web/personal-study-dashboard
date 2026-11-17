import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialData} from '../src/initialData.ts';
import {activityEntries} from '../src/activities.ts';
import {taskWorkSummary} from '../src/taskWork.ts';
test('work session titles preserve entered wording and completed Day scope without duplicating time',()=>{
 const d=createInitialData();d.logs=[];d.todos=[];
 d.tasks=[{...d.tasks[0],records:[
 {id:'first',date:'2026-11-15',mode:'day-range',startDay:52,endDay:52,completed:false,minutes:90,note:'',scope:'영단어 D52 재정리 (means, broaden)'},
 {id:'last',date:'2026-11-15',mode:'day-range',startDay:52,endDay:52,completed:true,minutes:90,note:'',scope:'영단어 D52 재정리(deepen, lighten, weaken)'},
 ]}];
 const entries=activityEntries(d);assert.deepEqual(entries.map(e=>e.title),d.tasks[0].records.map(r=>r.scope));assert.equal(entries.reduce((n,e)=>n+e.minutes,0),180);assert.equal(taskWorkSummary(d.tasks[0]).completedDays,1);
 d.tasks[0].records[0].scope='';assert.equal(activityEntries(d)[0].title,d.tasks[0].title);
});
