import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentCloudConfig,loadCloudConfig} from '../src/cloud.ts';
const url='https://example.supabase.co',key='sb_publishable_example_public_connection_key';
test('production server public aliases bootstrap new devices without URL entry',()=>{
 assert.deepEqual(deploymentCloudConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}),{url,key});
 assert.equal(deploymentCloudConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_secret_do_not_embed'}),null);
 assert.equal(deploymentCloudConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'eyJ.'+btoa(JSON.stringify({role:'service_role'}))+'.test'}),null);
});
test('valid device settings survive; missing, damaged and inaccessible settings use deployment defaults',()=>{
 const fallback={url,key};
 for(const value of [null,'broken','{}',JSON.stringify({url:'',key:''})])assert.deepEqual(loadCloudConfig(fallback,{getItem:()=>value}),fallback);
 assert.deepEqual(loadCloudConfig(fallback,{getItem(){throw new Error('unavailable')}}),fallback);
 const own={url:'https://other.supabase.co',key};assert.deepEqual(loadCloudConfig(fallback,{getItem:()=>JSON.stringify(own)}),own);
 assert.equal(loadCloudConfig({url:'',key:''},{getItem:()=>null}),null);
});
