"use strict";(()=>{var e={};e.id=8729,e.ids=[8729],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},98216:e=>{e.exports=require("net")},35816:e=>{e.exports=require("process")},76162:e=>{e.exports=require("stream")},74026:e=>{e.exports=require("string_decoder")},95346:e=>{e.exports=require("timers")},82452:e=>{e.exports=require("tls")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},20379:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>_,patchFetch:()=>j,requestAsyncStorage:()=>c,routeModule:()=>l,serverHooks:()=>x,staticGenerationAsyncStorage:()=>g});var s={};r.r(s),r.d(s,{GET:()=>d,POST:()=>p});var a=r(49303),o=r(88716),n=r(60670),i=r(87070),u=r(9487);async function d(e,{params:t}){try{let e=(0,u.Mj)(),[r]=await e.query(`
      SELECT 
        id,
        project_id as projectId,
        wbs_code as wbsCode,
        outline_level as outlineLevel,
        sort_order as sortOrder,
        name,
        start_date as startDate,
        finish_date as finishDate,
        duration_days as durationDays,
        predecessors,
        assignee,
        is_milestone as isMilestone
      FROM gantt_tasks
      WHERE project_id = ?
      ORDER BY sort_order ASC, id ASC
      `,[t.projectId]);return i.NextResponse.json({tasks:r})}catch(e){return console.error("[gantt/tasks][GET] 오류:",e),i.NextResponse.json({error:"Failed to load Gantt tasks",details:e.message},{status:500})}}async function p(e,{params:t}){try{let{tasks:r}=await e.json();if(!Array.isArray(r))return i.NextResponse.json({error:"tasks array is required"},{status:400});let s=t.projectId,a=(0,u.Mj)(),o=await a.getConnection();try{for(let e of(await o.beginTransaction(),await o.query("DELETE FROM gantt_tasks WHERE project_id = ?",[s]),r))await o.query(`
          INSERT INTO gantt_tasks
            (project_id, wbs_code, outline_level, sort_order, name, start_date, finish_date, duration_days, predecessors, assignee, is_milestone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,[s,e.wbsCode??null,e.outlineLevel??1,e.sortOrder??1,e.name,e.startDate??null,e.finishDate??null,e.durationDays??null,e.predecessors??null,e.assignee??null,e.isMilestone?1:0]);return await o.commit(),i.NextResponse.json({success:!0})}catch(e){throw await o.rollback(),e}finally{o.release()}}catch(e){return console.error("[gantt/tasks][POST] 오류:",e),i.NextResponse.json({error:"Failed to save Gantt tasks",details:e.message},{status:500})}}let l=new a.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/gantt/tasks/[projectId]/route",pathname:"/api/gantt/tasks/[projectId]",filename:"route",bundlePath:"app/api/gantt/tasks/[projectId]/route"},resolvedPagePath:"C:\\Users\\seung\\YSJ_Projects\\Test_1\\app\\api\\gantt\\tasks\\[projectId]\\route.ts",nextConfigOutput:"standalone",userland:s}),{requestAsyncStorage:c,staticGenerationAsyncStorage:g,serverHooks:x}=l,_="/api/gantt/tasks/[projectId]/route";function j(){return(0,n.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:g})}}};var t=require("../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[9276,5972,3785,7330],()=>r(20379));module.exports=s})();