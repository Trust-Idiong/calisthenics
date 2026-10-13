export class StateStore {
  constructor(storage,key){this.storage=storage;this.key=key;this.locked=false;this.raw=null;}
  load(validate,fallback){
    try {this.raw=this.storage.getItem(this.key);return this.raw===null?fallback():validate(JSON.parse(this.raw));}
    catch {this.locked=true;return fallback();}
  }
  save(state){
    if(this.locked)throw new Error('Your saved records need recovery. Download the original data, restore a backup, or deliberately reset first.');
    this.storage.setItem(this.key,JSON.stringify(state));
  }
  replace(state){this.storage.setItem(this.key,JSON.stringify(state));this.locked=false;this.raw=null;}
}
