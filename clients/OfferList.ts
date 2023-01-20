// maybe use gun.js - https://www.youtube.com/watch?v=_eo_7BxTrmc
import Gun from 'gun/gun';

const gun = new Gun({ peers: ['localhost:8765/gun'] });


const items = gun.get("items");
console.log(items)

items.once().map().once(console.log)

