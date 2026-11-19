export type Field = { key:string; label:string; type?:'number'|'date'|'month'|'text'; value?:string|number; choices?: [string,string][]; optional?:boolean; min?:number; max?:number; step?:string }
export function num(key:string,label:string,value?:number):Field{return {key,label,value,type:'number',min:0}}
