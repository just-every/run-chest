declare module '@runeditrun/rer/modules/portability/journal' {
 export function tombstone(source:string,table:string,key:Record<string,unknown>):Promise<string>
}
declare module '@runeditrun/rer/modules/portability/storage' {
 export function state(db:D1Database):Promise<{source_identity:string;epoch:number}>
}
