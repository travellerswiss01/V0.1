import {mkdirSync,openSync,closeSync,unlinkSync,existsSync,readFileSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";

export class ExecutionLock {
  private readonly path:string;
  private acquired=false;

  constructor(path="data/execution.lock"){
    this.path=path;
    mkdirSync(dirname(path),{recursive:true});
  }

  acquire(owner:string):boolean {
    if(this.acquired) return true;
    try{
      const fd=openSync(this.path,"wx");
      closeSync(fd);
      writeFileSync(this.path,owner,"utf8");
      this.acquired=true;
      return true;
    }catch(error){
      if(!existsSync(this.path)) throw error;
      return false;
    }
  }

  release():void {
    if(!this.acquired) return;
    try{unlinkSync(this.path);}finally{this.acquired=false;}
  }

  status():{locked:boolean;owner?:string} {
    if(!existsSync(this.path)) return {locked:false};
    try{return {locked:true,owner:readFileSync(this.path,"utf8")||undefined};}
    catch{return {locked:true};}
  }
}

export async function withExecutionLock<T>(
  lock:ExecutionLock,
  owner:string,
  work:()=>Promise<T>
):Promise<T>{
  if(!lock.acquire(owner)) throw new Error("Execution lock is already held; concurrent company execution is blocked.");
  try{return await work();}finally{lock.release();}
}