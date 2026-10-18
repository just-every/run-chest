import { ChestError } from '../model'
export class StorageRefusal extends ChestError {
 constructor(public scope: string, public limitBytes: number|null, public usedBytes: number, public space: string) { super('storage_limit_exceeded',413) }
}
export class QuotaConfirmation extends ChestError {
 constructor(public overLimit: any[], public confirmation: string) { super('storage_limit_confirmation_required',409) }
}
